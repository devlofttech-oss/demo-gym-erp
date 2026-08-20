# Kilos Mobile — Master Build Plan

**Source of truth across sessions.** Update status here as each screen ships.
Current baseline: **v1.0.3+4** (all future work is OTA — no Play Store upload needed).

---

## Legend
- ✅ Done & live on Play Store
- 🔄 In progress
- ⬜ Not started

---

## Navigation redesign (needed before Phase 2)

Current bottom nav (5 tabs for admin): Dashboard · Members · Payments · Check-in · Attendance

Phase 2+ adds ~12 more modules that can't all fit in a bottom bar. Plan:
- Keep the 5 main tabs as-is
- Add a **6th "More" tab** (grid of tiles, one per remaining module)
- Modules in the More grid: Plans, Staff, Classes, PT, Expenses, Supplements, Leads, Renewals, Measurements, Diet, Workouts, Equipment, Reports, Settings
- Staff role sees: Check-in · Attendance only (unchanged)

---

## Phase 1 — Core (DONE ✅)

| Screen | Web source | Status |
|--------|-----------|--------|
| Dashboard (KPIs, charts, activity feed) | `Dashboard.jsx` | ✅ |
| Members list (search, filters, WhatsApp) | `MemberList.jsx` | ✅ |
| Add Member | `AddMember.jsx` | ✅ |
| Member Detail (profile + payments + attendance tabs) | `MemberDetail.jsx` | ✅ |
| Payments list + Dues tab | `PaymentList.jsx`, `DuesPage.jsx` | ✅ |
| Record / Renew Payment | `PaymentPage.jsx` | ✅ |
| Attendance log (date-grouped, filters) | `AttendanceList.jsx` | ✅ |
| Check-in (QR scanner, beeps, live feed) | `Checkin.jsx`, `CheckinScreen.jsx` | ✅ |

---

## Phase 2 — Plans, Staff, Expenses, Supplements ⬜

All pure Dart → OTA patch. No native changes.
Add **More tab** to home shell in this phase.

### 2A. Membership Plans
- File: `lib/screens/plans/plans_screen.dart`
- Web: `PlanList.jsx` + `PlanForm.jsx`
- List plans (name, price, duration, category: Gym/Zumba/Group)
- Add / edit / delete plan via bottom sheet
- Changes reflect in Add Member plan dropdown

### 2B. Staff
- File: `lib/screens/staff/staff_screen.dart`
- Web: `StaffList.jsx` + `StaffProfile.jsx`
- List staff with role badge (admin/staff)
- View/edit staff profile (name, phone, role, join date)
- Add staff → creates Firestore doc

### 2C. Expenses
- File: `lib/screens/expenses/expenses_screen.dart`
- Web: `ExpenseList.jsx`
- Log expenses (category, amount, date, note)
- Month filter
- Total expense shown alongside revenue

### 2D. Supplement Sales
- File: `lib/screens/supplements/supplements_screen.dart`
- Web: `SupplementList.jsx`
- Record supplement sales (item, qty, price, member)
- Sales log with date filter

---

## Phase 3 — Leads, Renewals, Opportunities ⬜

Pure Dart → OTA.

### 3A. Leads / Prospects
- File: `lib/screens/leads/leads_screen.dart`
- Web: `LeadList.jsx` + `LeadForm.jsx`
- Prospect list with status pill (New/Contacted/Converted/Lost)
- Add lead (name, phone, source, interest)
- WhatsApp follow-up button (url_launcher — already wired)
- Convert lead → auto-open Add Member

### 3B. Upcoming Renewals
- File: `lib/screens/renewals/renewals_screen.dart`
- Web: `RenewalsList.jsx`
- Members expiring in next 7/14/30 days (filter toggle)
- Quick renew → opens Record Payment
- WhatsApp reminder button

### 3C. Opportunities (Member upsell)
- File: inside `member_detail_screen.dart` as a new tab
- Web: `OpportunityList.jsx` + `OpportunityDetail.jsx`
- Per-member upsell opportunities (PT package, plan upgrade, etc.)
- Add / edit / mark won/lost

---

## Phase 4 — Classes & Personal Training ⬜

Pure Dart → OTA.

