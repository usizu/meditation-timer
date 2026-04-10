/**
 * Profile view — displays user info, timezone picker, logout.
 */

import { apiProfile, apiUpdateProfile } from "./api";
import { getCachedUser, logout } from "./auth";
import { showView } from "./nav";
import {
	EFFECTS,
	loadSettings,
	previewEffect,
	saveSettings,
} from "./notification-sounds";

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

	/* ── Notification sound settings ── */
	const soundEnabled = $("#notif-sound-enabled") as HTMLInputElement;
	const soundOptions = $("#notif-sound-options");
	const effectSelect = $("#notif-effect") as HTMLSelectElement;
	const previewBtn = $("#notif-preview-btn");
	const volumeSlider = $("#notif-volume") as HTMLInputElement;

	/* Populate effect dropdown */
	for (const fx of EFFECTS) {
		const opt = document.createElement("option");
		opt.value = fx.name;
		opt.textContent = fx.label;
		effectSelect.appendChild(opt);
	}

	/* Load saved settings */
	const saved = loadSettings();
	soundEnabled.checked = saved.enabled;
	effectSelect.value = saved.effect;
	volumeSlider.value = String(Math.round(saved.volume * 100));
	if (saved.enabled) soundOptions.classList.remove("hidden");

	/* Toggle sound on/off */
	soundEnabled.addEventListener("change", () => {
		const settings = loadSettings();
		settings.enabled = soundEnabled.checked;
		saveSettings(settings);

		if (soundEnabled.checked) {
			soundOptions.classList.remove("hidden");
		} else {
			soundOptions.classList.add("hidden");
		}
	});

	/* Change effect */
	effectSelect.addEventListener("change", () => {
		const settings = loadSettings();
		settings.effect = effectSelect.value;
		saveSettings(settings);
	});

	/* Preview button */
	previewBtn.addEventListener("click", () => {
		const vol = Number(volumeSlider.value) / 100;
		previewEffect(effectSelect.value, vol);
	});

	/* Volume slider */
	volumeSlider.addEventListener("input", () => {
		const settings = loadSettings();
		settings.volume = Number(volumeSlider.value) / 100;
		saveSettings(settings);
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
