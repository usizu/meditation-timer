import type { HttpContext } from '@adonisjs/core/http'
import PushSubscription from '#models/push_subscription'
import PushService from '#services/push_service'

export default class PushSubscriptionsController {
	/**
	 * GET /api/push/vapid-key — return the VAPID public key
	 */
	async vapidKey({ response }: HttpContext) {
		return response.json({
			publicKey: PushService.getVapidPublicKey(),
		})
	}

	/**
	 * POST /api/push-subscriptions — register a push subscription
	 */
	async store({ request, response, auth }: HttpContext) {
		const userId = auth.user!.id
		const subscription = request.input('subscription')
		const deviceLabel = request.input('deviceLabel') || null

		if (!subscription) {
			return response.status(400).json({ error: 'subscription is required' })
		}

		const subscriptionJson = typeof subscription === 'string'
			? subscription
			: JSON.stringify(subscription)

		/* Avoid duplicates: check if this endpoint already exists */
		const parsed = JSON.parse(subscriptionJson)
		const existing = await PushSubscription.query()
			.where('user_id', userId)
			.exec()

		const alreadyExists = existing.some((sub) => {
			try {
				return JSON.parse(sub.subscription).endpoint === parsed.endpoint
			} catch {
				return false
			}
		})

		if (alreadyExists) {
			return response.json({ status: 'already_registered' })
		}

		await PushSubscription.create({
			userId,
			subscription: subscriptionJson,
			deviceLabel,
		})

		return response.status(201).json({ status: 'registered' })
	}

	/**
	 * DELETE /api/push-subscriptions/:id — remove a subscription
	 */
	async destroy({ params, response, auth }: HttpContext) {
		const sub = await PushSubscription.query()
			.where('id', params.id)
			.andWhere('user_id', auth.user!.id)
			.firstOrFail()

		await sub.delete()
		return response.json({ status: 'removed' })
	}
}
