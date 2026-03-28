import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";

const isNative = Capacitor.isNativePlatform();

/** Light tap — for preset buttons, stepper +/-, pause/resume */
export function tapLight(): void {
	if (!isNative) return;
	Haptics.impact({ style: ImpactStyle.Light });
}

/** Medium tap — for start button, stop button */
export function tapMedium(): void {
	if (!isNative) return;
	Haptics.impact({ style: ImpactStyle.Medium });
}

/** Heavy tap — for drag scrub start */
export function tapHeavy(): void {
	if (!isNative) return;
	Haptics.impact({ style: ImpactStyle.Heavy });
}

/** Success notification — for session complete */
export function notifySuccess(): void {
	if (!isNative) return;
	Haptics.notification({ type: NotificationType.Success });
}

/** Soft selection tick — for drag scrubbing movement */
export function selectionTick(): void {
	if (!isNative) return;
	Haptics.selectionChanged();
}
