# Kilos Mobile — Full Build Plan

## Strategy: Freeze the native layer now

All future modules are pure Dart (Firestore CRUD + UI). The only native plugins
needed across the entire app have been identified below and will be added to
pubspec.yaml **right now** before the production baseline is cut. After that,
every new screen ships as a Shorebird OTA patch — no Play Store upload ever again.

---

## Native plugins to add NOW (one-time)

| Plugin | Why |
|--------|-----|
| `image_picker` | Member profile photos (PhotoUpload) |
| `path_provider` | Save PDFs/files to device storage |
| `share_plus` | Share monthly reports / PDFs |
| `printing` | Print or export monthly report as PDF |
| `pdf` | Generate PDF in Dart (pure Dart, but listed for completeness) |
| `firebase_messaging` | Push notifications (NotificationPanel exists in web) |
| `flutter_local_notifications` | Local notification display when app is foreground |

After adding these, bump version to `1.0.2+3`, push tag `v1.0.2`, upload to Play.
All future changes → OTA only.

---

## Phase 1 — DONE ✅

| Screen | Status |
|--------|--------|
| Dashboard (KPIs, charts, activity) | ✅ |
| Members (list, add, detail, payments tab, attendance tab) | ✅ |
| Payments (list, dues, record/renew) | ✅ |
| Attendance log | ✅ |
| Check-in (QR scanner + beeps) | ✅ |

---

## Phase 2 — Staff, Plans, Expenses, Supplements

All pure Dart. OTA patch only.

### 2A. Plans (`/plans`)
Web: `PlanList.jsx`, `PlanForm.jsx`
- List gym's membership plans (name, price, duration, category)
- Add / edit / delete plan
- Changes reflect in Members' plan dropdown

### 2B. Staff (`/staff`)
Web: `StaffList.jsx`, `StaffProfile.jsx`
- List staff with role badge (admin/staff)
- Add staff → creates Firestore user doc (gym owner sets credentials separately in Firebase Auth)
- View/edit staff profile

### 2C. Expenses (`/expenses`)
Web: `ExpenseList.jsx`
- Log gym expenses (category, amount, date, note)
- Filter by month
- Total vs revenue comparison (feeds Dashboard bar chart)

### 2D. Supplements (`/supplements`)
Web: `SupplementList.jsx`
- Record supplement sales (item, qty, price, member)
- Sales log with date filter
- Already partially visible in Dashboard revenue

---

## Phase 3 — Classes, PT, Leads

All pure Dart. OTA patch only.

### 3A. Group Classes (`/classes`)
Web: `ClassList.jsx`, `AddClass.jsx`, `ClassDetail.jsx`
- List classes (Zumba, Group, etc.) with schedule
- Add/edit class with timings, instructor, capacity
- View enrolled members per class

### 3B. Personal Training (`/pt`)
Web: `PTList.jsx`, `PTPackageForm.jsx`, `PTSessionForm.jsx`
- PT packages (member, trainer, sessions count, price)
- Log completed PT sessions
- Track remaining sessions per package

### 3C. Leads (`/leads`)
Web: `LeadList.jsx`, `LeadForm.jsx`
- Prospect/lead list with status (new, contacted, converted, lost)
- Add lead with source, phone, interest
- WhatsApp follow-up button (url_launcher — already have it)
- Convert lead → member

---

## Phase 4 — Health Tracking (Diet, Workouts, Measurements, Equipment)

All pure Dart. OTA patch only.

### 4A. Measurements (`/measurements`)
Web: `MeasurementList.jsx`, `MeasurementForm.jsx`
- Log member body measurements (weight, BMI, body fat %, etc.)
- Per-member history with date

### 4B. Diet Plans (`/diet`)
Web: `DietList.jsx`, `DietForm.jsx`
- Create diet plans (meal name, calories, macros)
- Assign to member

### 4C. Workout Plans (`/workouts`)
Web: `WorkoutList.jsx`, `WorkoutForm.jsx`
- Create workout plans (exercise, sets, reps)
- Assign to member

### 4D. Equipment (`/equipment`)
Web: `EquipmentList.jsx`
- Equipment inventory (name, qty, purchase date, condition)
- Flag for maintenance

---

## Phase 5 — Reports, Notifications, Communication

Needs `printing`, `firebase_messaging`, `flutter_local_notifications` (added in native freeze).

### 5A. Monthly Report (`/reports`)
Web: `MonthlyReport.jsx`
- Revenue summary by month
- Member stats (new, renewed, expired)
- Attendance summary
- **Export as PDF** → share via `share_plus` + `printing`

### 5B. Push Notifications
Web: `NotificationPanel.jsx`
- Firebase Messaging integration
- Notify staff on new member, expiry alerts
- Local notification when app is in foreground

### 5C. Communication Hub (`/communication`)
Web: `CommunicationHub.jsx`
- Bulk WhatsApp message to filtered member groups
- Pre-built templates (expiry reminder, payment due, welcome)

---

## Phase 6 — Member Photos, Settings, Renewals

### 6A. Member Profile Photo
Web: `PhotoUpload.jsx` (used in MemberDetail)
- Pick photo from gallery or camera (`image_picker`)
- Upload to Firebase Storage
- Display in member card and detail screen

### 6B. Settings (`/settings`)
Web: `Settings.jsx`
- Gym name, address, contact
- Working hours
- Grace period config
- Plan defaults

### 6C. Renewals List (`/renewals`)
Web: `RenewalsList.jsx`
- Upcoming renewals in next 7/14/30 days
- Quick renew action
- WhatsApp reminder button

---

## Build order recommendation

```
Phase 2 → Phase 3 → Phase 6C (Renewals) → Phase 6B (Settings)
→ Phase 4 → Phase 5 → Phase 6A (Photos, needs Storage)
```

Phase 6A (member photos) is last because it needs Firebase Storage configured
(a separate Firebase product, not in use yet).

---

## Version plan

| Baseline | What changed (native) | Action |
|----------|-----------------------|--------|
| 1.0.1+2 | shorebird_code_push + flutter_native_splash | Current — CI building now |
| 1.0.2+3 | image_picker, path_provider, share_plus, printing, firebase_messaging, flutter_local_notifications | **Cut now → upload to Play → done forever** |
| future | Nothing — all Dart | OTA only |

---

## Firebase Storage (needed for Phase 6A only)

Currently not configured. To enable:
1. Firebase Console → Storage → Enable
2. Add `firebase_storage` to pubspec (native → needs a baseline, but this is already
   the 1.0.2+3 freeze, so add it there too)
3. Register the Android app in Firebase Console → download `google-services.json`
   (currently skipped; needed for Storage + Messaging)

> Note: Firestore + Auth work without registering the app because we hardcode the
> config. Storage and Messaging need the app registered to get proper tokens.
