export interface SessionRecord {
	date: string;
	durationMinutes: number;
	completedMinutes: number;
	completed: boolean;
}

const STORAGE_KEY = "cosmic-timer-history";
const DURATION_KEY = "cosmic-timer-duration";

export function saveSession(record: SessionRecord): void {
	const history = getHistory();
	history.push(record);
	localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

export function getHistory(): SessionRecord[] {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		return raw ? JSON.parse(raw) : [];
	} catch {
		return [];
	}
}

export function saveDuration(minutes: number): void {
	localStorage.setItem(DURATION_KEY, String(minutes));
}

export function loadDuration(): number {
	const raw = localStorage.getItem(DURATION_KEY);
	const val = raw ? Number(raw) : 5;
	return val > 0 && val <= 180 ? val : 5;
}

/* ── Daily meditation counter (resets at 3 AM) ── */

const DAILY_KEY = "cosmic-timer-daily";

interface DailyRecord {
	day: string /* YYYY-MM-DD of the "meditation day" */;
	minutes: number;
}

/**
 * Returns a date string representing the "meditation day".
 * A day runs from 3:00 AM to 2:59 AM the next calendar day,
 * so we subtract 3 hours before taking the date.
 */
function getMeditationDay(): string {
	const now = new Date();
	const shifted = new Date(now.getTime() - 3 * 60 * 60 * 1000);
	return shifted.toISOString().slice(0, 10);
}

function loadDaily(): DailyRecord {
	try {
		const raw = localStorage.getItem(DAILY_KEY);
		if (raw) {
			const parsed: DailyRecord = JSON.parse(raw);
			if (parsed.day === getMeditationDay()) return parsed;
		}
	} catch {
		/* ignore */
	}
	return { day: getMeditationDay(), minutes: 0 };
}

function saveDaily(record: DailyRecord): void {
	localStorage.setItem(DAILY_KEY, JSON.stringify(record));
}

export function getDailyMinutes(): number {
	return loadDaily().minutes;
}

export function incrementDailyMinute(): number {
	const record = loadDaily();
	record.day = getMeditationDay();
	record.minutes += 1;
	saveDaily(record);
	return record.minutes;
}

export function addDailyMinutes(minutes: number): number {
	const record = loadDaily();
	record.day = getMeditationDay();
	record.minutes += minutes;
	saveDaily(record);
	return record.minutes;
}
