import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import { randomBytes } from 'node:crypto'
import User from '#models/user'
import MagicLinkToken from '#models/magic_link_token'
import ApiToken from '#models/api_token'
import MailService from '#services/mail_service'

export default class ApiAuthController {
	/**
	 * POST /api/auth/login — send magic link email
	 */
	async login({ request, response }: HttpContext) {
		const email = request.input('email')?.trim().toLowerCase()
		if (!email) {
			return response.status(422).json({ error: 'Email is required.' })
		}

		const token = randomBytes(32).toString('hex')
		const code = String(Math.floor(100_000 + Math.random() * 900_000))

		await MagicLinkToken.query().where('email', email).delete()

		await MagicLinkToken.create({
			email,
			token,
			code,
			expiresAt: DateTime.now().plus({ minutes: 10 }),
		})

		await MailService.sendMagicLink(email, code, token)

		return response.json({ sent: true })
	}

	/**
	 * POST /api/auth/verify — verify code, return API token
	 */
	async verify({ request, response }: HttpContext) {
		const code = request.input('code')?.trim()
		const token = request.input('token')

		let magicLink: MagicLinkToken | null = null

		if (token) {
			magicLink = await MagicLinkToken.findBy('token', token)
		} else if (code) {
			magicLink = await MagicLinkToken.findBy('code', code)
		}

		if (!magicLink || magicLink.isExpired) {
			return response.status(401).json({ error: 'Invalid or expired code.' })
		}

		const user = await User.firstOrCreate(
			{ email: magicLink.email },
			{ email: magicLink.email, timezone: 'UTC' }
		)

		await magicLink.delete()

		const deviceLabel = request.input('deviceLabel') || null
		const { plaintext } = await ApiToken.generate(user.id, deviceLabel)

		return response.json({
			apiToken: plaintext,
			user: { id: user.id, email: user.email, timezone: user.timezone, nickname: user.nickname, status: user.status },
		})
	}

	/**
	 * POST /api/auth/logout — delete current API token
	 */
	async logout({ request, response }: HttpContext) {
		const authHeader = request.header('authorization')
		if (authHeader?.startsWith('Bearer ')) {
			const plaintext = authHeader.slice(7)
			const record = await ApiToken.verify(plaintext)
			if (record) {
				await record.delete()
			}
		}
		return response.json({ ok: true })
	}

	/**
	 * GET /api/auth/check — returns current user if authenticated
	 */
	async check({ auth, response }: HttpContext) {
		const user = auth.user!
		return response.json({
			user: { id: user.id, email: user.email, timezone: user.timezone, nickname: user.nickname, status: user.status },
		})
	}
}
