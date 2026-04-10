import { defineConfig } from '@adonisjs/cors'

const corsConfig = defineConfig({
	enabled: true,
	origin: [
		'capacitor://localhost',
		'http://localhost',
		'https://localhost',
		'https://mugen.usizu.xyz',
	],
	methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
	headers: true,
	credentials: true,
	maxAge: 90,
})

export default corsConfig
