/**
 * View navigation — toggles .active on view divs.
 * Auth-gates friends/profile views, redirecting to login if needed.
 */

import { isLoggedIn } from "./auth";

const allViews = () => document.querySelectorAll<HTMLElement>(".view");

let returnTo: string | null = null;
let onReturnCallback: (() => void) | null = null;
let currentView: string | null = null;
const leaveCallbacks = new Map<string, () => void>();

/** Register a callback to run when leaving a specific view. */
export function onLeaveView(viewId: string, callback: () => void): void {
	leaveCallbacks.set(viewId, callback);
}

export function showView(id: string): void {
	if (currentView && currentView !== id) {
		leaveCallbacks.get(currentView)?.();
	}
	currentView = id;
	for (const v of allViews()) {
		v.classList.toggle("active", v.id === id);
	}
}

export function showViewEl(el: HTMLElement): void {
	for (const v of allViews()) {
		v.classList.toggle("active", v === el);
	}
}

/**
 * Navigate to a view, auth-gating social views.
 * If not logged in, shows login, stores returnTo, and runs onReady after login.
 */
export function navigateTo(viewId: string, onReady?: () => void): boolean {
	const needsAuth = viewId === "friends-view" || viewId === "profile-view";

	if (needsAuth && !isLoggedIn()) {
		returnTo = viewId;
		onReturnCallback = onReady ?? null;
		showView("login-view");
		return false;
	}

	showView(viewId);
	onReady?.();
	return true;
}

/** After successful login, navigate to the original destination or home. */
export function completeLogin(): void {
	const dest = returnTo || "home-view";
	const cb = onReturnCallback;
	returnTo = null;
	onReturnCallback = null;
	showView(dest);
	cb?.();
}

/** Wire up all back buttons. */
export function initBackButtons(): void {
	for (const btn of document.querySelectorAll<HTMLButtonElement>(".back-btn")) {
		btn.addEventListener("click", () => {
			const target = btn.dataset.back;
			showView(target ? `${target}-view` : "home-view");
		});
	}
}
