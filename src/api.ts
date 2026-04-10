/**
 * Server API client.
 *
 * Web (same-origin): requests use session cookies.
 * Capacitor (cross-origin): requests use Bearer token from localStorage.
 * The __API_BASE__ define is empty for web, full URL for Capacitor.
 */

declare const __API_BASE__: string;

const API_BASE = __API_BASE__;
const TOKEN_KEY = "kitty-timer-api-token";
const SILENT_MODE_KEY = "kitty-timer-silent-mode";

export function getToken(): string | null {
	return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
	localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
	localStorage.removeItem(TOKEN_KEY);
}

export function isSilentMode(): boolean {
	return localStorage.getItem(SILENT_MODE_KEY) === "true";
}

export function setSilentMode(on: boolean): void {
	localStorage.setItem(SILENT_MODE_KEY, on ? "true" : "false");
}

function headers(): Record<string, string> {
	const h: Record<string, string> = { "Content-Type": "application/json" };
	const token = getToken();
	if (token) {
		h.Authorization = `Bearer ${token}`;
	}
	return h;
}

function credentials(): RequestCredentials {
	return getToken() ? "omit" : "same-origin";
}

async function post(path: string, body?: Record<string, unknown>) {
	const res = await fetch(`${API_BASE}${path}`, {
		method: "POST",
		headers: headers(),
		credentials: credentials(),
		body: body ? JSON.stringify(body) : undefined,
	});
	if (!res.ok) {
		const data = await res.json().catch(() => ({}));
		throw new ApiError(path, res.status, data.error || res.statusText);
	}
	return res.json();
}

async function get(path: string) {
	const res = await fetch(`${API_BASE}${path}`, {
		headers: headers(),
		credentials: credentials(),
	});
	if (!res.ok) {
		const data = await res.json().catch(() => ({}));
		throw new ApiError(path, res.status, data.error || res.statusText);
	}
	return res.json();
}

async function del(path: string) {
	const res = await fetch(`${API_BASE}${path}`, {
		method: "DELETE",
		headers: headers(),
		credentials: credentials(),
	});
	if (!res.ok) {
		const data = await res.json().catch(() => ({}));
		throw new ApiError(path, res.status, data.error || res.statusText);
	}
	return res.json();
}

async function patch(path: string, body?: Record<string, unknown>) {
	const res = await fetch(`${API_BASE}${path}`, {
		method: "PATCH",
		headers: headers(),
		credentials: credentials(),
		body: body ? JSON.stringify(body) : undefined,
	});
	if (!res.ok) {
		const data = await res.json().catch(() => ({}));
		throw new ApiError(path, res.status, data.error || res.statusText);
	}
	return res.json();
}

export class ApiError extends Error {
	constructor(
		public path: string,
		public status: number,
		message: string,
	) {
		super(message);
	}
}

/* ── Auth ── */

export async function apiLogin(email: string) {
	return post("/api/auth/login", { email });
}

export async function apiVerify(code: string, deviceLabel?: string) {
	return post("/api/auth/verify", { code, deviceLabel });
}

export async function apiLogout() {
	return post("/api/auth/logout");
}

export async function apiCheckAuth() {
	return get("/api/auth/check");
}

/* ── Friends ── */

export async function apiFriends() {
	return get("/api/friends");
}

export async function apiAddFriend(email: string) {
	return post("/api/friends", { email });
}

export async function apiRemoveFriend(id: number) {
	return del(`/api/friends/${id}`);
}

export async function apiUpdateToggles(
	id: number,
	toggle: string,
	value: boolean,
) {
	return patch(`/api/friends/${id}/toggles`, { toggle, value });
}

/* ── Profile ── */

export async function apiProfile() {
	return get("/api/profile");
}

export async function apiUpdateProfile(data: {
	timezone?: string;
	nickname?: string;
	status?: string;
}) {
	return post("/api/profile", data);
}

/* ── Meditations (existing) ── */

export async function meditationStart(): Promise<void> {
	if (isSilentMode()) return;
	try {
		await post("/api/meditations/start");
	} catch {
		/* server unreachable — meditation still works locally */
	}
}

export async function meditationEnd(): Promise<void> {
	if (isSilentMode()) return;
	try {
		await post("/api/meditations/end");
	} catch {
		/* server unreachable */
	}
}

/* ── Push (existing) ── */

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

export async function getVapidPublicKey(): Promise<string | null> {
	try {
		const data = await get("/api/push/vapid-key");
		return data.publicKey || null;
	} catch {
		return null;
	}
}
