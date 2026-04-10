/**
 * Client-side SSE connection manager.
 * Connects to /api/sse/updates and dispatches custom events.
 */

import { getToken } from "./api";

declare const __API_BASE__: string;
const API_BASE = __API_BASE__;

type SseHandler = (data: Record<string, unknown>) => void;

let eventSource: EventSource | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Map<string, Set<SseHandler>>();

/**
 * Subscribe to a named SSE event. Returns an unsubscribe function.
 */
export function onSseEvent(event: string, handler: SseHandler): () => void {
	if (!listeners.has(event)) {
		listeners.set(event, new Set());
	}
	listeners.get(event)?.add(handler);

	/* If we have an active EventSource, add the listener to it */
	if (eventSource) {
		eventSource.addEventListener(event, makeNativeHandler(event, handler));
	}

	return () => {
		listeners.get(event)?.delete(handler);
	};
}

function makeNativeHandler(_event: string, handler: SseHandler) {
	return (e: MessageEvent) => {
		try {
			const data = JSON.parse(e.data);
			handler(data);
		} catch {
			/* malformed event */
		}
	};
}

/**
 * Open the SSE connection. Safe to call multiple times — only one
 * connection is kept alive.
 */
export function connectSse(): void {
	if (eventSource) return;

	const token = getToken();
	/*
	 * EventSource doesn't support custom headers, so pass the token
	 * as a query param. The server's apiAuth middleware checks Bearer
	 * header first, but we'll need the SSE controller to also check
	 * the query param. For same-origin (no token), cookies handle auth.
	 */
	const params = token ? `?token=${encodeURIComponent(token)}` : "";
	const url = `${API_BASE}/api/sse/updates${params}`;

	eventSource = new EventSource(url, { withCredentials: !token });

	/* Re-attach all registered listeners */
	for (const [event, handlers] of listeners) {
		for (const handler of handlers) {
			eventSource.addEventListener(event, makeNativeHandler(event, handler));
		}
	}

	eventSource.onerror = () => {
		/* Connection lost — close and schedule reconnect */
		closeSse();
		if (!reconnectTimer) {
			reconnectTimer = setTimeout(() => {
				reconnectTimer = null;
				connectSse();
			}, 5_000);
		}
	};
}

/**
 * Close the SSE connection.
 */
export function closeSse(): void {
	if (reconnectTimer) {
		clearTimeout(reconnectTimer);
		reconnectTimer = null;
	}
	if (eventSource) {
		eventSource.close();
		eventSource = null;
	}
}
