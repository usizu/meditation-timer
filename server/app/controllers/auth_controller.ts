import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import { randomBytes } from 'node:crypto'
import User from '#models/user'
import MagicLinkToken from '#models/magic_link_token'
import MailService from '#services/mail_service'

export default class AuthController {
	async showLogin({ view }: HttpContext) {
		return view.render('pages/auth/login')
	}

	async sendMagicLink({ request, response, session }: HttpContext) {
		const email = request.input('email')?.trim().toLowerCase()
		if (!email) {
			session.flash('error', 'Please enter your email address.')
			return response.redirect().back()
		}

		/* Generate a URL-safe token and a 6-digit numeric code */
		const token = randomBytes(32).toString('hex')
		const code = String(Math.floor(100_000 + Math.random() * 900_000))

		/* Delete any existing tokens for this email */
		await MagicLinkToken.query().where('email', email).delete()

		/* Create a new token (expires in 10 minutes) */
		await MagicLinkToken.create({
			email,
			token,
			code,
			expiresAt: DateTime.now().plus({ minutes: 10 }),
		})

		/* Send the email */
		await MailService.sendMagicLink(email, code, token)

		session.flash('email', email)
		return response.redirect().toRoute('auth.verify.show')
	}

	async showVerify({ view, session }: HttpContext) {
		const email = session.flashMessages.get('email') || ''
		return view.render('pages/auth/verify', { email })
	}

	async verify({ request, response, session, auth }: HttpContext) {
		const token = request.input('token')
		const code = request.input('code')

		let magicLink: MagicLinkToken | null = null

		if (token) {
			/* Verify via URL token (magic link click) */
			magicLink = await MagicLinkToken.findBy('token', token)
		} else if (code) {
			/* Verify via 6-digit code */
			magicLink = await MagicLinkToken.findBy('code', code.trim())
		}

		if (!magicLink || magicLink.isExpired) {
			session.flash('error', 'Invalid or expired code. Please try again.')
			return response.redirect().toRoute('auth.login')
		}

		/* Find or create the user */
		const user = await User.firstOrCreate(
			{ email: magicLink.email },
			{ email: magicLink.email, timezone: 'UTC' }
		)

		/* Clean up the token */
		await magicLink.delete()

		/* Log the user in via AdonisJS session guard */
		await auth.use('web').login(user)

		return response.redirect().toRoute('home')
	}

	/**
	 * GET /auth/verify?token=xxx — handles magic link clicks
	 */
	async verifyFromLink({ request, response, session, auth }: HttpContext) {
		const token = request.qs().token
		if (!token) {
			return response.redirect().toRoute('auth.login')
		}

		const magicLink = await MagicLinkToken.findBy('token', token)
		if (!magicLink || magicLink.isExpired) {
			session.flash('error', 'Invalid or expired link. Please try again.')
			return response.redirect().toRoute('auth.login')
		}

		const user = await User.firstOrCreate(
			{ email: magicLink.email },
			{ email: magicLink.email, timezone: 'UTC' }
		)

		await magicLink.delete()
		await auth.use('web').login(user)

		return response.redirect().toRoute('home')
	}

	async logout({ auth, response }: HttpContext) {
		await auth.use('web').logout()
		return response.redirect().toRoute('auth.login')
	}
}
