/**
 * Audio module — the audio element is the source of truth for session time.
 *
 * A silent WAV matching the exact timer duration is generated so the
 * lockscreen progress bar, scrubber, and skip controls map 1:1 to the
 * meditation timer. The rAF loop polls audio.currentTime for smooth UI.
 */

let audioEl: HTMLAudioElement | null = null;
let audioUrl: string | null = null;
let audioCtx: AudioContext | null = null;
let rafId = 0;
let lastPositionUpdate = 0;

let onTickCb: ((curSec: number, durSec: number) => void) | null = null;
let onEndedCb: (() => void) | null = null;
let onPauseCb: (() => void) | null = null;
let onPlayCb: (() => void) | null = null;

/* ── Silent WAV generation ── */

function writeStr(view: DataView, offset: number, str: string): void {
	for (let i = 0; i < str.length; i++) {
		view.setUint8(offset + i, str.charCodeAt(i));
	}
}

/**
 * 8 kHz · 8-bit · mono — keeps blobs small:
 *   5 min ≈ 2.4 MB, 30 min ≈ 14 MB
 * 8-bit unsigned PCM silence = 128
 */
function createSilentWav(durationSeconds: number): Blob {
	const sampleRate = 8000;
	const numSamples = Math.ceil(sampleRate * durationSeconds);
	const dataSize = numSamples;
	const buf = new ArrayBuffer(44 + dataSize);
	const v = new DataView(buf);
	const bytes = new Uint8Array(buf);

	writeStr(v, 0, "RIFF");
	v.setUint32(4, 36 + dataSize, true);
	writeStr(v, 8, "WAVE");
	writeStr(v, 12, "fmt ");
	v.setUint32(16, 16, true);
	v.setUint16(20, 1, true); /* PCM */
	v.setUint16(22, 1, true); /* mono */
	v.setUint32(24, sampleRate, true);
	v.setUint32(28, sampleRate, true); /* byteRate */
	v.setUint16(32, 1, true); /* blockAlign */
	v.setUint16(34, 8, true); /* bitsPerSample */
	writeStr(v, 36, "data");
	v.setUint32(40, dataSize, true);

	bytes.fill(128, 44); /* 128 = silence for unsigned 8-bit */

	return new Blob([buf], { type: "audio/wav" });
}

/* ── Playback control ── */

export interface SessionAudioCallbacks {
	onTick: (currentSec: number, durationSec: number) => void;
	onEnded: () => void;
	onPause: () => void;
	onPlay: () => void;
}

function tick(): void {
	if (audioEl && onTickCb && !audioEl.paused) {
		onTickCb(audioEl.currentTime, audioEl.duration);

		const now = performance.now();
		if (now - lastPositionUpdate > 1000) {
			updatePositionState();
			lastPositionUpdate = now;
		}
	}
	rafId = requestAnimationFrame(tick);
}

export function create(
	durationMinutes: number,
	cbs: SessionAudioCallbacks,
): void {
	destroy();

	onTickCb = cbs.onTick;
	onEndedCb = cbs.onEnded;
	onPauseCb = cbs.onPause;
	onPlayCb = cbs.onPlay;

	const blob = createSilentWav(durationMinutes * 60);
	audioUrl = URL.createObjectURL(blob);

	audioEl = new Audio(audioUrl);
	audioEl.volume = 0.01; /* near-silent — nonzero so OS treats as active */

	audioEl.addEventListener("ended", () => onEndedCb?.());
	audioEl.addEventListener("pause", () => {
		cancelAnimationFrame(rafId);
		updatePositionState();
		onPauseCb?.();
	});
	audioEl.addEventListener("play", () => {
		lastPositionUpdate = 0;
		rafId = requestAnimationFrame(tick);
		onPlayCb?.();
	});
}

export function play(): Promise<void> {
	return audioEl?.play() ?? Promise.resolve();
}

export function pause(): void {
	audioEl?.pause();
}

export function seekTo(timeSec: number): void {
	if (!audioEl || !Number.isFinite(audioEl.duration)) return;
	audioEl.currentTime = Math.max(0, Math.min(timeSec, audioEl.duration));
	updatePositionState();
	onTickCb?.(audioEl.currentTime, audioEl.duration);
}

export function seekBy(deltaSec: number): void {
	if (!audioEl) return;
	seekTo(audioEl.currentTime + deltaSec);
}

export function getCurrentTime(): number {
	return audioEl?.currentTime ?? 0;
}

export function getDuration(): number {
	return audioEl?.duration ?? 0;
}

