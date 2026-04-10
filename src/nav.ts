/**
 * View navigation — toggles .active on view divs.
 * Auth-gates friends/profile views, redirecting to login if needed.
 */

import { isLoggedIn } from "./auth";

const allViews = () => document.querySelectorAll<HTMLElement>(".view");
const allNavBtns = () =>
	document.querySelectorAll<HTMLButtonElement>(".nav-btn[data-view]");

let returnTo: string | null = null;
let onReturnCallback: (() => void) | null = null;
let currentView: string | null = null;
const leaveCallbacks = new Map<string, () => void>();

/** Map of view IDs that each nav button "owns" (including sub-views). */
const navViewMap = new Map<string, string[]>([
	["home-view", ["home-view", "session-view", "done-view"]],
	["friends-view", ["friends-view"]],
	["profile-view", ["profile-view", "settings-view"]],
]);

function syncNavActive(activeViewId: string): void {
	for (const btn of allNavBtns()) {
		const viewId = btn.dataset.view ?? "";
		const ownedViews = navViewMap.get(viewId) ?? [viewId];
		btn.classList.toggle("active", ownedViews.includes(activeViewId));
	}
}

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
	syncNavActive(id);
}

export function showViewEl(el: HTMLElement): void {
	for (const v of allViews()) {
		v.classList.toggle("active", v === el);
	}
	if (el.id) syncNavActive(el.id);
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
