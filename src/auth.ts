/**
 * Client auth module.
 *
 * Manages token + cached user in localStorage.
 * Works with both session auth (web) and token auth (Capacitor).
 */

import {
	apiCheckAuth,
	apiLogin,
	apiLogout,
	apiVerify,
	clearToken,
	getToken,
	setToken,
} from "./api";

export interface AuthUser {
	id: number;
	email: string;
	timezone: string;
}

const USER_KEY = "kitty-timer-user";

export function getCachedUser(): AuthUser | null {
	const raw = localStorage.getItem(USER_KEY);
	if (!raw) return null;
	try {
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

function setCachedUser(user: AuthUser): void {
	localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearCachedUser(): void {
	localStorage.removeItem(USER_KEY);
}

/** Synchronous check — true if we have a token or cached user. */
export function isLoggedIn(): boolean {
	return !!getToken() || !!getCachedUser();
}

/**
 * Async auth check — calls server, caches user on success.
 * Returns the user or null if not authenticated.
 */
export async function checkAuth(): Promise<AuthUser | null> {
	try {
		const data = await apiCheckAuth();
		setCachedUser(data.user);
		return data.user;
	} catch {
		return getCachedUser();
	}
}

/** Send magic link email. */
export async function login(email: string): Promise<void> {
	await apiLogin(email);
}

/** Verify code, store token + user. */
export async function verify(
	code: string,
	deviceLabel?: string,
): Promise<AuthUser> {
	const data = await apiVerify(code, deviceLabel);
	if (data.apiToken) {
		setToken(data.apiToken);
	}
	setCachedUser(data.user);
	return data.user;
}

/** Logout — clear everything. */
export async function logout(): Promise<void> {
	try {
		await apiLogout();
	} catch {
		/* best effort */
	}
	clearToken();
	clearCachedUser();
}
