#!/usr/bin/env bash
set -euo pipefail

# Kitty Timer — Production build script
#
# Builds both the static PWA (Vite) and the AdonisJS server.
# Run from the repo root:
#   bash deploy/build.sh

echo "=== Building PWA (Vite) ==="
pnpm install --frozen-lockfile
pnpm build
echo "PWA built → dist/"

echo ""
echo "=== Building AdonisJS server ==="
cd server
pnpm install --frozen-lockfile
node ace build
echo "Server built → server/build/"

echo ""
echo "=== Generating VAPID keys (if not set) ==="
if [ -f .env ] && grep -q 'VAPID_PUBLIC_KEY=$' .env; then
    echo "VAPID keys not configured. Generate them with:"
    echo "  cd server && node bin/generate-vapid-keys.js"
    echo "Then add the output to server/.env"
else
    echo "VAPID keys already configured."
fi

echo ""
echo "=== Running migrations ==="
cd build
node bin/console.js migration:run --force
cd ..

echo ""
echo "=== Done ==="
echo "Start with: pm2 start deploy/ecosystem.config.cjs"
