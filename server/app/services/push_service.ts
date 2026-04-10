import webpush from 'web-push'
import env from '#start/env'
import PushSubscription from '#models/push_subscription'
import logger from '@adonisjs/core/services/logger'

const vapidPublicKey = env.get('VAPID_PUBLIC_KEY', '')
const vapidPrivateKey = env.get('VAPID_PRIVATE_KEY', '')

if (vapidPublicKey && vapidPrivateKey) {
	webpush.setVapidDetails(
		env.get('VAPID_SUBJECT', 'mailto:dev@localhost'),
		vapidPublicKey,
		vapidPrivateKey
	)
}

interface PushPayload {
	title: string
	body: string
	url?: string
	/** Alternate title/body for web push (iOS PWA already shows app name) */
	webTitle?: string
	webBody?: string
	/**
	 * Sound effect name for native push (e.g. "chime", "bell", "gong").
	 * Maps to a bundled .caf/.wav file on iOS/Android.
	 * Web push ignores this — the client plays the sound via Web Audio API.
	 */
	sound?: string
}

export default class PushService {
	/**
	 * Send a push notification to all subscriptions of a user.
	 */
	static async notifyUser(userId: number, payload: PushPayload) {
		const subscriptions = await PushSubscription.query().where('user_id', userId)

		for (const sub of subscriptions) {
			try {
				await PushService.sendToTransport(sub, payload)
			} catch (error: any) {
				if (error.statusCode === 410 || error.statusCode === 404) {
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
	static async notifyUsers(userIds: number[], payload: PushPayload) {
		await Promise.allSettled(
			userIds.map((userId) => PushService.notifyUser(userId, payload))
		)
	}

	/**
	 * Route to the correct transport based on subscription type.
	 */
	private static async sendToTransport(sub: PushSubscription, payload: PushPayload) {
		switch (sub.type) {
			case 'web':
				return PushService.sendWeb(sub, payload)
			case 'apns':
				logger.warn({ subscriptionId: sub.id }, 'APNs transport not yet implemented')
				return
			case 'fcm':
				logger.warn({ subscriptionId: sub.id }, 'FCM transport not yet implemented')
				return
			default:
				logger.error({ subscriptionId: sub.id, type: sub.type }, 'Unknown push transport type')
		}
	}

	/**
	 * Send via Web Push (VAPID).
	 */
	private static async sendWeb(sub: PushSubscription, payload: PushPayload) {
		if (!vapidPublicKey || !vapidPrivateKey) {
			logger.warn('VAPID keys not configured — skipping web push')
			return
		}
		const webPayload = {
			title: payload.webTitle || payload.title,
			body: payload.webBody || payload.body,
			url: payload.url,
		}
		await webpush.sendNotification(sub.parsedSubscription, JSON.stringify(webPayload))
	}

	/**
	 * Get the VAPID public key (needed by the web client to subscribe).
	 */
	static getVapidPublicKey(): string {
		return vapidPublicKey
	}
}
