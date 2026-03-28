let wakeLock: WakeLockSentinel | null = null;

export async function requestWakeLock(): Promise<void> {
	if (!("wakeLock" in navigator)) return;
	try {
		wakeLock = await navigator.wakeLock.request("screen");
		wakeLock.addEventListener("release", () => {
			wakeLock = null;
		});
	} catch {
		/* wake lock not available or denied */
	}
}

export async function releaseWakeLock(): Promise<void> {
	if (wakeLock) {
		await wakeLock.release();
		wakeLock = null;
	}
}

/**
 * Re-acquire wake lock when page becomes visible again
 * (wake lock is automatically released when page is hidden)
 */
export function setupWakeLockReacquire(isActive: () => boolean): void {
	document.addEventListener("visibilitychange", () => {
		if (document.visibilityState === "visible" && isActive()) {
			requestWakeLock();
		}
	});
}
