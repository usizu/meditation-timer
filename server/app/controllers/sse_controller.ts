import type { HttpContext } from '@adonisjs/core/http'
import sseManager from '#services/sse_manager'
import Friendship from '#models/friendship'

/**
 * Get all confirmed friend user IDs for a user.
 */
async function getConfirmedFriendIds(userId: number): Promise<number[]> {
	const friendships = await Friendship.query()
		.where((q) => {
			q.where('user_a_id', userId).orWhere('user_b_id', userId)
		})
		.andWhere('confirmed', true)

	return friendships.map((f) => (f.userAId === userId ? f.userBId : f.userAId))
}

/*
 * Register connect/disconnect callbacks once at module load.
 * When a user comes online or goes offline, notify their friends.
 */
sseManager.onConnect(async (userId) => {
	const friendIds = await getConfirmedFriendIds(userId)
	sseManager.broadcastJson(friendIds, 'friend:online', { userId })
})

sseManager.onDisconnect(async (userId) => {
	const friendIds = await getConfirmedFriendIds(userId)
	sseManager.broadcastJson(friendIds, 'friend:offline', { userId })
})

export default class SseController {
	/**
	 * GET /sse/updates — session-authenticated SSE stream (Datastar)
	 */
	async updates({ auth, response, request }: HttpContext) {
		this.streamSse(auth.user!.id, response, request)
	}

	/**
	 * GET /api/sse/updates — API-authenticated SSE stream (JSON events)
	 */
	async apiUpdates({ auth, response, request }: HttpContext) {
		this.streamSse(auth.user!.id, response, request)
	}

	private streamSse(userId: number, response: HttpContext['response'], request: HttpContext['request']) {
		/* Set SSE headers */
		response.response.writeHead(200, {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			'Connection': 'keep-alive',
			'X-Accel-Buffering': 'no',
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
