import type { HttpContext } from '@adonisjs/core/http'

export default class ProfileController {
	async show({ view, auth }: HttpContext) {
		return view.render('pages/profile', { user: auth.user })
	}

	async update({ request, response, auth, session }: HttpContext) {
		const user = auth.user!
		const timezone = request.input('timezone')?.trim()

		if (timezone) {
			user.timezone = timezone
			await user.save()
			session.flash('success', 'Timezone updated.')
		}

		return response.redirect().toRoute('profile.show')
	}
}
