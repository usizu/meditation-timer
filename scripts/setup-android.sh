#!/usr/bin/env bash
set -euo pipefail

#
# setup-android.sh — One-time Android build environment setup
#
# Sets ANDROID_HOME and JAVA_HOME (using Android Studio's bundled JDK)
# in ~/.zshrc so Gradle and Capacitor can find them.
#

ANDROID_SDK="$HOME/Library/Android/sdk"
JAVA_HOME_PATH="/opt/homebrew/opt/openjdk@21"

log() { printf '[setup-android] %s\n' "$@"; }

# ── Verify prerequisites ────────────────────────────────────────────
if [[ ! -d "$ANDROID_SDK" ]]; then
	log "ERROR: Android SDK not found at $ANDROID_SDK"
	log "Open Android Studio and install the SDK first."
	exit 1
fi

if [[ ! -f "$JAVA_HOME_PATH/bin/java" ]]; then
	log "ERROR: JDK not found in Android Studio bundle."
	log "Expected: $JAVA_HOME_PATH"
	log "Make sure Android Studio is installed at /Applications/Android Studio.app"
	exit 1
fi

log "Found Android SDK: $ANDROID_SDK"
log "Found JDK: $JAVA_HOME_PATH"

# ── Add to ~/.zshrc if not already present ──────────────────────────
ZSHRC="$HOME/.zshrc"

add_line() {
	local line="$1"
	if ! grep -qF "$line" "$ZSHRC" 2>/dev/null; then
		echo "$line" >> "$ZSHRC"
		log "Added to ~/.zshrc: $line"
	else
		log "Already in ~/.zshrc: $line"
	fi
}

add_line "export ANDROID_HOME=\"$ANDROID_SDK\""
add_line "export JAVA_HOME=\"$JAVA_HOME_PATH\""
add_line 'export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/build-tools/34.0.0:$PATH"'

log ""
log "Done! Run 'source ~/.zshrc' or open a new terminal, then:"
log "  ./scripts/deploy-android.sh"
