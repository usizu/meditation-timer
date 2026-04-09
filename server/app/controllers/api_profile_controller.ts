import type { HttpContext } from '@adonisjs/core/http'

export default class ApiProfileController {
	/**
	 * GET /api/profile — return current user profile
	 */
	async show({ auth, response }: HttpContext) {
		const user = auth.user!
		return response.json({
			user: { id: user.id, email: user.email, timezone: user.timezone },
		})
	}

	/**
	 * POST /api/profile — update profile fields
	 */
	async update({ request, response, auth }: HttpContext) {
		const user = auth.user!
		const timezone = request.input('timezone')?.trim()

		if (timezone) {
			user.timezone = timezone
			await user.save()
		}

		return response.json({
			user: { id: user.id, email: user.email, timezone: user.timezone },
		})
	}
}
