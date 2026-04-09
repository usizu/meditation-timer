/**
 * Profile view — displays user info, timezone picker, logout.
 */

import { apiProfile, apiUpdateProfile } from "./api";
import { getCachedUser, logout } from "./auth";
import { showView } from "./nav";

const $ = (sel: string) => document.querySelector(sel) as HTMLElement;

export function initProfile(): void {
	const tzSelect = $("#profile-timezone") as HTMLSelectElement;
	const logoutBtn = $("#logout-btn");

	/* Populate timezone options */
	const zones = Intl.supportedValuesOf("timeZone");
	for (const tz of zones) {
		const opt = document.createElement("option");
		opt.value = tz;
		opt.textContent = tz.replace(/_/g, " ");
		tzSelect.appendChild(opt);
	}

	tzSelect.addEventListener("change", async () => {
		try {
			await apiUpdateProfile({ timezone: tzSelect.value });
		} catch {
			/* non-critical */
		}
	});

	logoutBtn.addEventListener("click", async () => {
		await logout();
		showView("home-view");
	});
}

export async function loadProfile(): Promise<void> {
	const emailEl = $("#profile-email");
	const tzSelect = $("#profile-timezone") as HTMLSelectElement;

	/* Show cached data immediately */
	const cached = getCachedUser();
	if (cached) {
		emailEl.textContent = cached.email;
		tzSelect.value = cached.timezone;
	}

	/* Fetch fresh data */
	try {
		const data = await apiProfile();
		emailEl.textContent = data.user.email;
		tzSelect.value = data.user.timezone;
	} catch {
		/* use cached */
	}
}

export function openProfile(): void {
	showView("profile-view");
	loadProfile();
}
