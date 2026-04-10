/**
 * Unified push notification setup.
 *
 * Detects platform and registers via the appropriate transport:
 *   - Web/PWA → Web Push API (VAPID)
 *   - iOS     → APNs via @capacitor/push-notifications (TODO)
 *   - Android → FCM via @capacitor/push-notifications (TODO)
 *
 * On page load, setupPushNotifications() re-registers an existing subscription
 * (no permission prompt). The user-triggered ensurePushSubscription() requests
 * permission if needed — Firefox requires this to be called from a user gesture.
 */

import { Capacitor } from "@capacitor/core";
import { getVapidPublicKey, registerPushSubscription } from "./api";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
	const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
	const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
	const raw = atob(base64);
	const arr = new Uint8Array(raw.length);
	for (let i = 0; i < raw.length; i++) {
		arr[i] = raw.charCodeAt(i);
	}
	return arr;
}

/**
 * Called on page load. Re-registers an existing push subscription with the
 * server (e.g. after token refresh). Does NOT prompt for permission.
 */
export async function setupPushNotifications(): Promise<void> {
	const platform = Capacitor.getPlatform();

	if (platform === "ios" || platform === "android") {
		return setupNativePush(platform === "ios" ? "apns" : "fcm");
	}

	/* Web: only re-register if already subscribed */
	if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

	const registration = await navigator.serviceWorker.ready;
	const subscription = await registration.pushManager.getSubscription();
	if (subscription) {
		await registerPushSubscription(
			JSON.stringify(subscription.toJSON()),
			"web",
		);
	}
}

/**
 * Called from a user gesture (e.g. toggling "Notify me").
 * Requests permission and creates a push subscription if needed.
 */
export async function ensurePushSubscription(): Promise<void> {
	const platform = Capacitor.getPlatform();

	if (platform === "ios" || platform === "android") {
		return setupNativePush(platform === "ios" ? "apns" : "fcm");
	}

	if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

	const vapidKey = await getVapidPublicKey();
	if (!vapidKey) return;

	const registration = await navigator.serviceWorker.ready;
	let subscription = await registration.pushManager.getSubscription();

	if (!subscription) {
		const permission = await Notification.requestPermission();
		if (permission !== "granted") return;

		subscription = await registration.pushManager.subscribe({
			userVisibleOnly: true,
			applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
		});
	}

	await registerPushSubscription(JSON.stringify(subscription.toJSON()), "web");
}

async function setupNativePush(type: "apns" | "fcm"): Promise<void> {
	/*
	 * TODO: When @capacitor/push-notifications is installed:
	 * 1. Import { PushNotifications } from '@capacitor/push-notifications'
	 * 2. Request permission
	 * 3. Register and get token from 'registration' event
	 * 4. Call registerPushSubscription(token, type)
	 * 5. Listen for 'pushNotificationReceived' for foreground handling
	 *
	 * Custom notification sounds (iOS/Android):
	 * - Bundle .caf (iOS) / .wav (Android) files in the native project
	 *   for each effect: chime, bell, drop, gong, birdsong, harp
	 * - The server includes a `sound` field in the push payload
	 *   matching the user's selected effect name
	 * - iOS: set `sound` in APNs payload (e.g. "chime.caf")
	 * - Android: set `sound` in FCM notification (e.g. "chime")
	 *   and register a notification channel per sound
	 * - Use getNativeSound() from notification-sounds.ts to read
	 *   the user's current preference when registering the subscription
	 */
	console.info(`[push] Native push (${type}) not yet implemented`);
}
