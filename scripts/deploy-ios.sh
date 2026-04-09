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
DEPLOY_HISTORY="$PROJECT_DIR/scripts/deploy-history.jsonl"
XCODE_PROJECT="$PROJECT_DIR/ios/App/App.xcodeproj"
SCHEME="App"
DEVICE_ID="${1:-}"

log() { printf '[%s] %s\n' "$(date '+%H:%M:%S')" "$@" | tee -a "$LOG_FILE"; }

# Capture git state before build
GIT_COMMIT=$(git -C "$PROJECT_DIR" rev-parse HEAD 2>/dev/null || echo "unknown")
GIT_COMMIT_SHORT=$(git -C "$PROJECT_DIR" rev-parse --short HEAD 2>/dev/null || echo "unknown")
GIT_BRANCH=$(git -C "$PROJECT_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
GIT_DIRTY=$(git -C "$PROJECT_DIR" status --porcelain 2>/dev/null | head -1)
GIT_COMMIT_MSG=$(git -C "$PROJECT_DIR" log -1 --pretty=%s 2>/dev/null || echo "unknown")
APP_VERSION=$(node -p "require('$PROJECT_DIR/package.json').version" 2>/dev/null || echo "unknown")

cd "$PROJECT_DIR"

log "=== Kitty Timer iOS deploy ==="
log "Version: $APP_VERSION | Commit: $GIT_COMMIT_SHORT ($GIT_BRANCH) | Dirty: ${GIT_DIRTY:+yes}"

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

# ── Clean stale DerivedData ─────────────────────────────────────────
log "Cleaning DerivedData..."
rm -rf "$PROJECT_DIR/ios/DerivedData" "$PROJECT_DIR/ios/App/DerivedData"

# ── Build native app ────────────────────────────────────────────────
log "Building Xcode project..."
xcodebuild \
	-project "$XCODE_PROJECT" \
	-scheme "$SCHEME" \
	-sdk iphoneos \
	-configuration Debug \
	-allowProvisioningUpdates \
	-derivedDataPath "$PROJECT_DIR/ios/DerivedData" \
	build 2>&1 | tee -a "$LOG_FILE"

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

# ── Record deploy to history ────────────────────────────────────────
DEPLOY_ENTRY=$(printf '{"timestamp":"%s","version":"%s","commit":"%s","commit_short":"%s","branch":"%s","dirty":%s,"commit_msg":"%s","device":"%s"}' \
	"$(date -u '+%Y-%m-%dT%H:%M:%SZ')" \
	"$APP_VERSION" \
	"$GIT_COMMIT" \
	"$GIT_COMMIT_SHORT" \
	"$GIT_BRANCH" \
	"$([ -n "$GIT_DIRTY" ] && echo 'true' || echo 'false')" \
	"$(echo "$GIT_COMMIT_MSG" | sed 's/"/\\"/g')" \
	"$DEVICE_ID")
echo "$DEPLOY_ENTRY" >> "$DEPLOY_HISTORY"

log "=== Deploy complete (recorded to deploy-history.jsonl) ==="
