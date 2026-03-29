/**
 * Server API client.
 *
 * All calls go to the same origin (nginx routes /api/* to the AdonisJS
 * server). Cookies handle auth automatically.
 */

const SILENT_MODE_KEY = "kitty-timer-silent-mode";

export function isSilentMode(): boolean {
	return localStorage.getItem(SILENT_MODE_KEY) === "true";
}

export function setSilentMode(on: boolean): void {
	localStorage.setItem(SILENT_MODE_KEY, on ? "true" : "false");
}

async function post(path: string, body?: Record<string, unknown>) {
	const res = await fetch(path, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		credentials: "same-origin",
		body: body ? JSON.stringify(body) : undefined,
	});
	if (!res.ok) {
		throw new Error(`API ${path}: ${res.status}`);
	}
	return res.json();
}

async function get(path: string) {
	const res = await fetch(path, {
		credentials: "same-origin",
	});
	if (!res.ok) {
		throw new Error(`API ${path}: ${res.status}`);
	}
	return res.json();
}

/**
 * Notify the server that a meditation started.
 * Skipped when silent mode is on.
 */
export async function meditationStart(): Promise<void> {
	if (isSilentMode()) return;
	try {
		await post("/api/meditations/start");
	} catch {
		/* server unreachable — meditation still works locally */
	}
}

/**
 * Notify the server that a meditation ended.
 * Skipped when silent mode is on.
 */
export async function meditationEnd(): Promise<void> {
	if (isSilentMode()) return;
	try {
		await post("/api/meditations/end");
	} catch {
		/* server unreachable */
	}
}

/**
 * Register a push subscription with the server.
 */
export async function registerPushSubscription(
	subscription: PushSubscription,
): Promise<void> {
	try {
		await post("/api/push-subscriptions", {
			subscription: JSON.stringify(subscription.toJSON()),
		});
	} catch {
		/* non-critical */
	}
}

/**
 * Get the VAPID public key from the server.
 * Returns null if not configured or server unreachable.
 */
export async function getVapidPublicKey(): Promise<string | null> {
	try {
		const data = await get("/api/push/vapid-key");
		return data.publicKey || null;
	} catch {
		return null;
	}
}
