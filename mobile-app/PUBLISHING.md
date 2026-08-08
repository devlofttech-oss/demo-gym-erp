# Publishing Kilos to the Play Store & App Store + CI/CD

This is the roadmap from "runs on my machine" to "installable from the stores".
It's a checklist, not a one-click step — store publishing has accounts, signing,
and review gates that only a human with the right credentials can complete.

---

## 0. One-time prerequisites

| Need | Play Store (Android) | App Store (iOS) |
|------|----------------------|-----------------|
| Developer account | Google Play Console — **$25 once** | Apple Developer Program — **$99/year** |
| Build machine | Any (Windows/Linux/Mac) | **macOS + Xcode only** (see note) |
| Signing | Upload keystore (we create it) | Apple certificates + provisioning profiles |
| App identity | `applicationId = com.devloft.kilos` (already set) | Bundle ID `com.devloft.kilos` (already set) |

> **iOS reality check:** you cannot build or upload an iOS app from Windows.
> You need either a Mac (with Xcode) **or** a cloud-mac CI service (Codemagic /
> GitHub Actions macOS runner / MacStadium). Everything else below you can do on
> this Windows PC.

---

## 1. App version & identity

`pubspec.yaml` → `version: 1.0.0+1` means **versionName 1.0.0**, **versionCode 1**.
Bump the `+N` build number on every store upload (stores reject a re-used code).

Set the display name, icon, and splash before first upload:
- App name: already "Kilos" (Android manifest label / iOS `CFBundleDisplayName`).
- Launcher icon: use `flutter_launcher_icons` (add a 1024×1024 PNG, run the generator).
- Splash: use `flutter_native_splash`.

---

## 2. Firebase for release builds (important)

The app currently uses the **web** Firebase config for all platforms. That works
for Firestore + email/password today, but for a store release you should register
**dedicated Android and iOS apps** in the Firebase console (project `gym-erp-demo`):

1. Firebase Console → Project settings → **Add app** → Android
   - package name `com.devloft.kilos`
   - add the **SHA-1 & SHA-256** of your upload/Play-signing keys (required if you
     ever add Google/phone sign-in; harmless otherwise)
   - download `google-services.json` → `mobile-app/android/app/`
2. Add app → iOS, bundle id `com.devloft.kilos` → download `GoogleService-Info.plist`
   → `mobile-app/ios/Runner/`
3. (Optional but recommended) run `flutterfire configure` to regenerate
   `lib/firebase_options.dart` with real per-platform app IDs.

No data changes — same project, same accounts, same members.

---

## 3. Android → Play Store

### 3a. Create an upload keystore (once)
```bash
keytool -genkey -v -keystore %USERPROFILE%\kilos-upload.jks ^
  -keyalg RSA -keysize 2048 -validity 10000 -alias kilos
```
Create `mobile-app/android/key.properties` (DO NOT commit — add to .gitignore):
```
storePassword=********
keyPassword=********
keyAlias=kilos
storeFile=C:/Users/<you>/kilos-upload.jks
```
Wire it into `android/app/build.gradle.kts` (`signingConfigs` + `buildTypes.release`).

### 3b. Build the release bundle
```bash
flutter build appbundle          # -> build/app/outputs/bundle/release/app-release.aab
```

### 3c. Upload
Play Console → Create app → fill **store listing, content rating, data safety,
privacy policy** → upload the `.aab` to the **Internal testing** track first →
add testers → promote to **Production** when ready. First review: hours to a few days.

---

## 4. iOS → App Store (needs a Mac / cloud-mac)

1. Xcode → open `mobile-app/ios/Runner.xcworkspace`, set the team & signing.
2. App Store Connect → create the app record (bundle id `com.devloft.kilos`).
3. Build & upload:
   ```bash
   flutter build ipa               # -> build/ios/ipa/*.ipa
   ```
   Upload via Xcode Organizer or Transporter.
4. Distribute to **TestFlight** for testing → submit for **App Store review**.

---

## 5. CI/CD options

Goal: on every tagged release, automatically test → build → upload to the stores.

| Tool | Best for | Notes |
|------|----------|-------|
| **Codemagic** | Flutter specifically | Purpose-built for Flutter; includes **macOS runners** so you can ship iOS without owning a Mac; UI-driven + `codemagic.yaml`; generous free minutes. Easiest path for both stores. |
| **GitHub Actions** | Teams already on GitHub | Free-ish; `ubuntu` runner for Android, `macos` runner for iOS; you wire it up with Fastlane. Most flexible, most config. |
| **Bitrise** | Mobile-focused teams | Visual workflow builder, strong mobile step library; free tier is limited. |
| **Fastlane** | The upload layer | Not a CI itself — the tool CI calls to actually push to Play/TestFlight (`supply` for Play, `pilot`/`deliver` for App Store). Runs under any of the above. |

**Recommendation for this project:** start with **Codemagic** — it's the lowest-friction
way to build *both* Android and iOS (its macOS runners remove the "I'm on Windows"
iOS blocker), and it understands Flutter out of the box. Move to **GitHub Actions +
Fastlane** later if you want everything in your own repo and more control.

### Secrets a pipeline needs
- Android: the upload keystore (base64) + `key.properties` values + a **Play service
  account JSON** (Play Console → API access) for automated upload.
- iOS: an **App Store Connect API key** (.p8) + signing certs/profiles (Fastlane
  `match` can manage these).
- `google-services.json` / `GoogleService-Info.plist` (or commit them — they're not
  secret, but many teams inject via CI).

### Minimal pipeline shape (any tool)
```
on: push tag v*
  1. flutter pub get
  2. flutter analyze && flutter test
  3. flutter build appbundle   ->  upload to Play "internal" track (Fastlane supply)
  4. flutter build ipa         ->  upload to TestFlight (Fastlane pilot)   [macOS runner]
```

A starter `codemagic.yaml` or `.github/workflows/release.yml` can be generated when
you pick a tool and have the developer accounts + signing set up.

---

## TL;DR
1. **Android APK/AAB** — buildable right here on Windows today. Play account ($25),
   keystore, `flutter build appbundle`, upload.
2. **iOS** — needs a Mac or a cloud-mac (Codemagic/GitHub macOS). Apple account ($99/yr).
3. **CI/CD** — Codemagic is the smoothest for Flutter + both stores; GitHub Actions +
   Fastlane if you want it in-repo. Set up developer accounts & signing first, then
   wire the pipeline.
