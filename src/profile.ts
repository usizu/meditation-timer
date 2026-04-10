/**
 * Profile view — displays user info, timezone picker, logout.
 */

import { apiProfile, apiUpdateProfile } from "./api";
import { getCachedUser, logout } from "./auth";
import { showView } from "./nav";

const $ = (sel: string) => document.querySelector(sel) as HTMLElement;

export function initProfile(): void {
	const tzSelect = $("#profile-timezone") as HTMLSelectElement;
	const nicknameInput = $("#profile-nickname") as HTMLInputElement;
	const statusInput = $("#profile-status") as HTMLInputElement;
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

	/* Save nickname/status on blur */
	nicknameInput.addEventListener("change", async () => {
		try {
			await apiUpdateProfile({ nickname: nicknameInput.value });
		} catch {
			/* non-critical */
		}
	});

	statusInput.addEventListener("change", async () => {
		try {
			await apiUpdateProfile({ status: statusInput.value });
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
	const nicknameInput = $("#profile-nickname") as HTMLInputElement;
	const statusInput = $("#profile-status") as HTMLInputElement;

	/* Show cached data immediately */
	const cached = getCachedUser();
	if (cached) {
		emailEl.textContent = cached.email;
		tzSelect.value = cached.timezone;
		nicknameInput.value = cached.nickname ?? "";
		statusInput.value = cached.status ?? "";
	}

	/* Fetch fresh data */
	try {
		const data = await apiProfile();
		emailEl.textContent = data.user.email;
		tzSelect.value = data.user.timezone;
		nicknameInput.value = data.user.nickname ?? "";
		statusInput.value = data.user.status ?? "";
	} catch {
		/* use cached */
	}
}

export function openProfile(): void {
	showView("profile-view");
	loadProfile();
}
