/**
 * Push notification subscription.
 *
 * Requests permission, subscribes via the service worker's pushManager,
 * and registers the subscription with the server.
 */

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

export async function setupPushNotifications(): Promise<void> {
	if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
		return;
	}

	const vapidKey = await getVapidPublicKey();
	if (!vapidKey) return;

	const registration = await navigator.serviceWorker.ready;

	/* Check if already subscribed */
	let subscription = await registration.pushManager.getSubscription();

	if (!subscription) {
		/* Request permission */
		const permission = await Notification.requestPermission();
		if (permission !== "granted") return;

		subscription = await registration.pushManager.subscribe({
			userVisibleOnly: true,
			applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
		});
	}

	/* Register with the server */
	await registerPushSubscription(subscription);
}
