import webpush from 'web-push'
import env from '#start/env'
import PushSubscription from '#models/push_subscription'
import logger from '@adonisjs/core/services/logger'

const vapidPublicKey = env.get('VAPID_PUBLIC_KEY', '')
const vapidPrivateKey = env.get('VAPID_PRIVATE_KEY', '')

if (vapidPublicKey && vapidPrivateKey) {
	webpush.setVapidDetails(
		env.get('APP_URL', 'http://localhost:3333'),
		vapidPublicKey,
		vapidPrivateKey
	)
}

export default class PushService {
	/**
	 * Send a push notification to all subscriptions of a user.
	 */
	static async notifyUser(userId: number, payload: { title: string; body: string; url?: string }) {
		if (!vapidPublicKey || !vapidPrivateKey) {
			logger.warn('VAPID keys not configured — skipping push notification')
			return
		}

		const subscriptions = await PushSubscription.query().where('user_id', userId)

		for (const sub of subscriptions) {
			try {
				await webpush.sendNotification(
					sub.parsedSubscription,
					JSON.stringify(payload)
				)
			} catch (error: any) {
				if (error.statusCode === 410 || error.statusCode === 404) {
					/* Subscription expired or invalid — remove it */
					logger.info({ subscriptionId: sub.id }, 'Removing expired push subscription')
					await sub.delete()
				} else {
					logger.error({ err: error, subscriptionId: sub.id }, 'Failed to send push notification')
				}
			}
		}
	}

	/**
	 * Send push notifications to multiple users.
	 */
	static async notifyUsers(userIds: number[], payload: { title: string; body: string; url?: string }) {
		await Promise.allSettled(
			userIds.map((userId) => PushService.notifyUser(userId, payload))
		)
	}

	/**
	 * Get the VAPID public key (needed by the client to subscribe).
	 */
	static getVapidPublicKey(): string {
		return vapidPublicKey
	}
}
