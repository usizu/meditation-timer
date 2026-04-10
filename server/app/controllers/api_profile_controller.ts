import type { HttpContext } from '@adonisjs/core/http'

export default class ApiProfileController {
	/**
	 * GET /api/profile — return current user profile
	 */
	async show({ auth, response }: HttpContext) {
		const user = auth.user!
		return response.json({
			user: { id: user.id, email: user.email, timezone: user.timezone, nickname: user.nickname, status: user.status },
		})
	}

	/**
	 * POST /api/profile — update profile fields
	 */
	async update({ request, response, auth }: HttpContext) {
		const user = auth.user!
		const timezone = request.input('timezone')?.trim()
		const nickname = request.input('nickname')
		const status = request.input('status')

		if (timezone) user.timezone = timezone
		if (nickname !== undefined) user.nickname = nickname.trim().slice(0, 32) || null
		if (status !== undefined) user.status = status.trim().slice(0, 128) || null

		await user.save()

		return response.json({
			user: { id: user.id, email: user.email, timezone: user.timezone, nickname: user.nickname, status: user.status },
		})
	}
}
