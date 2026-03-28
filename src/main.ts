import * as audio from "./audio";
import { initStarfield } from "./canvas";
import * as haptics from "./haptics";
import { loadDuration, saveDuration, saveSession } from "./storage";
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
let selectedMinutes = loadDuration();
const RING_CIRCUMFERENCE = 2 * Math.PI * 90; /* r=90 from SVG */

ringProgress.style.strokeDasharray = `${RING_CIRCUMFERENCE}`;
ringProgress.style.strokeDashoffset = `${RING_CIRCUMFERENCE}`;

/* ── Build version ── */
$("#version").textContent = __BUILD_ID__;

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
		audio.playChime();
		haptics.notifySuccess();
		onSessionComplete(true);
	},
	onStateChange(state: TimerState) {
		if (state === "running") {
			pauseBtn.textContent = "Pause";
			sessionView.classList.remove("paused");
		} else if (state === "paused") {
			pauseBtn.textContent = "Resume";
			sessionView.classList.add("paused");
		}
	},
});

function formatTime(ms: number): string {
	if (!Number.isFinite(ms)) return "";
	const totalSec = Math.ceil(ms / 1000);
	const min = Math.floor(totalSec / 60);
	const sec = totalSec % 60;
	return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function updateDisplay(ms: number): void {
	timerText.textContent = formatTime(ms);
}

const MIN_RING_PROGRESS = 0.02; /* always show a sliver */

function updateRing(progress: number): void {
	const visible = Math.max(MIN_RING_PROGRESS, progress);
	const offset = RING_CIRCUMFERENCE * (1 - visible);
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
			if (isDragging) return;
			timer.handleComplete();
		},
		onPause() {
			timer.setState("paused");
		},
		onPlay() {
			timer.setState("running");
		},
	});

	audio.play();
	timer.setState("running");
	requestWakeLock();
}

function onSessionComplete(completed: boolean): void {
	const remainingMs = timer.getRemainingMs();
	const durationMs = timer.getDurationMs();

	/* don't destroy audio here — chime may still be playing through
	   the same element. Cleanup happens on next create() or home nav. */
	releaseWakeLock();

	const elapsedMs = durationMs - remainingMs;
	const elapsedMin = Math.round(elapsedMs / 60000);

	saveSession({
		date: new Date().toISOString(),
		durationMinutes: selectedMinutes,
		completedMinutes: elapsedMin,
		completed,
	});

	doneSummary.textContent = completed
		? `${selectedMinutes} minute${selectedMinutes !== 1 ? "s" : ""} complete.`
		: `Session ended after ${elapsedMin} minute${elapsedMin !== 1 ? "s" : ""}.`;

	showView(doneView);
}

/* ── Restore saved duration into UI ── */
customInput.value = String(selectedMinutes);
for (const b of presetBtns) {
	b.classList.toggle("active", Number(b.dataset.minutes) === selectedMinutes);
}

/* ── Event listeners ── */
for (const btn of presetBtns) {
	btn.addEventListener("click", () => {
		for (const b of presetBtns) b.classList.remove("active");
		btn.classList.add("active");
		selectedMinutes = Number(btn.dataset.minutes);
		customInput.value = String(selectedMinutes);
		saveDuration(selectedMinutes);
		haptics.tapLight();
	});
}

customInput.addEventListener("input", () => {
	const val = Number(customInput.value);
	if (val > 0) {
		for (const b of presetBtns) b.classList.remove("active");
		selectedMinutes = Math.min(180, val);
		saveDuration(selectedMinutes);
	}
});

function stepCustom(delta: number): void {
	const cur = Number(customInput.value) || 0;
	const next = Math.max(1, Math.min(180, cur + delta));
	customInput.value = String(next);
	customInput.dispatchEvent(new Event("input"));
	haptics.tapLight();
}

$(".stepper-btn--dec").addEventListener("click", () => stepCustom(-1));
$(".stepper-btn--inc").addEventListener("click", () => stepCustom(1));

