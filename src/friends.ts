/**
 * Friends view — loads friend data from API and renders into the DOM.
 */

import {
	apiAddFriend,
	apiFriends,
	apiRemoveFriend,
	apiUpdateToggles,
} from "./api";
import { showView } from "./nav";
import { ensurePushSubscription } from "./push";

const $ = (sel: string) => document.querySelector(sel) as HTMLElement;

interface Friend {
	id: number;
	userId: number;
	email: string;
	timezone: string;
	notifyThem: boolean;
	notifyMe: boolean;
	isMeditating: boolean;
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
			msgEl.textContent =
				err instanceof Error ? err.message : "Failed to add friend.";
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

function renderFriends(friends: Friend[]): void {
	const container = $("#friends-list");

	if (friends.length === 0) {
		container.innerHTML =
			'<p class="empty-state">No friends yet. Add someone above!</p>';
		return;
	}

	container.innerHTML = friends
		.map(
			(f) => `
		<div class="friend-card" data-id="${f.id}">
			<div class="friend-info">
				<span class="friend-email">${esc(f.email)}</span>
				${f.isMeditating ? '<span class="friend-meditating">meditating</span>' : ""}
				<span class="friend-tz">${esc(f.timezone)}</span>
			</div>
			<div class="friend-actions">
				<label class="toggle-label">
					<input type="checkbox" class="toggle-notify-them" ${f.notifyThem ? "checked" : ""} />
					Notify them
				</label>
				<label class="toggle-label">
					<input type="checkbox" class="toggle-notify-me" ${f.notifyMe ? "checked" : ""} />
					Notify me
				</label>
				<button type="button" class="remove-friend-btn">Remove</button>
			</div>
		</div>`,
		)
		.join("");

	/* wire toggle + remove handlers */
	for (const card of container.querySelectorAll<HTMLElement>(".friend-card")) {
		const id = Number(card.dataset.id);

		card
			.querySelector(".toggle-notify-them")
			?.addEventListener("change", (e) => {
				const checked = (e.target as HTMLInputElement).checked;
				apiUpdateToggles(id, "notifyThem", checked);
			});

		card.querySelector(".toggle-notify-me")?.addEventListener("change", (e) => {
			const checked = (e.target as HTMLInputElement).checked;
			if (checked) ensurePushSubscription();
			apiUpdateToggles(id, "notifyMe", checked);
		});

		card
			.querySelector(".remove-friend-btn")
			?.addEventListener("click", async () => {
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
			${
				isReceived
					? `<button type="button" class="accept-btn glow-btn glow-btn--sm">Accept</button>`
					: ""
			}
			<button type="button" class="remove-pending-btn">Cancel</button>
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

		card
			.querySelector(".remove-pending-btn")
			?.addEventListener("click", async () => {
				await apiRemoveFriend(id);
				await loadFriends();
			});
	}
}

/** Navigate to friends view and load data. */
export function openFriends(): void {
	showView("friends-view");
	loadFriends();
}

function esc(s: string): string {
	const el = document.createElement("span");
	el.textContent = s;
	return el.innerHTML;
}
