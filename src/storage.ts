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
