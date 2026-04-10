import type { HttpContext } from '@adonisjs/core/http'

export default class ProfileController {
	async show({ view, auth }: HttpContext) {
		return view.render('pages/profile', { user: auth.user })
	}

	async update({ request, response, auth, session }: HttpContext) {
		const user = auth.user!
		const timezone = request.input('timezone')?.trim()
		const nickname = request.input('nickname')
		const status = request.input('status')

		if (timezone) user.timezone = timezone
		if (nickname !== undefined) user.nickname = nickname.trim().slice(0, 32) || null
		if (status !== undefined) user.status = status.trim().slice(0, 128) || null

		await user.save()
		session.flash('success', 'Profile updated.')

		return response.redirect().toRoute('profile.show')
	}
}
