/**
 * Friends view — loads friend data from API and renders into the DOM.
 */

import { apiAddFriend, apiFriends, apiRemoveFriend, apiUpdateToggles } from "./api";
import { getCachedUser } from "./auth";
import { showView } from "./nav";
import { ensurePushSubscription } from "./push";
import { closeSse, connectSse, onSseEvent } from "./sse";

const $ = (sel: string) => document.querySelector(sel) as HTMLElement;

interface Friend {
	id: number;
	userId: number;
	email: string;
	nickname: string | null;
	timezone: string;
	practice: string | null;
	notifyThem: boolean;
	notifyMe: boolean;
	isMeditating: boolean;
	isOnline: boolean;
}

interface PendingItem {
	id: number;
	email: string;
}

export function initFriends(): void {
	const form = $("#add-friend-form") as HTMLFormElement;
	const emailInput = $("#add-friend-email") as HTMLInputElement;
	const msgEl = $("#friend-msg");

	form.addEventListener("submit", async (e) => {
		e.preventDefault();
		const email = emailInput.value.trim().toLowerCase();
		if (!email) return;

		try {
			const data = await apiAddFriend(email);
			msgEl.textContent = data.message;
			msgEl.classList.remove("hidden");
			emailInput.value = "";
			await loadFriends();
		} catch (err: unknown) {
			msgEl.textContent = err instanceof Error ? err.message : "Failed to add friend.";
			msgEl.classList.remove("hidden");
		}
	});
}

export async function loadFriends(): Promise<void> {
	try {
		const data = await apiFriends();
		renderFriends(data.friends);
		renderPending("pending-received", data.pendingReceived, true);
		renderPending("pending-sent", data.pendingSent, false);
	} catch {
		/* non-critical — view shows stale or empty */
	}
}

/**
 * Compute the current local time for a given IANA timezone,
 * plus a human-readable offset relative to the viewer's timezone.
 * Also returns whether it's day or night (6am–6pm = day).
 */
function friendTimeInfo(friendTz: string, myTz: string) {
	const now = Date.now();
	const friendHour = hourInTz(friendTz, now);

	const localTime = new Intl.DateTimeFormat(undefined, {
		timeZone: friendTz,
		hour: "numeric",
		minute: "2-digit",
	}).format(now);

	const diffH = Math.round(offsetMinutes(friendTz, now) - offsetMinutes(myTz, now)) / 60;
	let offset = "";
	if (diffH === 0) {
		offset = "same time";
	} else {
		const abs = Math.abs(diffH);
		const label = abs === 1 ? "hr" : "hrs";
		offset = `${abs}${label} ${diffH > 0 ? "ahead" : "behind"}`;
	}

	const daycycle = friendHour >= 6 && friendHour < 18 ? "day" : "night";

	return { localTime, offset, daycycle };
}

function hourInTz(tz: string, now: number): number {
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone: tz,
		hour: "numeric",
		hour12: false,
	}).formatToParts(new Date(now));
	return Number(parts.find((p) => p.type === "hour")?.value ?? 0);
}

function offsetMinutes(tz: string, now: number): number {
	const fmt = new Intl.DateTimeFormat("en-US", {
		timeZone: tz,
		timeZoneName: "shortOffset",
	});
	const parts = fmt.formatToParts(new Date(now));
	const offsetStr = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
	const m = offsetStr.match(/GMT([+-]?\d+)(?::(\d+))?/);
	if (!m) return 0;
	const h = Number(m[1]);
	const min = Number(m[2] ?? 0);
	return h * 60 + (h < 0 ? -min : min);
}

