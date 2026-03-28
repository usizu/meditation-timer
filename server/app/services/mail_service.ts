import env from '#start/env'
import { Resend } from 'resend'
import logger from '@adonisjs/core/services/logger'

const resend = new Resend(env.get('RESEND_API_KEY'))

export default class MailService {
	static async sendMagicLink(email: string, code: string, token: string) {
		const appUrl = env.get('APP_URL', 'http://localhost:3333')
		const verifyUrl = `${appUrl}/auth/verify?token=${token}`

		/**
		 * In development, log the code to console so you don't need
		 * a real Resend key to test the auth flow.
		 */
		if (env.get('NODE_ENV') === 'development') {
			logger.info(`[Magic Link] ${email} — code: ${code} — link: ${verifyUrl}`)
		}

		const apiKey = env.get('RESEND_API_KEY')
		if (!apiKey || apiKey === 're_your_key_here') {
			logger.warn('RESEND_API_KEY not configured — skipping email send')
			return
		}

		const { error } = await resend.emails.send({
			from: env.get('MAIL_FROM', 'Kitty Timer <noreply@resend.dev>'),
			to: email,
			subject: 'Your login code for Kitty Timer',
			html: `
				<div style="font-family: system-ui, sans-serif; max-width: 400px; margin: 0 auto; padding: 2rem;">
					<h2 style="margin-bottom: 1.5rem;">Sign in to Kitty Timer</h2>
					<p>Your verification code is:</p>
					<div style="font-size: 2rem; font-weight: bold; letter-spacing: 0.3em; text-align: center; padding: 1rem; background: #f4f4f5; border-radius: 8px; margin: 1rem 0;">
						${code}
					</div>
					<p style="color: #666; font-size: 0.875rem;">
						Or <a href="${verifyUrl}">click here to sign in automatically</a>.
					</p>
					<p style="color: #999; font-size: 0.75rem; margin-top: 2rem;">
						This code expires in 10 minutes. If you didn't request this, you can safely ignore it.
					</p>
				</div>
			`,
		})

		if (error) {
			logger.error({ err: error }, 'Failed to send magic link email')
		}
	}
}
