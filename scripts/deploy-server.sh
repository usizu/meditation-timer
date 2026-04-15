#!/usr/bin/env bash
set -euo pipefail

# ── Config ──
VPS="contabovps"
APP_DIR="/var/www/apps/mugen"
PM2="/root/.bun/bin/pm2"
APP_NAME="mugen"
BRANCH="prod"

echo "🚀 Deploying $APP_NAME to $VPS..."

ssh "$VPS" bash -l <<'REMOTE'
set -euo pipefail

APP_DIR="/var/www/apps/mugen"
PM2="/root/.bun/bin/pm2"
APP_NAME="mugen"
BRANCH="prod"

cd "$APP_DIR"

echo "📥 Pulling latest..."
git pull origin "$BRANCH"

echo "📦 Installing frontend deps..."
pnpm install

echo "🔨 Building frontend..."
pnpm exec vite build

echo "📦 Installing server deps..."
cd "$APP_DIR/server"
pnpm install

echo "🔨 Building server..."
node ace build

cd "$APP_DIR/server/build"

echo "📦 Installing production deps..."
pnpm install --prod

echo "🔗 Linking .env and ensuring dirs..."
ln -sf "$APP_DIR/server/.env" .env
mkdir -p tmp

echo "🗃️ Running migrations..."
NODE_ENV=production node ace migration:run --force

echo "♻️ Restarting process..."
if "$PM2" describe "$APP_NAME" > /dev/null 2>&1; then
	NODE_ENV=production "$PM2" restart "$APP_NAME" --update-env
else
	NODE_ENV=production "$PM2" start bin/server.js --name "$APP_NAME"
	"$PM2" save
fi

echo "✅ Deploy complete!"
"$PM2" status "$APP_NAME"
REMOTE

echo "⏳ Finished at: $(date +"%F_%T")"