startBtn.addEventListener("click", () => {
	haptics.tapMedium();
	startSession();
});

pauseBtn.addEventListener("click", () => {
	haptics.tapLight();
	if (timer.getState() === "running") {
		audio.pause();
	} else if (timer.getState() === "paused") {
		audio.play();
	}
});

stopBtn.addEventListener("click", () => {
	haptics.tapMedium();
	audio.destroy();
	releaseWakeLock();
	sessionView.classList.remove("paused");
	showView(homeView);
	updateRing(0);
});

homeBtn.addEventListener("click", () => {
	haptics.tapLight();
	audio.destroy();
	showView(homeView);
	updateRing(0);
});

/* ── Touch-drag scrubbing with inertia ── */
const SNAP_SECONDS = 60;
const HAPTIC_MIN_INTERVAL = 20;
let DRAG_SENS_X = 1; /* horizontal multiplier — adjustable via dev bar */
let DRAG_SENS_Y = 1.5; /* vertical multiplier — adjustable via dev bar */
const INERTIA_FRICTION = 0.92; /* per-frame velocity multiplier */
const INERTIA_STOP = 0.5; /* px/frame — stop threshold */

let dragStartX = 0;
let dragStartY = 0;
let dragStartTime = 0;
let isDragging = false;
let dragTarget = 0;
let dragRafPending = false;
let lastSnapSec = -1;
let lastHapticTime = 0;
let dragAxis: "x" | "y" | null = null;
let dragRange = 0; /* px — available drag distance from start to edge */
const AXIS_LOCK_THRESHOLD = 8; /* px — lock axis after this much movement */

/* velocity tracking for inertia */
let lastTouchX = 0;
let lastTouchY = 0;
let lastTouchTime = 0;
let velocityX = 0;
let velocityY = 0;
let inertiaRafId = 0;

function computeSnap(rawTarget: number): number {
	const dur = audio.getDuration();
	/* lock with 1 minute remaining — can't scrub past dur-60 */
	const clamped = Math.max(0, Math.min(dur - 60, rawTarget));
	return Math.round(clamped / SNAP_SECONDS) * SNAP_SECONDS;
}

function fireSnapHaptic(snapped: number): void {
	if (snapped !== lastSnapSec) {
		lastSnapSec = snapped;
		const now = performance.now();
		if (now - lastHapticTime >= HAPTIC_MIN_INTERVAL) {
			lastHapticTime = now;
			haptics.tapLight();
		}
	}
}

function snapAndSeek(rawTarget: number): void {
	dragTarget = computeSnap(rawTarget);
	audio.seekDrag(dragTarget);
	fireSnapHaptic(dragTarget);
}

function applyDragSeek(): void {
	dragTarget = computeSnap(dragTarget);
	audio.seekDrag(dragTarget);
	dragRafPending = false;
}

function inertiaStep(): void {
	velocityX *= INERTIA_FRICTION;
	velocityY *= INERTIA_FRICTION;

	if (
		Math.abs(velocityX) < INERTIA_STOP &&
		Math.abs(velocityY) < INERTIA_STOP
	) {
		sessionView.classList.remove("dragging");
		return;
	}

	const dur = audio.getDuration();
	const sens = dragAxis === "x" ? DRAG_SENS_X : DRAG_SENS_Y;
	const vel = dragAxis === "x" ? velocityX : velocityY;
	const delta = (vel / dragRange) * dur * sens;

	dragStartTime += delta;
	snapAndSeek(dragStartTime);

	inertiaRafId = requestAnimationFrame(inertiaStep);
}

sessionView.addEventListener("touchstart", (e) => {
	if ((e.target as Element).closest(".session-controls")) return;

	/* cancel any running inertia */
	cancelAnimationFrame(inertiaRafId);

	const t = e.touches[0];
	dragStartX = t.clientX;
	dragStartY = t.clientY;
	lastTouchX = t.clientX;
	lastTouchY = t.clientY;
	lastTouchTime = performance.now();
	velocityX = 0;
	velocityY = 0;
	dragStartTime = audio.getCurrentTime();
	isDragging = true;
	dragAxis = null;
	lastSnapSec = -1;
	sessionView.classList.add("dragging");
	haptics.tapHeavy();
	lastHapticTime = performance.now();
});

