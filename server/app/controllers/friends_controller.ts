import type { HttpContext } from '@adonisjs/core/http'
import Friendship from '#models/friendship'
import Meditation from '#models/meditation'
import User from '#models/user'

export default class FriendsController {
	/**
	 * GET /friends — show friends list page
	 */
	async index({ view, auth }: HttpContext) {
		const userId = auth.user!.id

		/* Confirmed friends */
		const confirmed = await Friendship.query()
			.where((q) => {
				q.where('user_a_id', userId).orWhere('user_b_id', userId)
			})
			.andWhere('confirmed', true)
			.preload('userA')
			.preload('userB')

		/* Pending: I added them but they haven't added me back */
		const pendingSent = await Friendship.query()
			.where('user_a_id', userId)
			.andWhere('confirmed', false)
			.preload('userB')

		/* Pending: They added me but I haven't added them back */
		const pendingReceived = await Friendship.query()
			.where('user_b_id', userId)
			.andWhere('confirmed', false)
			.preload('userA')

		/* Check which friends are currently meditating */
		const friendUserIds = confirmed.map((f) => f.userAId === userId ? f.userBId : f.userAId)
		const activeMeditations = friendUserIds.length > 0
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

		return view.render('pages/friends/index', {
			user: auth.user,
			friends,
			pendingSent: sent,
			pendingReceived: received,
		})
	}

	/**
	 * POST /friends — add a friend by email
	 *
	 * If they already added us, the friendship is confirmed (mutual opt-in).
	 * Otherwise, creates a pending friendship.
	 */
	async store({ request, response, auth, session }: HttpContext) {
		const userId = auth.user!.id
		const email = request.input('email')?.trim().toLowerCase()

		if (!email) {
			session.flash('error', 'Please enter an email address.')
			return response.redirect().back()
		}

		if (email === auth.user!.email) {
			session.flash('error', "You can't add yourself as a friend.")
			return response.redirect().back()
		}

		/* Find or create the target user */
		const friend = await User.firstOrCreate(
			{ email },
			{ email, timezone: 'UTC' }
		)

		/* Check if a friendship already exists in either direction */
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
				session.flash('info', `${email} is already your friend.`)
			} else if (existing.userAId === userId) {
				session.flash('info', `Friend request to ${email} already sent.`)
			} else {
				/* They added us first — confirm the friendship */
				existing.confirmed = true
				await existing.save()
				session.flash('success', `You and ${email} are now friends!`)
			}
			return response.redirect().toRoute('friends.index')
		}

		/* Check if the friend already added us (they are user_a, we are user_b) */
		const reverse = await Friendship.query()
			.where('user_a_id', friend.id)
			.andWhere('user_b_id', userId)
			.first()

		if (reverse) {
			reverse.confirmed = true
			await reverse.save()
			session.flash('success', `You and ${email} are now friends!`)
			return response.redirect().toRoute('friends.index')
		}

		/* Create a new pending friendship (we are user_a) */
		await Friendship.create({
			userAId: userId,
			userBId: friend.id,
			confirmed: false,
		})

		session.flash('success', `Friend request sent to ${email}.`)
		return response.redirect().toRoute('friends.index')
	}

	/**
	 * DELETE /friends/:id — remove a friendship
	 */
	async destroy({ params, response, auth, session }: HttpContext) {
		const userId = auth.user!.id
		const friendship = await Friendship.query()
			.where('id', params.id)
			.where((q) => {
				q.where('user_a_id', userId).orWhere('user_b_id', userId)
			})
			.firstOrFail()

		await friendship.delete()
		session.flash('success', 'Friend removed.')
		return response.redirect().toRoute('friends.index')
	}

	/**
	 * PATCH /friends/:id/toggles — update notification toggles
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
		const value = request.input('value') === 'true'
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
		return response.redirect().toRoute('friends.index')
	}
}
