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
	const resendBtn = $("#login-resend-btn");
	const changeEmailBtn = $("#login-change-email-btn");

	function showError(msg: string): void {
		errorEl.textContent = msg;
		errorEl.classList.remove("hidden");
	}

	function hideError(): void {
		errorEl.classList.add("hidden");
	}

	function showEmailForm(): void {
		hideError();
		codeForm.classList.add("hidden");
		emailForm.classList.remove("hidden");
		codeInput.value = "";
		emailInput.focus();
	}

	async function sendCode(): Promise<void> {
		const email = emailInput.value.trim().toLowerCase();
		if (!email) return;

		await login(email);
		emailForm.classList.add("hidden");
		codeForm.classList.remove("hidden");
		codeInput.value = "";
		codeInput.focus();
	}

	emailForm.addEventListener("submit", async (e) => {
		e.preventDefault();
		hideError();
		try {
			await sendCode();
		} catch (err: unknown) {
			showError(err instanceof Error ? err.message : "Failed to send code.");
		}
	});

	resendBtn.addEventListener("click", async () => {
		hideError();
		try {
			await sendCode();
		} catch (err: unknown) {
			showError(err instanceof Error ? err.message : "Failed to resend code.");
		}
	});

	changeEmailBtn.addEventListener("click", showEmailForm);

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
