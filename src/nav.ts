/**
 * View navigation — toggles .active on view divs.
 * Auth-gates friends/profile views, redirecting to login if needed.
 */

import { isLoggedIn } from "./auth";

const allViews = () => document.querySelectorAll<HTMLElement>(".view");

let returnTo: string | null = null;

export function showView(id: string): void {
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
 * If not logged in, shows login and stores returnTo.
 */
export function navigateTo(viewId: string): void {
	const needsAuth = viewId === "friends-view" || viewId === "profile-view";

	if (needsAuth && !isLoggedIn()) {
		returnTo = viewId;
		showView("login-view");
		return;
	}

	showView(viewId);
}

/** After successful login, navigate to the original destination or home. */
export function completeLogin(): void {
	const dest = returnTo || "home-view";
	returnTo = null;
	showView(dest);
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
