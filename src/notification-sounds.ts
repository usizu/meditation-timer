/**
 * Notification sound effects — synthesized via Web Audio API.
 *
 * Stores user preferences (enabled, effect, volume) in localStorage.
 * Provides preview playback and a hook for playing on notification events.
 *
 * For future native (iOS/Android via Capacitor), the selected effect name
 * can be passed to APNs/FCM payloads so the native layer plays the
 * matching bundled sound file.
 */

const STORAGE_KEY = "kitty-timer-notification-sound";

export interface NotificationSoundSettings {
	enabled: boolean;
	effect: string;
	volume: number /* 0–1 */;
}

const DEFAULTS: NotificationSoundSettings = {
	enabled: false,
	effect: "chime",
	volume: 0.5,
};

/* ── Persistence ── */

export function loadSettings(): NotificationSoundSettings {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw) {
			const parsed = JSON.parse(raw);
			return { ...DEFAULTS, ...parsed };
		}
	} catch {
		/* use defaults */
	}
	return { ...DEFAULTS };
}

export function saveSettings(settings: NotificationSoundSettings): void {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

/* ── Sound effects catalogue ── */

export interface SoundEffect {
	name: string;
	label: string;
	/** Generate the sound into the given AudioContext / GainNode */
	play: (ctx: AudioContext, dest: AudioNode) => void;
}

function playChimeEffect(ctx: AudioContext, dest: AudioNode): void {
	const now = ctx.currentTime;
	const freqs = [523.25, 659.25, 783.99]; /* C5, E5, G5 */

	for (const f of freqs) {
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		osc.type = "sine";
		osc.frequency.setValueAtTime(f, now);
		gain.gain.setValueAtTime(0, now);
		gain.gain.linearRampToValueAtTime(0.3, now + 0.03);
		gain.gain.exponentialRampToValueAtTime(0.001, now + 2.0);
		osc.connect(gain);
		gain.connect(dest);
		osc.start(now);
		osc.stop(now + 2.0);
	}
}

function playBellEffect(ctx: AudioContext, dest: AudioNode): void {
	const now = ctx.currentTime;
	const partials = [
		{ freq: 440, gain: 0.35, decay: 3.0 },
		{ freq: 880, gain: 0.12, decay: 2.0 },
		{ freq: 1318, gain: 0.06, decay: 1.5 },
		{ freq: 1864, gain: 0.03, decay: 1.0 },
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
		gain.connect(dest);
		osc.start(now);
		osc.stop(now + p.decay);
	}
}

function playDropEffect(ctx: AudioContext, dest: AudioNode): void {
	const now = ctx.currentTime;
	/* Two-note descending water drop */
	const notes = [
		{ freq: 1200, time: 0, decay: 0.3 },
		{ freq: 800, time: 0.15, decay: 0.5 },
	];

	for (const n of notes) {
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		osc.type = "sine";
		osc.frequency.setValueAtTime(n.freq, now + n.time);
		osc.frequency.exponentialRampToValueAtTime(
			n.freq * 0.7,
			now + n.time + n.decay,
		);
		gain.gain.setValueAtTime(0, now + n.time);
		gain.gain.linearRampToValueAtTime(0.4, now + n.time + 0.005);
		gain.gain.exponentialRampToValueAtTime(0.001, now + n.time + n.decay);
		osc.connect(gain);
		gain.connect(dest);
		osc.start(now + n.time);
		osc.stop(now + n.time + n.decay);
	}
}

function playGongEffect(ctx: AudioContext, dest: AudioNode): void {
	const now = ctx.currentTime;
	/* Deep gong with metallic overtones */
	const partials = [
		{ freq: 130.81, gain: 0.4, decay: 4.0 } /* C3 fundamental */,
		{ freq: 261.63, gain: 0.2, decay: 3.0 } /* C4 octave */,
		{ freq: 392.0, gain: 0.1, decay: 2.0 } /* G4 */,
		{ freq: 523.25, gain: 0.05, decay: 1.5 } /* C5 shimmer */,
	];

	for (const p of partials) {
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		osc.type = "sine";
		osc.frequency.setValueAtTime(p.freq, now);
		gain.gain.setValueAtTime(0, now);
		gain.gain.linearRampToValueAtTime(p.gain, now + 0.02);
		gain.gain.exponentialRampToValueAtTime(0.001, now + p.decay);
		osc.connect(gain);
		gain.connect(dest);
		osc.start(now);
		osc.stop(now + p.decay);
	}
}

function playBirdsongEffect(ctx: AudioContext, dest: AudioNode): void {
	const now = ctx.currentTime;
	/* Quick chirpy ascending notes */
	const chirps = [
		{ freq: 2000, time: 0, dur: 0.08 },
		{ freq: 2400, time: 0.1, dur: 0.08 },
		{ freq: 2800, time: 0.2, dur: 0.12 },
		{ freq: 2600, time: 0.35, dur: 0.15 },
	];

	for (const c of chirps) {
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		osc.type = "sine";
		osc.frequency.setValueAtTime(c.freq, now + c.time);
		osc.frequency.linearRampToValueAtTime(c.freq * 1.1, now + c.time + c.dur);
		gain.gain.setValueAtTime(0, now + c.time);
		gain.gain.linearRampToValueAtTime(0.25, now + c.time + 0.01);
		gain.gain.exponentialRampToValueAtTime(0.001, now + c.time + c.dur);
		osc.connect(gain);
		gain.connect(dest);
		osc.start(now + c.time);
		osc.stop(now + c.time + c.dur + 0.05);
	}
}

function playHarpEffect(ctx: AudioContext, dest: AudioNode): void {
	const now = ctx.currentTime;
	/* Ascending arpeggio: C4 E4 G4 C5 */
	const notes = [261.63, 329.63, 392.0, 523.25];
	const spacing = 0.12;

	for (let i = 0; i < notes.length; i++) {
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		const t = now + i * spacing;
		osc.type = "triangle";
		osc.frequency.setValueAtTime(notes[i], t);
		gain.gain.setValueAtTime(0, t);
		gain.gain.linearRampToValueAtTime(0.3, t + 0.01);
		gain.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
		osc.connect(gain);
		gain.connect(dest);
		osc.start(t);
		osc.stop(t + 1.2);
	}
}

export const EFFECTS: SoundEffect[] = [
	{ name: "chime", label: "Chime", play: playChimeEffect },
	{ name: "bell", label: "Singing Bowl", play: playBellEffect },
	{ name: "drop", label: "Water Drop", play: playDropEffect },
	{ name: "gong", label: "Gong", play: playGongEffect },
	{ name: "birdsong", label: "Birdsong", play: playBirdsongEffect },
	{ name: "harp", label: "Harp", play: playHarpEffect },
];

/* ── Playback ── */

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
	if (!audioCtx) {
		audioCtx = new AudioContext();
	}
	return audioCtx;
}

/**
 * Play the given effect at the given volume (0–1).
 * Volume is independent of system volume — we control via GainNode.
 */
export function playEffect(effectName: string, volume: number): void {
	const effect = EFFECTS.find((e) => e.name === effectName);
	if (!effect) return;

	const ctx = getCtx();
	if (ctx.state === "suspended") ctx.resume();

	const gainNode = ctx.createGain();
	gainNode.gain.setValueAtTime(volume, ctx.currentTime);
	gainNode.connect(ctx.destination);
	effect.play(ctx, gainNode);
}

/**
 * Play the notification sound using the user's saved settings.
 * No-op if sounds are disabled.
 */
export function playNotificationSound(): void {
	const settings = loadSettings();
	if (!settings.enabled) return;
	playEffect(settings.effect, settings.volume);
}

/**
 * Preview a specific effect at a specific volume (for the settings UI).
 */
export function previewEffect(effectName: string, volume: number): void {
	playEffect(effectName, volume);
}

/**
 * Get the effect name for native push payloads.
 * Returns null if sounds are disabled.
 * The native app should bundle .caf/.wav files matching these names.
 */
export function getNativeSound(): string | null {
	const settings = loadSettings();
	if (!settings.enabled) return null;
	return settings.effect;
}
