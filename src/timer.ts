/**
 * Timer — thin state wrapper around the audio-driven session.
 *
 * The audio element owns elapsed time. This class tracks UI state
 * and converts audio seconds into the remaining-ms / progress values
 * the UI needs.
 */

export type TimerState = "idle" | "running" | "paused" | "done";

export interface TimerCallbacks {
	onTick: (remainingMs: number, progress: number) => void;
	onComplete: () => void;
	onStateChange: (state: TimerState) => void;
}

export class Timer {
	private state: TimerState = "idle";
	private durationSec = 0;
	private currentSec = 0;
	private callbacks: TimerCallbacks;

	constructor(callbacks: TimerCallbacks) {
		this.callbacks = callbacks;
	}

	setDuration(minutes: number): void {
		this.durationSec = minutes * 60;
		this.currentSec = 0;
	}

	setState(state: TimerState): void {
		if (this.state === state) return;
		this.state = state;
		this.callbacks.onStateChange(state);
	}

	/** Called on every rAF tick from the audio module. */
	handleTick(currentSec: number, durationSec: number): void {
		this.currentSec = currentSec;
		this.durationSec = durationSec;
		const remainingMs = Math.max(0, (durationSec - currentSec) * 1000);
		const progress = durationSec > 0 ? currentSec / durationSec : 0;
		this.callbacks.onTick(remainingMs, progress);
	}

	handleComplete(): void {
		this.currentSec = this.durationSec;
		this.setState("done");
		this.callbacks.onComplete();
	}

	getState(): TimerState {
		return this.state;
	}

	getDurationMs(): number {
		return this.durationSec * 1000;
	}

	getRemainingMs(): number {
		return Math.max(0, (this.durationSec - this.currentSec) * 1000);
	}
}
