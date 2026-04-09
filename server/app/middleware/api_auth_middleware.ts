import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import ApiToken from '#models/api_token'

/**
 * API auth middleware — checks Bearer token first, falls back to
 * session auth. Returns 401 JSON on failure (no redirect).
 */
export default class ApiAuthMiddleware {
	async handle(ctx: HttpContext, next: NextFn) {
		const authHeader = ctx.request.header('authorization')

		if (authHeader?.startsWith('Bearer ')) {
			const plaintext = authHeader.slice(7)
			const record = await ApiToken.verify(plaintext)

			if (record) {
				/*
				 * Log the user in via the session guard and then authenticate
				 * so that ctx.auth.user is populated for downstream controllers.
				 * login() alone only sets ctx.auth.use('web').user, not ctx.auth.user.
				 */
				await ctx.auth.use('web').login(record.user)
				await ctx.auth.authenticateUsing(['web'])
				return next()
			}
		}

		/* Fall back to session auth */
		try {
			await ctx.auth.authenticateUsing(['web'])
			return next()
		} catch {
			return ctx.response.status(401).json({ error: 'Unauthorized' })
		}
	}
}