sessionView.addEventListener(
	"touchmove",
	(e) => {
		if (!isDragging) return;
		e.preventDefault();

		const t = e.touches[0];
		const now = performance.now();

		/* track velocity for inertia */
		const dt = now - lastTouchTime;
		if (dt > 0) {
			velocityX = t.clientX - lastTouchX;
			velocityY = t.clientY - lastTouchY;
		}
		lastTouchX = t.clientX;
		lastTouchY = t.clientY;
		lastTouchTime = now;

		const dx = t.clientX - dragStartX;
		const dy = t.clientY - dragStartY;
		const dur = audio.getDuration();

		/* lock axis after first significant movement */
		if (!dragAxis) {
			if (
				Math.abs(dx) < AXIS_LOCK_THRESHOLD &&
				Math.abs(dy) < AXIS_LOCK_THRESHOLD
			) {
				return;
			}
			dragAxis = Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
			/* compute drag range: distance from start to the farthest edge */
			dragRange =
				dragAxis === "x"
					? Math.max(dragStartX, window.innerWidth - dragStartX)
					: Math.max(dragStartY, window.innerHeight - dragStartY);
		}

		/* map drag pixels to % of duration (center-to-edge = 100%) */
		const sens = dragAxis === "x" ? DRAG_SENS_X : DRAG_SENS_Y;
		const delta = ((dragAxis === "x" ? dx : dy) / dragRange) * dur * sens;

		const raw = dragStartTime + delta;
		dragTarget = raw;

		/* fire haptic immediately in touchmove, not deferred to RAF */
		fireSnapHaptic(computeSnap(raw));

		if (!dragRafPending) {
			dragRafPending = true;
			requestAnimationFrame(applyDragSeek);
		}
	},
	{ passive: false },
);

sessionView.addEventListener("touchend", () => {
	if (!isDragging) return;
	isDragging = false;

	/* kick off inertia if finger was moving fast enough */
	if (
		Math.abs(velocityX) > INERTIA_STOP ||
		Math.abs(velocityY) > INERTIA_STOP
	) {
		dragStartTime = dragTarget;
		inertiaRafId = requestAnimationFrame(inertiaStep);
	} else {
		sessionView.classList.remove("dragging");
	}
});

/* ── Dev bar — drag sensitivity tuning (H / V) ── */
const devBar = document.createElement("div");
devBar.className = "dev-bar";
const sensValues = [0.5, 0.75, 1, 1.25, 1.5, 2];

function makeRow(
	label: string,
	current: number,
	onSet: (v: number) => void,
): HTMLDivElement {
	const row = document.createElement("div");
	row.className = "dev-row";
	const lbl = document.createElement("span");
	lbl.textContent = label;
	row.appendChild(lbl);
	for (const s of sensValues) {
		const btn = document.createElement("button");
		btn.textContent = `${s}`;
		if (s === current) btn.classList.add("active");
		btn.addEventListener("click", () => {
			onSet(s);
			for (const b of row.querySelectorAll("button")) {
				b.classList.remove("active");
			}
			btn.classList.add("active");
			haptics.tapLight();
		});
		row.appendChild(btn);
	}
	return row;
}

devBar.appendChild(
	makeRow("H", DRAG_SENS_X, (v) => {
		DRAG_SENS_X = v;
	}),
);
devBar.appendChild(
	makeRow("V", DRAG_SENS_Y, (v) => {
		DRAG_SENS_Y = v;
	}),
);
document.getElementById("app")?.appendChild(devBar);

/* ── Wake lock reacquire ── */
setupWakeLockReacquire(() => timer.getState() === "running");