function renderFriends(friends: Friend[]): void {
	const container = $("#friends-list");

	if (friends.length === 0) {
		container.innerHTML = '<p class="empty-state">No friends yet. Add someone above!</p>';
		return;
	}

	const myTz =
		getCachedUser()?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

	container.innerHTML = friends
		.map((f) => {
			const ti = friendTimeInfo(f.timezone, myTz);
			const displayName = f.nickname ? esc(f.nickname) : esc(f.email);
			return `
		<div class="friend-card" data-id="${f.id}" data-user-id="${f.userId}" data-daycycle="${ti.daycycle}">
			<div class="friend-info">

				<span class="friend-name"><span class="friend-online${f.isOnline ? "" : " hidden"}"></span> ${displayName}</span>
				<span class="friend-meditating${f.isMeditating ? "" : " hidden"}">meditating</span>
				<span class="friend-practice${f.practice ? "" : " hidden"}">${f.practice ? esc(f.practice) : ""}</span>
			</div>
			<div class="friend-meta">
				<span class="friend-time">${esc(ti.localTime)}</span>
				<span class="friend-offset">${esc(ti.offset)}</span>
				<span class="friend-tz">${esc(f.timezone)}</span>
			</div>
			<div class="friend-actions">
				<label class="toggle-label">
					<input type="checkbox" class="toggle-notify-them" ${f.notifyThem ? "checked" : ""} />
					Notify them when I meditate
				</label>
				<label class="toggle-label">
					<input type="checkbox" class="toggle-notify-me" ${f.notifyMe ? "checked" : ""} />
					Notify me when they meditate
				</label>
				<button type="button" class="remove-friend-btn">Remove</button>
			</div>
		</div>`;
		})
		.join("");

	/* wire toggle + remove handlers */
	for (const card of container.querySelectorAll<HTMLElement>(".friend-card")) {
		const id = Number(card.dataset.id);

		card.querySelector(".toggle-notify-them")?.addEventListener("change", (e) => {
			const checked = (e.target as HTMLInputElement).checked;
			apiUpdateToggles(id, "notifyThem", checked);
		});

		card.querySelector(".toggle-notify-me")?.addEventListener("change", (e) => {
			const checked = (e.target as HTMLInputElement).checked;
			if (checked) ensurePushSubscription();
			apiUpdateToggles(id, "notifyMe", checked);
		});

		card.querySelector(".remove-friend-btn")?.addEventListener("click", async () => {
			if (!confirm("Remove this friend?")) return;
			await apiRemoveFriend(id);
			await loadFriends();
		});
	}
}

function renderPending(
	sectionId: string,
	items: PendingItem[],
	isReceived: boolean,
): void {
	const section = $(`#${sectionId}`);
	const list = $(`#${sectionId}-list`);

	if (items.length === 0) {
		section.classList.add("hidden");
		return;
	}

	section.classList.remove("hidden");
	list.innerHTML = items
		.map(
			(p) => `
		<div class="pending-card" data-id="${p.id}">
			<span class="pending-email">${esc(p.email)}</span>
			<div class='pending-actions-container'>
			${
				isReceived
					? `<button type="button" class="accept-btn glow-btn glow-btn--sm">Accept</button>`
					: ""
			}
			<button type="button" class="remove-pending-btn">Cancel</button>
			</div>
		</div>`,
		)
		.join("");

	for (const card of list.querySelectorAll<HTMLElement>(".pending-card")) {
		const id = Number(card.dataset.id);

		card.querySelector(".accept-btn")?.addEventListener("click", async () => {
			/* accepting = adding them back, which confirms the friendship */
			const email = card.querySelector(".pending-email")?.textContent?.trim();
			if (email) {
				await apiAddFriend(email);
				await loadFriends();
			}
		});

		card.querySelector(".remove-pending-btn")?.addEventListener("click", async () => {
			await apiRemoveFriend(id);
			await loadFriends();
		});
	}
}

let sseCleanups: (() => void)[] = [];

/** Navigate to friends view and load data. */
export function openFriends(): void {
	showView("friends-view");
	loadFriends();

	/* Connect to SSE and listen for live friend updates */
	connectSse();

	sseCleanups.push(
		onSseEvent("friend:meditating", (data) => {
			const userId = data.userId as number;
			const isMeditating = data.isMeditating as boolean;
			const card = document.querySelector(`.friend-card[data-user-id="${userId}"]`);
			if (!card) return;
			const badge = card.querySelector(".friend-meditating");
			if (badge) {
				badge.classList.toggle("hidden", !isMeditating);
			}
		}),
	);

	sseCleanups.push(
		onSseEvent("friend:online", (data) => {
			const userId = data.userId as number;
			const dot = document.querySelector(
				`.friend-card[data-user-id="${userId}"] .friend-online`,
			);
			if (dot) dot.classList.remove("hidden");
		}),
	);

	sseCleanups.push(
		onSseEvent("friend:offline", (data) => {
			const userId = data.userId as number;
			const dot = document.querySelector(
				`.friend-card[data-user-id="${userId}"] .friend-online`,
			);
			if (dot) dot.classList.add("hidden");
		}),
	);
}

/** Called when leaving the friends view. */
export function leaveFriends(): void {
	for (const cleanup of sseCleanups) cleanup();
	sseCleanups = [];
	closeSse();
}

function esc(s: string): string {
	const el = document.createElement("span");
	el.textContent = s;
	return el.innerHTML;
}
