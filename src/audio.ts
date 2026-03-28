/**
 * Audio module — a silent audio element is the source of truth for session
 * time. When the session ends, the completion chime plays through the SAME
 * audio element so it reuses the existing media session (no extra lockscreen
 * entry). MediaSession metadata shows the app icon as album art.
 */

let audioEl: HTMLAudioElement | null = null;
let audioUrl: string | null = null;
let rafId = 0;
let isPlayingChime = false;

let onTickCb: ((curSec: number, durSec: number) => void) | null = null;
let onEndedCb: (() => void) | null = null;
let onPauseCb: (() => void) | null = null;
let onPlayCb: (() => void) | null = null;

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
export function playChime(): void {
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
	audioEl.volume = 1;

	audioEl.addEventListener("ended", () => {
		if (isPlayingChime) {
			/* chime finished — nothing more to do */
			isPlayingChime = false;
			return;
		}
		onEndedCb?.();
	});
	audioEl.addEventListener("pause", () => {
		cancelAnimationFrame(rafId);
		if (!isPlayingChime) onPauseCb?.();
	});
	audioEl.addEventListener("play", () => {
		if (!isPlayingChime) {
			rafId = requestAnimationFrame(tick);
			onPlayCb?.();
		}
	});

	/* show app icon as album art on lockscreen — no playback controls */
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
	}
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
	onTickCb?.(audioEl.currentTime, audioEl.duration);
}

export function seekDrag(timeSec: number): void {
	if (!audioEl || !Number.isFinite(audioEl.duration)) return;
	audioEl.currentTime = Math.max(0, Math.min(timeSec, audioEl.duration));
	onTickCb?.(audioEl.currentTime, audioEl.duration);
}

export function flushPositionState(): void {
	/* no-op — kept for call-site compatibility */
}

export function getCurrentTime(): number {
	return audioEl?.currentTime ?? 0;
}

export function getDuration(): number {
	return audioEl?.duration ?? 0;
}

export function destroy(): void {
	isPlayingChime = false;
	onTickCb = null;
	onEndedCb = null;
	onPauseCb = null;
	onPlayCb = null;

	cancelAnimationFrame(rafId);

	if ("mediaSession" in navigator) {
		navigator.mediaSession.metadata = null;
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
