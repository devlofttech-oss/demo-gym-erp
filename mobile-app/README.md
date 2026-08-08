# Kilos — Mobile App (Flutter)

A native Android/iOS client for the Kilos Gym ERP. It is a **second frontend onto
the same Firebase backend** as the web app (`gym-erp-demo`): a client logs in with
the same account and sees the same live data. A member added on the website appears
in the app instantly, and vice versa.

This is **Phase 1** — a 1:1 visual/behavioral port of five modules:

| Module | Screen(s) |
|--------|-----------|
| Dashboard | KPIs, revenue/expense charts, today's attendance, expiring-soon, recent activity |
| Members | List (search, category tabs, status filters, absentees), Add member, Member detail |
| Payments | All Payments + Dues tabs, record/renew payment, edit payment |
| Attendance | Date-grouped check-in log with filters |
| Check-in | QR scanner + live activity feed, manual fallback, balance/grace warnings, beeps |

## Design fidelity

Colors, fonts, type scale, radii, and dark mode are ported verbatim from the web
app's `src/index.css` `@theme` block:

- **Fonts** are bundled locally (no runtime fetch): `Plus Jakarta Sans` for all text,
  `Material Symbols Outlined` for all icons (see `lib/theme/app_icons.dart`).
- **Colors** live in `lib/theme/app_theme.dart` as a theme-aware `AppColors`
  extension (`context.c`) plus the fixed Tailwind palette (`TW`).
- **Check-in beeps** (`assets/sounds/*.wav`) reproduce the four Web-Audio tones.

## Architecture

```
lib/
├── main.dart                 # Firebase init + MaterialApp (light/dark)
├── firebase_options.dart     # same project as the web app (from .env)
├── theme/                    # app_theme.dart, app_icons.dart
├── services/                 # tenant_db.dart, helpers.dart, actions.dart
├── providers/                # auth_provider.dart, theme_provider.dart
├── widgets/                  # common.dart, whatsapp_sheet.dart
└── screens/                  # auth_gate, login, home_shell + 5 modules
```

- `TenantDb` mirrors the web `tenantDb.js` — every collection lives under
  `gyms/{gymId}/{collection}`, so documents stay byte-compatible with the web app.
- `AuthProvider` mirrors `AuthContext.jsx` (role, active gym, multi-branch switch).
- Role gating: **admin** sees all 5 tabs; **staff** sees only Check-in + Attendance.
- WhatsApp reminders open `wa.me` via `url_launcher` (replaces the web SMS/WhatsApp modal).

## Running it

Prerequisites: Flutter SDK, Android SDK (or Xcode for iOS).

```bash
cd mobile-app
flutter pub get
flutter run            # on a connected device/emulator
flutter build apk      # release APK  ->  build/app/outputs/flutter-apk/
```

### Firebase note
Config is hand-written in `lib/firebase_options.dart` using the web app's
credentials (project `gym-erp-demo`). Firestore + Email/Password auth work across
platforms with these values. For production, register dedicated Android/iOS apps in
the Firebase console and drop in `google-services.json` / `GoogleService-Info.plist`
— no data changes, and existing accounts keep working.

`minSdk` is **24** (Flutter default; satisfies Cloud Firestore / Firebase Auth's 23+).

## Not in Phase 1
Excel bulk import (web only), and all modules beyond the five above (Plans, Staff,
Classes, Expenses, Reports, Renewals, Super-Admin, etc.).
