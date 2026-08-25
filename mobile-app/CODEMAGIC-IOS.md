# Shipping Kilos to iOS from Windows, via Codemagic

You don't own a Mac. Codemagic rents you one per build. This is the exact path
from "repo on GitHub" to "app in TestFlight", plus what had to change in the
repo to make it possible.

The pipeline lives in [`codemagic.yaml`](../codemagic.yaml) at the **repo root**
(Codemagic only looks there). Both workflows set `working_directory: mobile-app`
because the repo root is the React web app, not the Flutter project — that is
also why Codemagic's UI said "No configuration file found" and offered you a
React Native quick start.

---

## Step 0 — build check, before you spend a rupee on Apple

Push this branch, then in Codemagic open the app → **Start new build** → pick
workflow **`iOS · unsigned build check`**.

It runs `flutter build ios --release --no-codesign` on a real macOS machine. No
Apple account, no certificates, no App Store record. If it goes green, the
project compiles for iOS and everything after this is paperwork. If it goes red,
fix that first — layering a signing setup on top of a broken build just burns
minutes.

---

## Step 1 — Apple Developer Program

- Enrol at <https://developer.apple.com/programs/> — **$99/year**. Individual is
  fine; Organization needs a D-U-N-S number and takes longer.
- Approval usually takes a day or two.

## Step 2 — App Store Connect API key

This is what lets Codemagic sign and upload without a Mac in the room.

1. <https://appstoreconnect.apple.com> → **Users and Access** → **Integrations**
   → **App Store Connect API** → **+**
2. Name it `Codemagic`, access **App Manager**, generate.
3. Download the `.p8` **once** (Apple never shows it again). Note the **Key ID**
   and the **Issuer ID** from that page.

## Step 3 — Register the key in Codemagic

Codemagic → avatar → **Teams / Personal Account** → **Integrations** →
**App Store Connect** → **Add key**:

| Field | Value |
|-------|-------|
| Name | `Kilos App Store Connect` |
| Issuer ID | from step 2 |
| Key ID | from step 2 |
| Private key | the `.p8` file |

> The **name must match exactly** — `codemagic.yaml` references it under
> `integrations.app_store_connect`. Change one, change the other.

## Step 4 — Register the Bundle ID and the app record

1. <https://developer.apple.com/account/resources/identifiers> → **+** →
   App IDs → App → Bundle ID **`com.devloft.kilos`** (explicit, not wildcard).
   Leave capabilities alone for now.
2. App Store Connect → **My Apps** → **+** → **New App**
   - Platform iOS, name `Kilos`, primary language, Bundle ID `com.devloft.kilos`
   - SKU: anything unique, e.g. `kilos-001`
3. Open the new app → **App Information** → copy the 10-digit **Apple ID**.

Put that number into `codemagic.yaml` → `APP_STORE_APP_ID`, replacing the
`CHANGEME` placeholder. It is what makes each build auto-increment past the last
one TestFlight saw.

> Every var in `codemagic.yaml` ships with a literal `CHANGEME` value —
> Codemagic's validator rejects empty strings, so blanks aren't an option. The
> build script treats `CHANGEME` as "not set yet" and carries on with a fallback,
> which is why an unconfigured release build still runs instead of erroring.

## Step 5 — Register the iOS app in Firebase (required)

**This one bites at runtime, not build time.** The app currently ships the *web*
Firebase app id (`1:...:web:...`) for every platform. Android tolerates it; the
native iOS Firebase SDK validates the format and refuses to initialise, so the
app launches straight into a crash.

1. Firebase console → project **`gym-erp-demo`** → **Add app** → **iOS**
2. Bundle ID `com.devloft.kilos` → register
3. From **Project settings → Your apps → the iOS app**, copy:
   - **App ID** — looks like `1:1042216377771:ios:abcdef123456`
   - **API key**
4. Paste both into `codemagic.yaml`, over the `CHANGEME` placeholders in
   `FIREBASE_IOS_APP_ID` and `FIREBASE_IOS_API_KEY`.

They are not secrets — they ship inside every copy of the app — so keeping them
in the YAML is fine, and it is where `lib/firebase_options.dart` now looks for
them (via `--dart-define`, with the old web values as the fallback).

## Step 6 — Ship it

Codemagic → **Start new build** → workflow **`iOS · TestFlight release`**.