### 4A. Group Classes
- Files: `lib/screens/classes/classes_screen.dart`, `add_class_screen.dart`, `class_detail_screen.dart`
- Web: `ClassList.jsx`, `AddClass.jsx`, `ClassDetail.jsx`
- Class list (name, category, schedule, instructor, capacity)
- Add class with 12-hour AM/PM time picker (matches web's TimePicker12)
- Class detail: enrolled members list, WhatsApp message button

### 4B. Personal Training
- Files: `lib/screens/pt/pt_screen.dart`, `pt_package_screen.dart`, `pt_session_screen.dart`
- Web: `PTList.jsx`, `PTPackageForm.jsx`, `PTSessionForm.jsx`
- PT packages (member, trainer, total sessions, price, paid)
- Log completed session → decrement remaining count
- List sessions per package

---

## Phase 5 — Health Tracking ⬜

Pure Dart → OTA.

### 5A. Body Measurements
- Files: `lib/screens/measurements/measurements_screen.dart`, `add_measurement_screen.dart`
- Web: `MeasurementList.jsx`, `MeasurementForm.jsx`
- Per-member: weight, BMI, body fat %, chest, waist, hip (date-stamped)
- Trend line chart (fl_chart — already bundled)

### 5B. Diet Plans
- Files: `lib/screens/diet/diet_screen.dart`, `add_diet_screen.dart`
- Web: `DietList.jsx`, `DietForm.jsx`
- Create diet plan (meal, calories, protein, carbs, fat)
- Assign to member

### 5C. Workout Plans
- Files: `lib/screens/workouts/workouts_screen.dart`, `add_workout_screen.dart`
- Web: `WorkoutList.jsx`, `WorkoutForm.jsx`
- Create workout plan (exercise, sets, reps, rest)
- Assign to member

### 5D. Equipment
- File: `lib/screens/equipment/equipment_screen.dart`
- Web: `EquipmentList.jsx`
- Inventory (name, qty, purchase date, condition)
- Flag for maintenance (color-coded status pill)

---

## Phase 6 — Reports, Notifications, Communication ⬜

Uses pre-bundled native plugins: `printing`, `share_plus`, `firebase_messaging`, `flutter_local_notifications`.

### 6A. Monthly Report
- File: `lib/screens/reports/report_screen.dart`
- Web: `MonthlyReport.jsx`
- Month picker → load revenue, new members, renewals, attendance
- Summary cards + bar chart (fl_chart)
- **Export PDF** → generate with `pdf` package → share via `share_plus`

### 6B. Notification Panel
- Widget: `lib/widgets/notification_panel.dart` (slide-in from top bar bell icon)
- Web: `NotificationPanel.jsx`
- Reads `gyms/{gymId}/notifications` collection (event-driven, written by Firestore triggers)
- Badge count on bell; tap → mark read / clear all

### 6C. Communication Hub (WhatsApp Cloud API)
- File: `lib/screens/communication/communication_screen.dart`
- Web: `CommunicationHub.jsx`
- Bulk WhatsApp to filtered member group (expiring, expired, all active)
- Message templates (expiry reminder, payment due, welcome, announcement)
- Uses same WhatsApp Cloud API key stored in gym's Firestore doc
- Shows delivery/read status from `gyms/{gymId}/whatsappMessages`

---

## Phase 7 — Member Photos, Settings, Member QR ⬜

### 7A. Member Profile Photo
- Add photo picker to `add_member_screen.dart` and `member_detail_screen.dart`
- Web: `PhotoUpload.jsx` (now uses **ImageKit**, not Firebase Storage)
- Pick from gallery or camera (`image_picker` — pre-bundled)
- Upload to ImageKit via HTTP POST (`https://upload.imagekit.io/api/v1/files/upload`)
- ImageKit public key + URL endpoint stored in gym's Firestore settings doc
- Display in member card avatar and detail header

### 7B. Settings
- File: `lib/screens/settings/settings_screen.dart`
- Web: `Settings.jsx`
- Gym name, address, phone, working hours
- Grace period days, default plan
- ImageKit credentials (for photo upload)
- WhatsApp Cloud API token + phone number ID (for Communication Hub)

### 7C. Member QR Code
- Add QR display to `member_detail_screen.dart` (new tab or bottom sheet)
- Web: `MemberQRPage.jsx` (public page scanned by kiosk)
- Generate QR from member ID using `qr_flutter` (pure Dart — OTA safe)
- Show QR → member can screenshot and present at check-in kiosk
- Note: add `qr_flutter` to pubspec (pure Dart, no native, safe as OTA)

---

## Version history

| Version | Build | What changed (native) | Baseline needed? |
|---------|-------|-----------------------|-----------------|
| 1.0.0 | 1 | Initial release | ✅ uploaded to Play |
| 1.0.1 | 2 | shorebird_code_push + flutter_native_splash | ✅ uploaded to Play |
| 1.0.2 | 3 | Pub conflict fixes (not used) | ❌ skip |
| 1.0.3 | 4 | All future native plugins pre-bundled | ⬜ **upload this AAB to Play** |
| future | — | All Dart changes only | OTA forever |

> ⚠️ **Action needed:** Download the `kilos-release-aab` artifact from the
> **v1.0.3 "Cut store release (baseline) #5"** CI run and upload it to Play Console
> (Internal testing → create new release). This is the final native baseline.

---

## Build order

```
Phase 2 (nav redesign + Plans/Staff/Expenses/Supplements)
  → Phase 3 (Leads/Renewals/Opportunities)
  → Phase 4 (Classes/PT)
  → Phase 5 (Health tracking)
  → Phase 6 (Reports/Notifications/Comms)
  → Phase 7 (Photos/Settings/QR)
```

---

## Quick status

| Phase | What | Status |
|-------|------|--------|
| 1 | Dashboard, Members, Payments, Attendance, Check-in | ✅ Live |
| 2 | Plans, Staff, Expenses, Supplements + More tab nav | ⬜ |
| 3 | Leads, Renewals, Opportunities | ⬜ |
| 4 | Classes, Personal Training | ⬜ |
| 5 | Measurements, Diet, Workouts, Equipment | ⬜ |
| 6 | Reports (PDF), Notifications, WhatsApp Hub | ⬜ |
| 7 | Member Photos, Settings, Member QR | ⬜ |
