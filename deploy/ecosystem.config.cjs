/**
 * PM2 ecosystem config for the AdonisJS server.
 *
 * Usage:
 *   pm2 start deploy/ecosystem.config.cjs
 *   pm2 save
 *   pm2 startup
 */

module.exports = {
	apps: [
		{
			name: 'kitty-timer-server',
			cwd: './server',
			script: 'build/bin/server.js',
			instances: 1,
			autorestart: true,
			watch: false,
			env: {
				NODE_ENV: 'production',
				PORT: 3333,
				HOST: '127.0.0.1',
			},
		},
	],
};
