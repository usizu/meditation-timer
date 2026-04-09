/**
 * Login view — email form, code verification.
 */

import { login, verify } from "./auth";
import { completeLogin } from "./nav";

const $ = (sel: string) => document.querySelector(sel) as HTMLElement;

export function initLogin(): void {
	const emailForm = $("#login-email-form") as HTMLFormElement;
	const codeForm = $("#login-code-form") as HTMLFormElement;
	const emailInput = $("#login-email") as HTMLInputElement;
	const codeInput = $("#login-code") as HTMLInputElement;
	const errorEl = $("#login-error");

	function showError(msg: string): void {
		errorEl.textContent = msg;
		errorEl.classList.remove("hidden");
	}

	function hideError(): void {
		errorEl.classList.add("hidden");
	}

	emailForm.addEventListener("submit", async (e) => {
		e.preventDefault();
		hideError();
		const email = emailInput.value.trim().toLowerCase();
		if (!email) return;

		try {
			await login(email);
			emailForm.classList.add("hidden");
			codeForm.classList.remove("hidden");
			codeInput.focus();
		} catch (err: unknown) {
			showError(err instanceof Error ? err.message : "Failed to send code.");
		}
	});

	codeForm.addEventListener("submit", async (e) => {
		e.preventDefault();
		hideError();
		const code = codeInput.value.trim();
		if (!code) return;

		try {
			await verify(code);
			/* Reset forms for next time */
			emailForm.classList.remove("hidden");
			codeForm.classList.add("hidden");
			emailInput.value = "";
			codeInput.value = "";
			completeLogin();
		} catch (err: unknown) {
			showError(
				err instanceof Error ? err.message : "Invalid or expired code.",
			);
		}
	});
}
