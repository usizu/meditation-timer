/// <reference lib="webworker" />

import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";

declare const self: ServiceWorkerGlobalScope;

/* ── Workbox precaching (injected by VitePWA at build time) ── */
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

/* ── Push notification handler ── */
self.addEventListener("push", (event) => {
	if (!event.data) return;

	let payload: { title?: string; body?: string; url?: string };
	try {
		payload = event.data.json();
	} catch {
		payload = { title: "Kitty Timer", body: event.data.text() };
	}

	const title = payload.title || "Kitty Timer";
	const options: NotificationOptions = {
		body: payload.body || "",
		icon: "/icon-192.svg",
		badge: "/icon-192.svg",
		data: { url: payload.url || "/" },
	};

	event.waitUntil(self.registration.showNotification(title, options));
});

/* ── Notification click handler ── */
self.addEventListener("notificationclick", (event) => {
	event.notification.close();

	const url = (event.notification.data?.url as string) || "/";

	event.waitUntil(
		self.clients
			.matchAll({ type: "window", includeUncontrolled: true })
			.then((clients) => {
				/* Focus existing window if open */
				for (const client of clients) {
					if (client.url.includes(self.location.origin) && "focus" in client) {
						return client.focus();
					}
				}
				/* Otherwise open a new window */
				return self.clients.openWindow(url);
			}),
	);
});
