/**
 * Audio module — a silent audio element is the source of truth for session
 * time. When the session ends, the completion chime plays through the SAME
 * audio element so it reuses the existing media session (no extra lockscreen
 * entry). MediaSession metadata shows the app icon as album art.
 *
 * create() returns a Session handle. All operations go through it.
 * Starting a new session automatically invalidates any previous handle,
 * so stale callbacks (inertia RAF, old event listeners) become harmless
 * no-ops without any explicit checks at call sites.
 */

/* ── Session handle ── */

export interface Session {
	play(): Promise<void>;
	pause(): void;
	seekTo(timeSec: number): void;
	seekDrag(timeSec: number): void;
	getCurrentTime(): number;
	getDuration(): number;
	playChime(): void;
	destroy(): void;
	readonly alive: boolean;
}

/* ── Module state ── */

let audioEl: HTMLAudioElement | null = null;
let audioUrl: string | null = null;
let rafId = 0;
let isPlayingChime = false;
let gen = 0; /* incremented on every create(); stale handles see a mismatch */

let onTickCb: ((curSec: number, durSec: number) => void) | null = null;
let onEndedCb: (() => void) | null = null;

/* ── WAV generation ── */

const SAMPLE_RATE = 8000;

function writeStr(view: DataView, offset: number, str: string): void {
	for (let i = 0; i < str.length; i++) {
		view.setUint8(offset + i, str.charCodeAt(i));
	}
}

/** 8 kHz · 8-bit · mono WAV — pure silence. */
function createSilentWav(durationSeconds: number): Blob {
	const numSamples = Math.ceil(SAMPLE_RATE * durationSeconds);
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
	v.setUint32(24, SAMPLE_RATE, true);
	v.setUint32(28, SAMPLE_RATE, true); /* byteRate */
	v.setUint16(32, 1, true); /* blockAlign */
	v.setUint16(34, 8, true); /* bitsPerSample */
	writeStr(v, 36, "data");
	v.setUint32(40, dataSize, true);

	bytes.fill(128, 44); /* 128 = zero-crossing for unsigned 8-bit */

	return new Blob([buf], { type: "audio/wav" });
}

/* ── Completion chime ── */

const CHIME_RATE = 44100;
const CHIME_FREQS = [523.25, 659.25, 783.99]; /* C5, E5, G5 */
const CHIME_DURATION = 2.5; /* seconds */

function createChimeWav(): Blob {
	const numSamples = Math.ceil(CHIME_RATE * CHIME_DURATION);
	const buf = new ArrayBuffer(44 + numSamples * 2);
	const v = new DataView(buf);

	/* WAV header — 16-bit mono */
	writeStr(v, 0, "RIFF");
	v.setUint32(4, 36 + numSamples * 2, true);
	writeStr(v, 8, "WAVE");
	writeStr(v, 12, "fmt ");
	v.setUint32(16, 16, true);
	v.setUint16(20, 1, true); /* PCM */
	v.setUint16(22, 1, true); /* mono */
	v.setUint32(24, CHIME_RATE, true);
	v.setUint32(28, CHIME_RATE * 2, true); /* byteRate */
	v.setUint16(32, 2, true); /* blockAlign */
	v.setUint16(34, 16, true); /* bitsPerSample */
	writeStr(v, 36, "data");
	v.setUint32(40, numSamples * 2, true);

	const twoPi = 2 * Math.PI;
	for (let i = 0; i < numSamples; i++) {
		const t = i / CHIME_RATE;
		const attack = Math.min(1, t / 0.03);
		const decay = Math.exp(-t * 1.3);
		const env = attack * decay;

		let sig = 0;
		for (const f of CHIME_FREQS) {
			sig += Math.sin(twoPi * f * t);
		}
		sig /= CHIME_FREQS.length;

		const sample = Math.max(-32768, Math.min(32767, sig * env * 16000));
		v.setInt16(44 + i * 2, sample, true);
	}

	return new Blob([buf], { type: "audio/wav" });
}

/**
 * Play the chime through the existing audio element so it reuses
 * the same media session — no extra lockscreen entry.
 */
function playChimeInternal(): void {
	if (!audioEl) return;
	isPlayingChime = true;
	cancelAnimationFrame(rafId);

	const blob = createChimeWav();
	const chimeUrl = URL.createObjectURL(blob);

	/* release the silent WAV URL */
	if (audioUrl) URL.revokeObjectURL(audioUrl);
	audioUrl = chimeUrl;

	audioEl.src = chimeUrl;
	audioEl.play();
}

