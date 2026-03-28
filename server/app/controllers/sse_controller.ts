import type { HttpContext } from '@adonisjs/core/http'
import sseManager from '#services/sse_manager'

export default class SseController {
	/**
	 * GET /sse/updates — authenticated SSE stream
	 *
	 * The client (Datastar) opens this connection and receives
	 * real-time HTML fragment updates and signal patches.
	 */
	async updates({ auth, response, request }: HttpContext) {
		const userId = auth.user!.id

		/* Set SSE headers */
		response.response.writeHead(200, {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			'Connection': 'keep-alive',
			'X-Accel-Buffering': 'no', /* disable nginx buffering */
		})

		/* Register this connection */
		sseManager.add(userId, response)

		/* Send an initial keepalive comment so the client knows we're connected */
		response.response.write(': connected\n\n')

		/* Heartbeat every 30s to keep the connection alive */
		const heartbeat = setInterval(() => {
			try {
				response.response.write(': heartbeat\n\n')
			} catch {
				clearInterval(heartbeat)
			}
		}, 30_000)

		/* Clean up on disconnect */
		request.request.on('close', () => {
			clearInterval(heartbeat)
			sseManager.remove(userId, response)
		})
	}
}
