/**
 * Audio module — the audio element is the source of truth for session time.
 *
 * A WAV matching the exact timer duration is generated with a completion
 * chime baked into the last 3 seconds. Because the chime lives inside the
 * audio file itself, it plays even from the lockscreen / background.
 */

let audioEl: HTMLAudioElement | null = null;
let audioUrl: string | null = null;
let rafId = 0;
let lastPositionUpdate = 0;

let onTickCb: ((curSec: number, durSec: number) => void) | null = null;
let onEndedCb: (() => void) | null = null;
let onPauseCb: (() => void) | null = null;
let onPlayCb: (() => void) | null = null;

/* ── WAV generation ── */

const CHIME_SECS = 3;
const CHIME_FREQS = [523.25, 659.25, 783.99]; /* C5, E5, G5 */
const SAMPLE_RATE = 8000;

function writeStr(view: DataView, offset: number, str: string): void {
	for (let i = 0; i < str.length; i++) {
		view.setUint8(offset + i, str.charCodeAt(i));
	}
}

/**
 * 8 kHz · 8-bit · mono WAV.
 * Silence for most of the file, with a synthesised C-E-G chime
 * in the final CHIME_SECS seconds.
 */
function createSessionWav(durationSeconds: number): Blob {
	const numSamples = Math.ceil(SAMPLE_RATE * durationSeconds);
	const dataSize = numSamples;
	const buf = new ArrayBuffer(44 + dataSize);
	const v = new DataView(buf);
	const bytes = new Uint8Array(buf);

	/* header */
	writeStr(v, 0, "RIFF");
	v.setUint32(4, 36 + dataSize, true);
	writeStr(v, 8, "WAVE");
	writeStr(v, 12, "fmt ");
	v.setUint32(16, 16, true);
	v.setUint16(20, 1, true); /* PCM */
	v.setUint16(22, 1, true); /* mono */
	v.setUint32(24, SAMPLE_RATE, true);
	v.setUint32(28, SAMPLE_RATE, true); /* byteRate */
	v.setUint16(32, 1, true); /* blockAlign */
	v.setUint16(34, 8, true); /* bitsPerSample */
	writeStr(v, 36, "data");
	v.setUint32(40, dataSize, true);

	/* silence (128 = zero-crossing for unsigned 8-bit PCM) */
	bytes.fill(128, 44);

	/* chime in the last CHIME_SECS seconds */
	const chimeSamples = Math.min(
		Math.ceil(SAMPLE_RATE * CHIME_SECS),
		numSamples,
	);
	const chimeStart = numSamples - chimeSamples;
	const twoPi = 2 * Math.PI;
	const amp = 55; /* ±55 from centre → range 73-183 */

	for (let i = 0; i < chimeSamples; i++) {
		const t = i / SAMPLE_RATE;
		const attack = Math.min(1, t / 0.03);
		const decay = Math.exp(-t * 1.3);
		const env = attack * decay;

		let sig = 0;
		for (const f of CHIME_FREQS) {
			sig += Math.sin(twoPi * f * t);
		}
		sig /= CHIME_FREQS.length;

		const val = 128 + Math.round(sig * env * amp);
		bytes[44 + chimeStart + i] = Math.max(0, Math.min(255, val));
	}

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

	const blob = createSessionWav(durationMinutes * 60);
	audioUrl = URL.createObjectURL(blob);

	audioEl = new Audio(audioUrl);
	audioEl.volume = 1;

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
