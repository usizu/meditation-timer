#!/usr/bin/env bash
set -euo pipefail

#
# deploy-ios.sh — Build Kitty Timer and install on iPhone
#
# Usage:
#   ./scripts/deploy-ios.sh              # auto-detect connected device
#   ./scripts/deploy-ios.sh <device-id>  # target a specific device
#
# Free Apple developer accounts expire provisioning after 7 days.
# Run this daily (or use the launchd plist) to keep the app alive.
#

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_FILE="$PROJECT_DIR/scripts/deploy.log"
XCODE_PROJECT="$PROJECT_DIR/ios/App/App.xcodeproj"
SCHEME="App"
DEVICE_ID="${1:-}"

log() { printf '[%s] %s\n' "$(date '+%H:%M:%S')" "$@" | tee -a "$LOG_FILE"; }

cd "$PROJECT_DIR"

log "=== Kitty Timer iOS deploy ==="

# ── Find device ──────────────────────────────────────────────────────
if [[ -z "$DEVICE_ID" ]]; then
	DEVICE_ID=$(xcrun devicectl list devices 2>/dev/null \
		| awk '/iPhone/ && (/connected/ || /available/) {print $3; exit}')

	if [[ -z "$DEVICE_ID" ]]; then
		log "ERROR: No paired iPhone found. Connect your phone and try again."
		exit 1
	fi
fi
log "Target device: $DEVICE_ID"

# ── Build web assets ─────────────────────────────────────────────────
log "Building web assets (CAP=1)..."
CAP=1 pnpm exec vite build 2>&1 | tee -a "$LOG_FILE"

# ── Sync to Capacitor iOS ───────────────────────────────────────────
log "Syncing to iOS..."
pnpm exec cap sync ios 2>&1 | tee -a "$LOG_FILE"

# ── Build native app ────────────────────────────────────────────────
log "Building Xcode project..."
xcodebuild \
	-project "$XCODE_PROJECT" \
	-scheme "$SCHEME" \
	-sdk iphoneos \
	-configuration Debug \
	-allowProvisioningUpdates \
	-derivedDataPath "$PROJECT_DIR/ios/DerivedData" \
	build 2>&1 | tail -5 | tee -a "$LOG_FILE"

# ── Install on device ───────────────────────────────────────────────
APP_PATH=$(find "$PROJECT_DIR/ios/DerivedData/Build/Products/Debug-iphoneos" \
	-name "*.app" -maxdepth 1 | head -1)

if [[ -z "$APP_PATH" ]]; then
	log "ERROR: Built .app not found in DerivedData"
	exit 1
fi

log "Installing $APP_PATH on device..."
xcrun devicectl device install app \
	--device "$DEVICE_ID" \
	"$APP_PATH" 2>&1 | tee -a "$LOG_FILE"

log "=== Deploy complete ==="
