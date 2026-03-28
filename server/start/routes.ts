import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const AuthController = () => import('#controllers/auth_controller')
const FriendsController = () => import('#controllers/friends_controller')

/*
|--------------------------------------------------------------------------
| Auth routes
|--------------------------------------------------------------------------
*/
router
	.group(() => {
		router.get('/login', [AuthController, 'showLogin']).as('auth.login').use(middleware.guest())
		router.post('/login', [AuthController, 'sendMagicLink']).as('auth.send').use(middleware.guest())
		router.get('/verify', [AuthController, 'verifyFromLink']).as('auth.verify.link')
		router.get('/verify/code', [AuthController, 'showVerify']).as('auth.verify.show')
		router.post('/verify', [AuthController, 'verify']).as('auth.verify')
		router.post('/logout', [AuthController, 'logout']).as('auth.logout')
	})
	.prefix('/auth')

/*
|--------------------------------------------------------------------------
| Protected routes
|--------------------------------------------------------------------------
*/
router
	.group(() => {
		router.get('/', async ({ view, auth }) => {
			return view.render('pages/home', { user: auth.user })
		}).as('home')

		router.get('/friends', [FriendsController, 'index']).as('friends.index')
		router.post('/friends', [FriendsController, 'store']).as('friends.store')
		router.delete('/friends/:id', [FriendsController, 'destroy']).as('friends.destroy')
		router.patch('/friends/:id/toggles', [FriendsController, 'updateToggles']).as('friends.toggles')
	})
	.use(middleware.auth())
