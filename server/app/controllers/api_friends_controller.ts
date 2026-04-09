import type { HttpContext } from '@adonisjs/core/http'
import Friendship from '#models/friendship'
import Meditation from '#models/meditation'
import User from '#models/user'

export default class ApiFriendsController {
	/**
	 * GET /api/friends — list all friends + pending
	 */
	async index({ auth, response }: HttpContext) {
		const userId = auth.user!.id

		const confirmed = await Friendship.query()
			.where((q) => {
				q.where('user_a_id', userId).orWhere('user_b_id', userId)
			})
			.andWhere('confirmed', true)
			.preload('userA')
			.preload('userB')

		const pendingSent = await Friendship.query()
			.where('user_a_id', userId)
			.andWhere('confirmed', false)
			.preload('userB')

		const pendingReceived = await Friendship.query()
			.where('user_b_id', userId)
			.andWhere('confirmed', false)
			.preload('userA')

		const friendUserIds = confirmed.map((f) =>
			f.userAId === userId ? f.userBId : f.userAId
		)
		const activeMeditations =
			friendUserIds.length > 0
				? await Meditation.query()
						.whereIn('user_id', friendUserIds)
						.whereNull('ended_at')
				: []
		const meditatingUserIds = new Set(activeMeditations.map((m) => m.userId))

		const friends = confirmed.map((f) => {
			const isA = f.userAId === userId
			const friend = isA ? f.userB : f.userA
			const toggles = f.togglesFor(userId)
			return {
				id: f.id,
				userId: friend.id,
				email: friend.email,
				timezone: friend.timezone,
				notifyThem: toggles.notifyThem,
				notifyMe: toggles.notifyMe,
				isMeditating: meditatingUserIds.has(friend.id),
			}
		})

		const sent = pendingSent.map((f) => ({
			id: f.id,
			email: f.userB.email,
		}))

		const received = pendingReceived.map((f) => ({
			id: f.id,
			email: f.userA.email,
		}))

		return response.json({ friends, pendingSent: sent, pendingReceived: received })
	}

	/**
	 * POST /api/friends — add friend by email
	 */
	async store({ request, response, auth }: HttpContext) {
		const userId = auth.user!.id
		const email = request.input('email')?.trim().toLowerCase()

		if (!email) {
			return response.status(422).json({ error: 'Email is required.' })
		}

		if (email === auth.user!.email) {
			return response.status(422).json({ error: "You can't add yourself as a friend." })
		}

		const friend = await User.firstOrCreate({ email }, { email, timezone: 'UTC' })

		const existing = await Friendship.query()
			.where((q) => {
				q.where((q2) => {
					q2.where('user_a_id', userId).andWhere('user_b_id', friend.id)
				}).orWhere((q2) => {
					q2.where('user_a_id', friend.id).andWhere('user_b_id', userId)
				})
			})
			.first()

		if (existing) {
			if (existing.confirmed) {
				return response.json({ status: 'exists', message: `${email} is already your friend.` })
			} else if (existing.userAId === userId) {
				return response.json({
					status: 'pending',
					message: `Friend request to ${email} already sent.`,
				})
			} else {
				existing.confirmed = true
				await existing.save()
				return response.json({
					status: 'confirmed',
					message: `You and ${email} are now friends!`,
				})
			}
		}

		await Friendship.create({
			userAId: userId,
			userBId: friend.id,
			confirmed: false,
		})

		return response.json({ status: 'pending', message: `Friend request sent to ${email}.` })
	}

	/**
	 * DELETE /api/friends/:id — remove friendship
	 */
	async destroy({ params, response, auth }: HttpContext) {
		const userId = auth.user!.id
		const friendship = await Friendship.query()
			.where('id', params.id)
			.where((q) => {
				q.where('user_a_id', userId).orWhere('user_b_id', userId)
			})
			.firstOrFail()

		await friendship.delete()
		return response.json({ ok: true })
	}

	/**
	 * PATCH /api/friends/:id/toggles — update notification toggles
	 */
	async updateToggles({ params, request, response, auth }: HttpContext) {
		const userId = auth.user!.id
		const friendship = await Friendship.query()
			.where('id', params.id)
			.where((q) => {
				q.where('user_a_id', userId).orWhere('user_b_id', userId)
			})
			.firstOrFail()

		const toggle = request.input('toggle')
		const value = request.input('value') === true || request.input('value') === 'true'
		const iAmA = friendship.userAId === userId

		if (toggle === 'notifyThem') {
			if (iAmA) {
				friendship.aNotifiesB = value
			} else {
				friendship.bNotifiesA = value
			}
		} else if (toggle === 'notifyMe') {
			if (iAmA) {
				friendship.aReceivesB = value
			} else {
				friendship.bReceivesA = value
			}
		}

		await friendship.save()
		return response.json({ ok: true })
	}
}