/* ── Shared AudioContext for UI sounds (bell, etc.) ── */

let _audioCtx: AudioContext | null = null;
function getAudioCtx(): AudioContext {
	if (!_audioCtx) _audioCtx = new AudioContext();
	return _audioCtx;
}

/**
 * A single singing-bowl strike via Web Audio API.
 * Uses AudioContext so it never appears in lock screen controls.
 */
export function playBell(): void {
	const ctx = getAudioCtx();
	const now = ctx.currentTime;

	const partials = [
		{ freq: 440, gain: 0.4, decay: 3.0 } /* fundamental A4 */,
		{ freq: 880, gain: 0.15, decay: 2.0 } /* octave */,
		{ freq: 1318, gain: 0.08, decay: 1.5 } /* ~E6 (inharmonic) */,
		{ freq: 1864, gain: 0.04, decay: 1.0 } /* metallic shimmer */,
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
	}
	rafId = requestAnimationFrame(tick);
}

function destroyInternal(): void {
	isPlayingChime = false;
	onTickCb = null;
	onEndedCb = null;

	cancelAnimationFrame(rafId);

	if ("mediaSession" in navigator) {
		navigator.mediaSession.metadata = null;
		navigator.mediaSession.setActionHandler("pause", null);
		navigator.mediaSession.setActionHandler("play", null);
	}

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

/**
 * Create a new audio session. Returns a Session handle.
 *
 * Any previously-active session is destroyed automatically, and any
 * handles from it become inert (all methods silently no-op). This is
 * the key structural guarantee: you cannot accidentally operate on a
 * dead session because the handle itself knows it's stale.
 */
export function create(
	durationMinutes: number,
	cbs: SessionAudioCallbacks,
): Session {
	destroyInternal();

	const myGen = ++gen;
	const isAlive = (): boolean => gen === myGen && audioEl !== null;

	onTickCb = cbs.onTick;
	onEndedCb = cbs.onEnded;

	const blob = createSilentWav(durationMinutes * 60);
	audioUrl = URL.createObjectURL(blob);

	audioEl = new Audio(audioUrl);
	audioEl.volume = 1;

	audioEl.addEventListener("ended", () => {
		if (!isAlive()) return;
		if (isPlayingChime) {
			isPlayingChime = false;
			return;
		}
		onEndedCb?.();
	});
	audioEl.addEventListener("pause", () => {
		if (!isAlive()) return;
		cancelAnimationFrame(rafId);
		if (!isPlayingChime) cbs.onPause();
	});
	audioEl.addEventListener("play", () => {
		if (!isAlive()) return;
		if (!isPlayingChime) {
			rafId = requestAnimationFrame(tick);
			cbs.onPlay();
		}
	});

	/* show app icon as album art on lockscreen + enable pause/play controls */
	if ("mediaSession" in navigator) {
		const base = document.baseURI;
		navigator.mediaSession.metadata = new MediaMetadata({
			title: `${durationMinutes} min meditation`,
			artist: "Kitty Timer",
			artwork: [
				{
					src: new URL("lockscreen-art.png", base).href,
					sizes: "512x512",
				},
			],
		});
		navigator.mediaSession.setActionHandler("pause", () => {
			audioEl?.pause();
		});
		navigator.mediaSession.setActionHandler("play", () => {
			audioEl?.play();
		});
	}

	/**
	 * Guard helper: returns the audio element if this session is still
	 * alive, or null if it's been superseded / destroyed.
	 * Every handle method funnels through this single gate.
	 */
	function el(): HTMLAudioElement | null {
		return isAlive() ? audioEl : null;
	}

	return {
		get alive() {
			return isAlive();
		},
		play() {
			return el()?.play() ?? Promise.resolve();
		},
		pause() {
			el()?.pause();
		},
		seekTo(timeSec: number) {
			const a = el();
			if (!a || !Number.isFinite(a.duration)) return;
			a.currentTime = Math.max(0, Math.min(timeSec, a.duration));
			onTickCb?.(a.currentTime, a.duration);
		},
		seekDrag(timeSec: number) {
			const a = el();
			if (!a || !Number.isFinite(a.duration)) return;
			a.currentTime = Math.max(0, Math.min(timeSec, a.duration));
			onTickCb?.(a.currentTime, a.duration);
		},
		getCurrentTime() {
			return el()?.currentTime ?? 0;
		},
		getDuration() {
			return el()?.duration ?? 0;
		},
		playChime() {
			if (el()) playChimeInternal();
		},
		destroy() {
			if (el()) destroyInternal();
		},
	};
}
