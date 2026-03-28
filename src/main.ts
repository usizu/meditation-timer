import * as audio from "./audio";
import { initStarfield } from "./canvas";
import { saveSession } from "./storage";
import type { TimerState } from "./timer";
import { Timer } from "./timer";
import {
	releaseWakeLock,
	requestWakeLock,
	setupWakeLockReacquire,
} from "./wakelock";
import "./styles/main.scss";

/* ── Elements ── */
const $ = (sel: string) => document.querySelector(sel) as HTMLElement;

const homeView = $("#home-view");
const sessionView = $("#session-view");
const doneView = $("#done-view");

const presetBtns = document.querySelectorAll<HTMLButtonElement>(".preset");
const customInput = $("#custom-minutes") as HTMLInputElement;
const startBtn = $("#start-btn");

const timerText = $("#timer-text");
const ringProgress = document.querySelector(
	"#ring-progress",
) as SVGCircleElement;
const pauseBtn = $("#pause-btn");
const stopBtn = $("#stop-btn");

const doneSummary = $("#done-summary");
const homeBtn = $("#home-btn");

/* ── State ── */
let selectedMinutes = 5;
const RING_CIRCUMFERENCE = 2 * Math.PI * 90; /* r=90 from SVG */

ringProgress.style.strokeDasharray = `${RING_CIRCUMFERENCE}`;
ringProgress.style.strokeDashoffset = `${RING_CIRCUMFERENCE}`;

/* ── Starfield ── */
const starfieldEl = document.querySelector("#starfield") as HTMLCanvasElement;
initStarfield(starfieldEl);

/* ── View transitions ── */
function showView(view: HTMLElement): void {
	for (const v of [homeView, sessionView, doneView]) {
		v.classList.remove("active");
	}
	view.classList.add("active");
}

/* ── Timer ── */
const timer = new Timer({
	onTick(remainingMs: number, progress: number) {
		updateDisplay(remainingMs);
		updateRing(progress);
	},
	onComplete() {
		onSessionComplete(true);
	},
	onStateChange(state: TimerState) {
		if (state === "running") {
			pauseBtn.textContent = "Pause";
		} else if (state === "paused") {
			pauseBtn.textContent = "Resume";
		}
	},
});

function formatTime(ms: number): string {
	const totalSec = Math.ceil(ms / 1000);
	const min = Math.floor(totalSec / 60);
	const sec = totalSec % 60;
	return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function updateDisplay(ms: number): void {
	timerText.textContent = formatTime(ms);
}

function updateRing(progress: number): void {
	const offset = RING_CIRCUMFERENCE * (1 - progress);
	ringProgress.style.strokeDashoffset = `${offset}`;
}

/* ── Session lifecycle ── */
function startSession(): void {
	showView(sessionView);
	timer.setDuration(selectedMinutes);
	updateDisplay(selectedMinutes * 60 * 1000);
	updateRing(0);

	audio.create(selectedMinutes, {
		onTick(curSec, durSec) {
			timer.handleTick(curSec, durSec);
		},
		onEnded() {
			timer.handleComplete();
		},
		onPause() {
			timer.setState("paused");
		},
		onPlay() {
			timer.setState("running");
		},
	});

	audio.setupMediaSession(`${selectedMinutes} min meditation`, () => {
		audio.destroy();
		onSessionComplete(false);
	});

	audio.play();
	timer.setState("running");
	requestWakeLock();
}

function onSessionComplete(completed: boolean): void {
	const remainingMs = timer.getRemainingMs();
	const durationMs = timer.getDurationMs();

	audio.destroy();
	releaseWakeLock();

	if (completed) {
		audio.playChime();
	}

	const elapsedMs = durationMs - remainingMs;
	const elapsedMin = Math.round(elapsedMs / 60000);

	saveSession({
		date: new Date().toISOString(),
		durationMinutes: selectedMinutes,
		completedMinutes: elapsedMin,
		completed,
	});

	doneSummary.textContent = completed
		? `You meditated for ${selectedMinutes} minute${selectedMinutes !== 1 ? "s" : ""}.`
		: `Session ended after ${elapsedMin} minute${elapsedMin !== 1 ? "s" : ""}.`;

	showView(doneView);
}

/* ── Event listeners ── */
for (const btn of presetBtns) {
	btn.addEventListener("click", () => {
		for (const b of presetBtns) b.classList.remove("active");
		btn.classList.add("active");
		customInput.value = "";
		selectedMinutes = Number(btn.dataset.minutes);
	});
}

customInput.addEventListener("input", () => {
	const val = Number(customInput.value);
	if (val > 0) {
		for (const b of presetBtns) b.classList.remove("active");
		selectedMinutes = Math.min(180, val);
	}
});

function stepCustom(delta: number): void {
	const cur = Number(customInput.value) || 0;
	const next = Math.max(1, Math.min(180, cur + delta));
	customInput.value = String(next);
	customInput.dispatchEvent(new Event("input"));
}

$(".stepper-btn--dec").addEventListener("click", () => stepCustom(-1));
$(".stepper-btn--inc").addEventListener("click", () => stepCustom(1));

startBtn.addEventListener("click", startSession);

pauseBtn.addEventListener("click", () => {
	if (timer.getState() === "running") {
		audio.pause();
	} else if (timer.getState() === "paused") {
		audio.play();
	}
});

stopBtn.addEventListener("click", () => {
	audio.destroy();
	onSessionComplete(false);
});

homeBtn.addEventListener("click", () => {
	showView(homeView);
	updateRing(0);
});

/* ── Wake lock reacquire ── */
setupWakeLockReacquire(() => timer.getState() === "running");