export function destroy(): void {
	/* null callbacks before pausing so the pause-event handler is a no-op */
	onTickCb = null;
	onEndedCb = null;
	onPauseCb = null;
	onPlayCb = null;

	cancelAnimationFrame(rafId);
	clearMediaSession();

	if (audioEl) {
		audioEl.pause();
		audioEl.removeAttribute("src");
		audioEl.load();
		audioEl = null;
	}
	if (audioUrl) {
		URL.revokeObjectURL(audioUrl);
		audioUrl = null;
	}
}

/* ── Media Session (lockscreen controls) ── */

const SEEK_STEP = 30;

export function setupMediaSession(title: string, onStop: () => void): void {
	if (!("mediaSession" in navigator)) return;

	navigator.mediaSession.metadata = new MediaMetadata({
		title,
		artist: "Cosmic Timer",
		album: "Meditation",
	});

	navigator.mediaSession.setActionHandler("play", () => play());
	navigator.mediaSession.setActionHandler("pause", () => pause());
	navigator.mediaSession.setActionHandler("stop", onStop);
	navigator.mediaSession.setActionHandler("seekforward", (d) => {
		seekBy(d.seekOffset ?? SEEK_STEP);
	});
	navigator.mediaSession.setActionHandler("seekbackward", (d) => {
		seekBy(-(d.seekOffset ?? SEEK_STEP));
	});
	navigator.mediaSession.setActionHandler("seekto", (d) => {
		if (d.seekTime != null) seekTo(d.seekTime);
	});

	updatePositionState();
}

function updatePositionState(): void {
	if (
		!("mediaSession" in navigator) ||
		!audioEl ||
		!Number.isFinite(audioEl.duration)
	)
		return;
	try {
		navigator.mediaSession.setPositionState({
			duration: audioEl.duration,
			playbackRate: audioEl.playbackRate,
			position: Math.min(audioEl.currentTime, audioEl.duration),
		});
	} catch {
		/* not supported on all browsers */
	}
}

function clearMediaSession(): void {
	if (!("mediaSession" in navigator)) return;
	navigator.mediaSession.metadata = null;
	const actions: MediaSessionAction[] = [
		"play",
		"pause",
		"stop",
		"seekforward",
		"seekbackward",
		"seekto",
	];
	for (const a of actions) {
		navigator.mediaSession.setActionHandler(a, null);
	}
}

/* ── Completion chime ── */

function getAudioCtx(): AudioContext {
	if (!audioCtx) audioCtx = new AudioContext();
	return audioCtx;
}

export function playChime(): void {
	const ctx = getAudioCtx();
	const now = ctx.currentTime;
	const frequencies = [523.25, 659.25, 783.99]; /* C5, E5, G5 */

	for (const freq of frequencies) {
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();

		osc.type = "sine";
		osc.frequency.setValueAtTime(freq, now);

		gain.gain.setValueAtTime(0, now);
		gain.gain.linearRampToValueAtTime(0.15, now + 0.05);
		gain.gain.exponentialRampToValueAtTime(0.001, now + 2.5);

		osc.connect(gain);
		gain.connect(ctx.destination);

		osc.start(now);
		osc.stop(now + 2.5);
	}
}

/* ── Notification bell (friend started meditating) ── */

/**
 * A single singing-bowl strike via Web Audio API.
 * Uses AudioContext so it never appears in lock screen controls.
 *
 * Fundamental + inharmonic partials give the metallic, bell-like
 * decay characteristic of a singing bowl.
 */
export function playBell(): void {
	const ctx = getAudioCtx();
	const now = ctx.currentTime;

	const partials = [
		{ freq: 440, gain: 0.4, decay: 3.0 },   /* fundamental A4 */
		{ freq: 880, gain: 0.15, decay: 2.0 },   /* octave */
		{ freq: 1318, gain: 0.08, decay: 1.5 },  /* ~E6 (inharmonic) */
		{ freq: 1864, gain: 0.04, decay: 1.0 },  /* metallic shimmer */
	];

	for (const p of partials) {
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();

		osc.type = "sine";
		osc.frequency.setValueAtTime(p.freq, now);

		gain.gain.setValueAtTime(0, now);
		gain.gain.linearRampToValueAtTime(p.gain, now + 0.01);
		gain.gain.exponentialRampToValueAtTime(0.001, now + p.decay);

		osc.connect(gain);
		gain.connect(ctx.destination);

		osc.start(now);
		osc.stop(now + p.decay);
	}
}
