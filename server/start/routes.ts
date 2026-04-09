import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const AuthController = () => import('#controllers/auth_controller')
const FriendsController = () => import('#controllers/friends_controller')
const MeditationsController = () => import('#controllers/meditations_controller')
const SseController = () => import('#controllers/sse_controller')
const PushSubscriptionsController = () => import('#controllers/push_subscriptions_controller')
const ProfileController = () => import('#controllers/profile_controller')
const ApiAuthController = () => import('#controllers/api_auth_controller')
const ApiFriendsController = () => import('#controllers/api_friends_controller')
const ApiProfileController = () => import('#controllers/api_profile_controller')

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

		router.get('/profile', [ProfileController, 'show']).as('profile.show')
		router.post('/profile', [ProfileController, 'update']).as('profile.update')

		router.get('/friends', [FriendsController, 'index']).as('friends.index')
		router.post('/friends', [FriendsController, 'store']).as('friends.store')
		router.delete('/friends/:id', [FriendsController, 'destroy']).as('friends.destroy')
		router.patch('/friends/:id/toggles', [FriendsController, 'updateToggles']).as('friends.toggles')
	})
	.use(middleware.auth())

/*
|--------------------------------------------------------------------------
| API routes (JSON, called from the PWA)
|--------------------------------------------------------------------------
*/
router
	.group(() => {
		/* Auth — login/verify are public, logout/check need auth */
		router.post('/auth/login', [ApiAuthController, 'login'])
		router.post('/auth/verify', [ApiAuthController, 'verify'])
		router.post('/auth/logout', [ApiAuthController, 'logout']).use(middleware.apiAuth())
		router.get('/auth/check', [ApiAuthController, 'check']).use(middleware.apiAuth())

		/* Friends */
		router.get('/friends', [ApiFriendsController, 'index']).use(middleware.apiAuth())
		router.post('/friends', [ApiFriendsController, 'store']).use(middleware.apiAuth())
		router.delete('/friends/:id', [ApiFriendsController, 'destroy']).use(middleware.apiAuth())
		router
			.patch('/friends/:id/toggles', [ApiFriendsController, 'updateToggles'])
			.use(middleware.apiAuth())

		/* Profile */
		router.get('/profile', [ApiProfileController, 'show']).use(middleware.apiAuth())
		router.post('/profile', [ApiProfileController, 'update']).use(middleware.apiAuth())

		/* Meditations + Push (existing, switched to apiAuth) */
		router.post('/meditations/start', [MeditationsController, 'start']).use(middleware.apiAuth())
		router.post('/meditations/end', [MeditationsController, 'end']).use(middleware.apiAuth())
		router.get('/push/vapid-key', [PushSubscriptionsController, 'vapidKey']).use(middleware.apiAuth())
		router.post('/push-subscriptions', [PushSubscriptionsController, 'store']).use(middleware.apiAuth())
		router
			.delete('/push-subscriptions/:id', [PushSubscriptionsController, 'destroy'])
			.use(middleware.apiAuth())
	})
	.prefix('/api')

/*
|--------------------------------------------------------------------------
| SSE routes (Datastar real-time updates)
|--------------------------------------------------------------------------
*/
router
	.group(() => {
		router.get('/updates', [SseController, 'updates']).as('sse.updates')
	})
	.prefix('/sse')
	.use(middleware.auth())
