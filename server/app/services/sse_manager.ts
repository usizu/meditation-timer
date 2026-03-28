import type { Response } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'

/**
 * Manages active SSE connections per user.
 * A user can have multiple connections (e.g. phone + laptop).
 */
class SseManager {
	private connections = new Map<number, Set<Response>>()

	/**
	 * Register an SSE connection for a user.
	 */
	add(userId: number, response: Response) {
		if (!this.connections.has(userId)) {
			this.connections.set(userId, new Set())
		}
		this.connections.get(userId)!.add(response)
		logger.debug({ userId, total: this.connections.get(userId)!.size }, 'SSE connection added')
	}

	/**
	 * Remove an SSE connection (e.g. on disconnect).
	 */
	remove(userId: number, response: Response) {
		const conns = this.connections.get(userId)
		if (conns) {
			conns.delete(response)
			if (conns.size === 0) {
				this.connections.delete(userId)
			}
		}
		logger.debug({ userId }, 'SSE connection removed')
	}

	/**
	 * Check if a user has any active SSE connections.
	 */
	isConnected(userId: number): boolean {
		return this.connections.has(userId) && this.connections.get(userId)!.size > 0
	}

	/**
	 * Send a Datastar patch-elements event to all connections of a user.
	 * This replaces/merges an HTML fragment into the user's DOM.
	 */
	patchElements(userId: number, selector: string, html: string, mode: string = 'morph') {
		const conns = this.connections.get(userId)
		if (!conns) return

		const event = [
			'event: datastar-patch-elements',
			`data: selector ${selector}`,
			`data: mode ${mode}`,
			`data: elements ${html}`,
			'',
			'',
		].join('\n')

		for (const res of conns) {
			try {
				res.response.write(event)
			} catch {
				/* connection probably closed */
				conns.delete(res)
			}
		}
	}

	/**
	 * Send a Datastar patch-signals event to update client-side signals.
	 */
	patchSignals(userId: number, signals: Record<string, unknown>) {
		const conns = this.connections.get(userId)
		if (!conns) return

		const event = [
			'event: datastar-patch-signals',
			`data: signals ${JSON.stringify(signals)}`,
			'',
			'',
		].join('\n')

		for (const res of conns) {
			try {
				res.response.write(event)
			} catch {
				conns.delete(res)
			}
		}
	}

	/**
	 * Send updates to multiple users at once.
	 */
	broadcastToUsers(userIds: number[], selector: string, html: string, mode: string = 'morph') {
		for (const userId of userIds) {
			this.patchElements(userId, selector, html, mode)
		}
	}
}

export default new SseManager()
