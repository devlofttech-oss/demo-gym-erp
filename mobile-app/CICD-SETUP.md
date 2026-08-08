# CI/CD: "push to GitHub → update on users' phones" (Android + iOS)

The pipeline is **GitHub Actions + Shorebird**. Two workflows are already in the
repo under `.github/workflows/`:

- **`mobile-ota.yml`** — on every push to `main` that touches `mobile-app/`, pushes
  your Dart change **over-the-air to installed Android + iOS devices** (Shorebird
  patch). Users get it on next app launch. No store review. *This is the "push →
  phones" magic.*
- **`mobile-release.yml`** — on a version tag (`v1.2.0`), cuts a fresh signed store
  build + a new Shorebird **baseline**. Run this only for native changes / version
  bumps.

### The mental model
```
NATIVE change (new plugin/permission)   → tag v1.x.0 → mobile-release.yml → stores + new baseline (Apple review, user update)
DART change  (new module, UI, logic)    → push main → mobile-ota.yml     → instant on all phones, both platforms
```
Almost every Kilos module is Dart + Firestore, so almost everything ships instantly.

---

## One-time setup (do these once, then it "just works")

Nothing runs until these are in place — CI can't create accounts or sign for you.

### 1. Shorebird account (the OTA engine)
```bash
cd mobile-app
dart pub global activate shorebird_cli   # or install from shorebird.dev
shorebird login
shorebird init                           # registers the app, writes real app_id into shorebird.yaml
shorebird login:ci                       # prints a CI token
```
Add the token as GitHub secret **`SHOREBIRD_TOKEN`**.

### 2. First baseline release to BOTH stores
Shorebird patches sit on top of a released version, so you need one real store
release first (this is the only step that needs the developer accounts):
- **Android:** Google Play Developer account ($25). Create an upload keystore, then
  `shorebird release android` and upload the AAB to Play.
- **iOS:** Apple Developer account ($99/yr) + a Mac *or* the macOS CI runner already
  in `mobile-release.yml`. `shorebird release ios`, upload IPA to TestFlight/App Store.

### 3. Register Android/iOS apps in Firebase (`gym-erp-demo`)
Add `google-services.json` (Android) and `GoogleService-Info.plist` (iOS) — package/
bundle id `com.devloft.kilos`. Same project, same data.

### 4. GitHub secrets to add (Settings → Secrets → Actions)
| Secret | For |
|--------|-----|
| `SHOREBIRD_TOKEN` | OTA patches + releases (both platforms) |
| `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEY_PROPERTIES` | signing the Android release |
| `APPLE_CERT_*` / App Store Connect API key (.p8) | signing + uploading iOS |
| Play service-account JSON | auto-upload AAB to Play |

---

## After setup — your day-to-day
1. Build a module in Flutter.
2. `git push` to `main`.
3. `mobile-ota.yml` runs → the change is live on every installed Android and iPhone
   on next launch. Done.

You only touch `mobile-release.yml` (tag + store review) when a change is native.

> Prefer zero YAML? **Codemagic** does the same thing with a UI and built-in macOS —
> point it at this GitHub repo, add the same secrets, enable Shorebird. The workflows
> here are the in-repo equivalent.