Codemagic creates the distribution certificate and provisioning profile for you
(that is the `ios_signing` block), builds the `.ipa`, and uploads it to
TestFlight. Expect roughly 15–25 minutes for a first build.

Then in App Store Connect: **TestFlight** → add yourself as an internal tester →
install Apple's TestFlight app on the iPhone → the build shows up. That is a
real install on a real device, driven entirely from Windows.

For the public App Store you additionally need screenshots, a description, a
privacy policy URL, the privacy questionnaire, and an age rating — then flip
`submit_to_app_store: true` in `codemagic.yaml`. First review is typically
24–48 hours.

---

## What changed in the repo to make iOS buildable

The `ios/` folder had never been through a real build. These were all blockers:

| Change | Why |
|--------|-----|
| `ios/Runner.xcodeproj` deployment target **13.0 → 15.0** | `firebase_core` 4.x pulls Firebase iOS SDK 12.x, which requires iOS 15. At 13.0 dependency resolution fails outright. |
| Added **`ios/Podfile`** | The project had none. Any plugin without Swift Package Manager support (`flutter_local_notifications`, `printing`, …) needs CocoaPods. Pins `platform :ios, '15.0'` and forces every pod target up to 15.0. |
| `ios/Flutter/{Debug,Release}.xcconfig` now `#include?` the Pods xcconfig | Without it the Pods build settings never reach the Runner target and linking fails. `#include?` is optional, so it is a no-op when CocoaPods isn't used. |
| `Info.plist`: added `NSPhotoLibraryUsageDescription` and `NSPhotoLibraryAddUsageDescription` | `image_picker` links PhotoKit. Missing purpose strings mean a crash on use and an App Store rejection. |
| `Info.plist`: added `ITSAppUsesNonExemptEncryption = false` | Otherwise every upload stops and asks the export-compliance question by hand. |
| `lib/firebase_options.dart`: iOS app id and API key overridable via `--dart-define` | See step 5. |

Left alone on purpose:

- **Push notifications.** `firebase_messaging` is in `pubspec.yaml` but never
  imported in Dart. Adding an `aps-environment` entitlement before the App ID
  has the Push capability enabled would break signing. Enable Push on the App ID
  first, then add a `Runner.entitlements`.
- **`PrivacyInfo.xcprivacy`.** The Flutter engine and the plugins ship their own
  privacy manifests. If App Store Connect emails an `ITMS-91053` warning after
  the first upload, add an app-level manifest then.
- **`image_picker`, `firebase_storage`, `flutter_local_notifications`** are
  declared but never imported. They still get compiled and reviewed — dropping
  them from `pubspec.yaml` would shrink both the binary and the review surface.

---

## Heads-up: Codemagic vs. the Shorebird OTA pipeline

[`CICD-SETUP.md`](CICD-SETUP.md) describes a GitHub Actions + Shorebird setup
where Dart-only changes go out over the air. Shorebird patches only apply on top
of a build produced by `shorebird release ios`. **`codemagic.yaml` uses plain
`flutter build ipa`, so builds it produces cannot receive Shorebird patches.**

Pick one:

- **Codemagic only** (what is wired up here) — every change ships as a normal
  App Store update. Simple, no extra token.
- **Codemagic + Shorebird** — install the Shorebird CLI in the release workflow,
  add `SHOREBIRD_TOKEN` as an encrypted variable, and swap the build step for
  `shorebird release ios`. Then `mobile-ota.yml` can patch it.
  See <https://docs.shorebird.dev/ci/codemagic/>.

---

## When a build goes red

| Symptom | Cause |
|---------|-------|
| `Specs satisfying the ... dependency were found, but they required a higher minimum deployment target` | A pod wants more than iOS 15.0. Raise it in `ios/Podfile` **and** in `Runner.xcodeproj` — the two must match. |
| `No profiles for 'com.devloft.kilos' were found` | Bundle ID not registered (step 4), or the API key lacks App Manager access. |
| Invalid App Store Connect integration name | The `integrations.app_store_connect` value doesn't match the key name from step 3. |
| Upload rejected for an invalid build number | Build number reused. Set `APP_STORE_APP_ID` so it auto-increments. |
| App installs, then crashes instantly on launch | `FIREBASE_IOS_APP_ID` is still `CHANGEME` — step 5. |
| `Missing Compliance` on every TestFlight build | `ITSAppUsesNonExemptEncryption` didn't make it into the build. |
