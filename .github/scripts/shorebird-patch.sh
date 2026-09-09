#!/usr/bin/env bash
#
# Runs `shorebird patch <platform>` and translates the outcome into plain English
# on the GitHub Actions run summary.
#
# Shorebird's own failures are stack traces that say nothing about what to do
# next -- "UnpatchableChangeException" does not tell you that you changed an
# asset and now need a store release. This wrapper classifies the failure and
# prints the actual next steps.
#
# Usage: shorebird-patch.sh <ios|android> <release-version>
set -uo pipefail

PLATFORM="$1"
RELEASE_VERSION="$2"
VAR_NAME="$(echo "$PLATFORM" | tr '[:lower:]' '[:upper:]')_RELEASE_VERSION"

if [ "$PLATFORM" = "ios" ]; then
  CUT_RELEASE='Codemagic -> Start new build -> **iOS · TestFlight release (Shorebird)** on `main`'
  SHIP='App Store Connect -> new version -> attach the build -> submit for review'
else
  CUT_RELEASE='tag the commit: `git tag v1.2.3 && git push origin v1.2.3` -- that runs **Cut store release (baseline)**, and the AAB lands in the run artifacts'
  SHIP='Play Console -> Production -> Create new release -> upload that AAB'
fi

say() { echo -e "$1" >> "${GITHUB_STEP_SUMMARY:-/dev/stdout}"; }

LOG="$(mktemp)"
yes | shorebird patch "$PLATFORM" --release-version="$RELEASE_VERSION" 2>&1 | tee "$LOG"
STATUS=${PIPESTATUS[1]}

# ── Success ─────────────────────────────────────────────────────────────────
if [ "$STATUS" -eq 0 ]; then
  say "### ✅ ${PLATFORM} patch shipped"
  say ""
  say "Devices running **${RELEASE_VERSION}** pick it up on next launch."
  say "Shorebird downloads on one launch and applies on the following one, so testers"
  say "should open the app twice before deciding it did not work."
  say ""
  say "<details><summary>What a patch cannot carry</summary>"
  say ""
  say "These need a full store release even though they feel like small changes:"
  say ""
  say "- anything under \`mobile-app/assets/\` -- images, sounds, fonts"
  say "- \`Info.plist\` / \`AndroidManifest.xml\` edits, e.g. a new permission"
  say "- any package that ships native code"
  say ""
  say "Shorebird catches the first and third. It cannot see the second: a manifest"
  say "change patches \"successfully\" and simply never reaches the device."
  say "</details>"
  exit 0
fi

# ── Failure ─────────────────────────────────────────────────────────────────
say "## ❌ ${PLATFORM} patch did not ship"
say ""

if grep -qi "No release exists" "$LOG"; then
  say "**There is no ${PLATFORM} release at \`${RELEASE_VERSION}\` to patch.**"
  say ""
  say "A patch is a diff on top of a release. The release has to exist first."
  say ""
  say "**What to do**"
  say ""
  say "1. Cut the release: ${CUT_RELEASE}"
  say "2. Check the version it registered at <https://console.shorebird.dev> (Releases, filtered to ${PLATFORM})"
  say "3. Set \`${VAR_NAME}\` in \`.github/workflows/mobile-ota.yml\` to that exact string"
  say "4. ${SHIP} -- patches only reach devices actually running that build"

elif grep -qiE "Podfile\.lock is different|native (code|change)" "$LOG"; then
  say "**This change is native, so it cannot go over the air.**"
  say ""
  say "The app's native dependencies no longer match the release. That usually means"
  say "a new package with native code was added to \`pubspec.yaml\`."
  say ""
  say "Patches replace Dart code only. Anything outside Dart needs a new store build."
  say ""
  say "**What to do**"
  say ""
  say "1. Bump \`version:\` in \`mobile-app/pubspec.yaml\`"
  say "2. Cut the release: ${CUT_RELEASE}"
  say "3. Set \`${VAR_NAME}\` to the new version"
  say "4. ${SHIP}"

elif grep -qiE "asset|Assets\.car" "$LOG"; then
  say "**An asset changed, so this cannot go over the air.**"
  say ""
  say "Assets live inside the app binary, not in patches. Something under"
  say "\`mobile-app/assets/\` was added or edited -- an image, sound or font."
  say ""
  say "Shipping this as a patch would put code on the device referencing a file that"
  say "is not there, so Shorebird stops it."
  say ""
  say "**What to do**"
  say ""
  say "1. Bump \`version:\` in \`mobile-app/pubspec.yaml\`"
  say "2. Cut the release: ${CUT_RELEASE}"
  say "3. Set \`${VAR_NAME}\` to the new version"
  say "4. ${SHIP}"

elif grep -qi "flutter version" "$LOG"; then
  say "**The Flutter version does not match the one that built the release.**"
  say ""
  say "Shorebird locks a patch to the exact Flutter revision of its release."
  say ""
  say "**What to do:** cut a fresh release so the toolchains line up again:"
  say "${CUT_RELEASE}"

else
  say "Not a failure this script recognises, so here is the raw ending:"
  say ""
  say '```'
  tail -30 "$LOG" >> "${GITHUB_STEP_SUMMARY:-/dev/stdout}"
  say '```'
  say ""
  say "If it mentions anything outside Dart -- a plugin, an asset, a permission --"
  say "the answer is almost always a new store release rather than a patch."
fi

say ""
say "_Android and iOS are tracked separately in \`mobile-ota.yml\`; fixing one does not fix the other._"

echo "::error::${PLATFORM} patch failed - see the run summary for what to do"
exit 1
