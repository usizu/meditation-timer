#!/usr/bin/env bash
set -euo pipefail

#
# deploy-android.sh — Build Kitty Timer and install on Android device
#
# Usage:
#   ./scripts/deploy-android.sh              # auto-detect connected device
#   ./scripts/deploy-android.sh <device-id>  # target a specific device
#
# Prerequisites:
#   - Run ./scripts/setup-android.sh once to configure env vars
#   - Enable USB debugging on your Android device
#

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_FILE="$PROJECT_DIR/scripts/deploy.log"
DEPLOY_HISTORY="$PROJECT_DIR/scripts/deploy-history.jsonl"
DEVICE_ID="${1:-}"

# ── Env defaults (in case shell hasn't been reloaded) ───────────────
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@21}"
export PATH="$ANDROID_HOME/platform-tools:$JAVA_HOME/bin:$PATH"

ADB="$ANDROID_HOME/platform-tools/adb"
GRADLE="$PROJECT_DIR/android/gradlew"

log() { printf '[%s] %s\n' "$(date '+%H:%M:%S')" "$@" | tee -a "$LOG_FILE"; }

# ── Verify prerequisites ────────────────────────────────────────────
if [[ ! -f "$ADB" ]]; then
	log "ERROR: adb not found at $ADB"
	log "Run ./scripts/setup-android.sh first."
	exit 1
fi

if ! "$JAVA_HOME/bin/java" -version &>/dev/null; then
	log "ERROR: Java not working. Run ./scripts/setup-android.sh first."
	exit 1
fi

if [[ ! -d "$PROJECT_DIR/android" ]]; then
	log "ERROR: Android platform not added. Run: pnpm exec cap add android"
	exit 1
fi

# Capture git state before build
GIT_COMMIT=$(git -C "$PROJECT_DIR" rev-parse HEAD 2>/dev/null || echo "unknown")
GIT_COMMIT_SHORT=$(git -C "$PROJECT_DIR" rev-parse --short HEAD 2>/dev/null || echo "unknown")
GIT_BRANCH=$(git -C "$PROJECT_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
GIT_DIRTY=$(git -C "$PROJECT_DIR" status --porcelain 2>/dev/null | head -1)
GIT_COMMIT_MSG=$(git -C "$PROJECT_DIR" log -1 --pretty=%s 2>/dev/null || echo "unknown")
APP_VERSION=$(node -p "require('$PROJECT_DIR/package.json').version" 2>/dev/null || echo "unknown")

cd "$PROJECT_DIR"

log "=== Kitty Timer Android deploy ==="
log "Version: $APP_VERSION | Commit: $GIT_COMMIT_SHORT ($GIT_BRANCH) | Dirty: ${GIT_DIRTY:+yes}"

# ── Find device ─────────────────────────────────────────────────────
if [[ -z "$DEVICE_ID" ]]; then
	DEVICE_ID=$("$ADB" devices | awk 'NR>1 && /device$/ {print $1; exit}')

	if [[ -z "$DEVICE_ID" ]]; then
		log "ERROR: No connected Android device found."
		log "Make sure USB debugging is enabled and the device is connected."
		log "Run '$ADB devices' to check."
		exit 1
	fi
fi
log "Target device: $DEVICE_ID"

# ── Build web assets ────────────────────────────────────────────────
log "Building web assets (CAP=1)..."
CAP=1 pnpm exec vite build 2>&1 | tee -a "$LOG_FILE"

# ── Sync to Capacitor Android ──────────────────────────────────────
log "Syncing to Android..."
pnpm exec cap sync android 2>&1 | tee -a "$LOG_FILE"

# ── Build APK with Gradle ──────────────────────────────────────────
log "Building debug APK..."
"$GRADLE" -p "$PROJECT_DIR/android" assembleDebug 2>&1 | tee -a "$LOG_FILE"

APK_PATH="$PROJECT_DIR/android/app/build/outputs/apk/debug/app-debug.apk"

if [[ ! -f "$APK_PATH" ]]; then
	log "ERROR: APK not found at $APK_PATH"
	exit 1
fi

log "APK built: $APK_PATH"

# ── Install on device ──────────────────────────────────────────────
log "Installing on device $DEVICE_ID..."
"$ADB" -s "$DEVICE_ID" install -r "$APK_PATH" 2>&1 | tee -a "$LOG_FILE"

# ── Launch the app ──────────────────────────────────────────────────
log "Launching app..."
"$ADB" -s "$DEVICE_ID" shell am start -n com.kitty.timer/.MainActivity 2>&1 | tee -a "$LOG_FILE"

# ── Record deploy to history ───────────────────────────────────────
DEPLOY_ENTRY=$(printf '{"timestamp":"%s","version":"%s","commit":"%s","commit_short":"%s","branch":"%s","dirty":%s,"commit_msg":"%s","device":"%s","platform":"android"}' \
	"$(date -u '+%Y-%m-%dT%H:%M:%SZ')" \
	"$APP_VERSION" \
	"$GIT_COMMIT" \
	"$GIT_COMMIT_SHORT" \
	"$GIT_BRANCH" \
	"$([ -n "$GIT_DIRTY" ] && echo 'true' || echo 'false')" \
	"$(echo "$GIT_COMMIT_MSG" | sed 's/"/\\"/g')" \
	"$DEVICE_ID")
echo "$DEPLOY_ENTRY" >> "$DEPLOY_HISTORY"

log "=== Android deploy complete ==="
