import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import Meditation from '#models/meditation'
import Friendship from '#models/friendship'
import logger from '@adonisjs/core/services/logger'
import sseManager from '#services/sse_manager'

export default class MeditationsController {
	/**
	 * POST /meditations/start
	 *
	 * Creates a meditation record and determines which friends to notify.
	 * Returns JSON (called from the PWA client, not a form).
	 */
	async start({ auth, response }: HttpContext) {
		const userId = auth.user!.id

		/* End any currently-active meditation first */
		await Meditation.query()
			.where('user_id', userId)
			.whereNull('ended_at')
			.update({ endedAt: DateTime.now().toSQL() })

		/* Create a new meditation */
		const meditation = await Meditation.create({
			userId,
			startedAt: DateTime.now(),
		})

		/* Find friends who should be notified */
		const friendsToNotify = await this.getFriendsToNotify(userId)

		logger.info(
			{ userId, meditationId: meditation.id, notify: friendsToNotify.map((f) => f.email) },
			'Meditation started'
		)

		/* Push SSE update to connected friends */
		const friendIds = friendsToNotify.map((f) => f.id)
		sseManager.broadcastToUsers(
			friendIds,
			`#friend-status-${userId}`,
			`<span id="friend-status-${userId}" class="meditating-indicator">meditating</span>`
		)

		/*
		 * TODO Phase 5: Send web push notifications to friendsToNotify
		 */

		return response.json({
			id: meditation.id,
			startedAt: meditation.startedAt.toISO(),
			notifiedCount: friendsToNotify.length,
		})
	}

	/**
	 * POST /meditations/end
	 *
	 * Ends the user's active meditation.
	 */
	async end({ auth, response }: HttpContext) {
		const userId = auth.user!.id

		const meditation = await Meditation.query()
			.where('user_id', userId)
			.whereNull('ended_at')
			.first()

		if (!meditation) {
			return response.status(404).json({ error: 'No active meditation' })
		}

		meditation.endedAt = DateTime.now()
		await meditation.save()

		logger.info({ userId, meditationId: meditation.id }, 'Meditation ended')

		/* Push SSE update to connected friends — remove meditating indicator */
		const allFriends = await this.getConfirmedFriendIds(userId)
		sseManager.broadcastToUsers(
			allFriends,
			`#friend-status-${userId}`,
			`<span id="friend-status-${userId}"></span>`
		)

		return response.json({
			id: meditation.id,
			startedAt: meditation.startedAt.toISO(),
			endedAt: meditation.endedAt.toISO(),
		})
	}

	/**
	 * Determine which friends should receive a notification when this user
	 * starts meditating.
	 *
	 * A friend is notified only when BOTH conditions hold:
	 *   1. The meditating user has "notify them" ON for that friend
	 *   2. That friend has "notify me" ON for the meditating user
	 */
	private async getFriendsToNotify(userId: number) {
		const friendships = await Friendship.query()
			.where((q) => {
				q.where('user_a_id', userId).orWhere('user_b_id', userId)
			})
			.andWhere('confirmed', true)
			.preload('userA')
			.preload('userB')

		const toNotify: { id: number; email: string }[] = []

		for (const f of friendships) {
			const iAmA = f.userAId === userId
			const friend = iAmA ? f.userB : f.userA

			/* Check both-sides-agree logic */
			const iNotifyThem = iAmA ? f.aNotifiesB : f.bNotifiesA
			const theyReceiveMe = iAmA ? f.bReceivesA : f.aReceivesB

			if (iNotifyThem && theyReceiveMe) {
				toNotify.push({ id: friend.id, email: friend.email })
			}
		}

		return toNotify
	}

	/**
	 * Get all confirmed friend user IDs (for SSE broadcast on meditation end).
	 */
	private async getConfirmedFriendIds(userId: number): Promise<number[]> {
		const friendships = await Friendship.query()
			.where((q) => {
				q.where('user_a_id', userId).orWhere('user_b_id', userId)
			})
			.andWhere('confirmed', true)

		return friendships.map((f) => f.userAId === userId ? f.userBId : f.userAId)
	}
}
