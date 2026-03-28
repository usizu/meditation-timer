export interface SessionRecord {
	date: string;
	durationMinutes: number;
	completedMinutes: number;
	completed: boolean;
}

const STORAGE_KEY = "cosmic-timer-history";

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
