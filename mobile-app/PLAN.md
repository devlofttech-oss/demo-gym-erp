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

## Phase 2 — Plans, Staff, Expenses, Supplements ✅

All pure Dart → OTA patch. No native changes.
**More tab added** to home shell.

### 2A. Membership Plans ✅
- File: `lib/screens/plans/plans_screen.dart`
- Type filter: All / Gym / PT / Group Class / Day Pass / Add-on
- Add / edit / delete plan via bottom sheet
- Active toggle, GST, joining fee, sessions

### 2B. Staff ✅
- File: `lib/screens/staff/staff_screen.dart`
- Role filter tabs (Trainer / Staff / Manager / Receptionist)
- Add / edit / delete; name, phone, email, salary, join date, certifications

### 2C. Expenses ✅
- File: `lib/screens/expenses/expenses_screen.dart`
- Month picker, category filter, summary cards (total + recurring)
- Log / edit / delete; category, amount, date, payment mode, recurring toggle

### 2D. Supplements ✅
- File: `lib/screens/supplements/supplements_screen.dart`
- Inventory tab with stock badges (In Stock / Low / Out)
- Sell bottom sheet (decrements stock, creates supplementSales doc)
- Restock bottom sheet (increments stock)
- Sales Log tab

---

## Phase 3 — Leads, Renewals ✅

Pure Dart → OTA.

### 3A. Leads / Prospects ✅
- File: `lib/screens/leads/leads_screen.dart`
- Status filter (New / Contacted / Follow-up / Interested / Won / Lost)
- Follow-up today banner; add / edit / delete
- WhatsApp button; Convert to Member (prefills Add Member form)

### 3B. Upcoming Renewals ✅
- File: `lib/screens/renewals/renewals_screen.dart`
- 7 / 14 / 30 day range; expired + expiring sections
- Freeze / Unfreeze (with date-extended expiry on unfreeze)
- WhatsApp remind; Renew → Payment screen
- Frozen members section

### 3C. Opportunities (Member upsell) ✅
- File: inside `member_detail_screen.dart` (Opportunities section + `_OppSheet`)
- Per-member opportunities: PT Package / Plan Upgrade / Supplement / Other
- Add / edit / delete; Mark Won / Mark Lost quick buttons
- Status: Open (amber) / Won (green) / Lost (rose)

---

## Phase 4 — Classes & Personal Training ✅

Pure Dart → OTA.

### 4A. Group Classes ✅
- File: `lib/screens/classes/classes_screen.dart`
- Type filter chips (Zumba/Yoga/Dance/HIIT/Kids Dance/Gym/Other)
- Class card: types, schedule slots, enrolled/capacity progress bar
- Class detail screen: enrolled members list, WhatsApp all button
- Manage enrolment bottom sheet (toggle per member)
- Add/edit form with dynamic schedule slots (day + time picker)

### 4B. Personal Training ✅
- File: `lib/screens/pt/pt_screen.dart`
- Two tabs: Packages | Sessions
- Packages: sessions progress bar (completed/included), trainer, price
- Sessions: status filter (Scheduled/Completed/Cancelled), log session form
- Completing a session auto-increments `sessionsCompleted` on the package

---

## Phase 5 — Health Tracking ✅

Pure Dart → OTA.

### 5A. Body Measurements ✅
- File: `lib/screens/measurements/measurements_screen.dart`
- Member picker → per-member measurement history
- Latest reading card (weight, height, BMI, body fat, chest, waist, hips, arms, thighs)
- fl_chart weight trend line chart (shows when ≥2 data points)
- BMI auto-calculated from weight + height

### 5B. Diet Plans ✅
- File: `lib/screens/diet/diet_screen.dart`
- Goal filter (weight-loss/muscle-gain/maintenance/medical)
- Macro breakdown pills (protein/carbs/fat)
- Dynamic meals list in add/edit form
- Assign to member

### 5C. Workout Plans ✅
- File: `lib/screens/workouts/workouts_screen.dart`
- Level filter (Beginner/Intermediate/Advanced)
- Dynamic exercises list (name, sets, reps, rest, notes)
- Goal + duration + days/week
- Assign to member

### 5D. Equipment ✅
- File: `lib/screens/equipment/equipment_screen.dart`
- Service status badges: Overdue (rose) / Due Soon ≤30d (amber) / OK (green)
- Alert banners at top for overdue + due-soon counts
- nextServiceDate tracking with date picker

---

## Phase 6 — Reports, Notifications, Communication ✅

### 6A. Monthly Report ✅
- File: `lib/screens/reports/report_screen.dart`
- Month picker → revenue, new members, renewals, avg daily attendance
- Summary cards + BarChart (fl_chart)
- PDF export via `pdf` + `printing` packages

### 6B. Notification Panel ✅
- Widget: `lib/widgets/notification_panel.dart`
- Bell icon in TopBar with red unread badge
- Reads `gyms/{gymId}/notifications`; mark read / clear all

### 6C. Communication Hub ✅
- File: `lib/screens/communication/communication_screen.dart`
- Group filter: All Active / Expiring 7d / 30d / Expired / Frozen
- 4 message templates with `{{name}}` `{{expiry}}` personalisation
- Dual-mode: WhatsApp Cloud API (if wapiToken set) or wa.me link fallback
- Per-member WhatsApp button + bulk send with select/deselect

---

## Phase 7 — Member Photos, Settings, Member QR ✅

### 7A. Member Profile Photo ✅
- `add_member_screen.dart` — photo picker (camera/gallery) + Firebase Storage upload
- `member_detail_screen.dart` — photo displayed in header if `photoUrl` set

### 7B. Settings ✅
- File: `lib/screens/settings/settings_screen.dart`
- Gym Info (name/address/phone/email/workingHours/gracePeriod/gstNumber/website/instagram), ImageKit, WhatsApp Cloud API credentials

### 7C. Member QR Code ✅
- `member_detail_screen.dart` — QR section at bottom
- `qr_flutter` generates `kilos:member:{id}` code; Copy Member ID button

---

## Feature Parity Gap Fixes ✅

All gaps identified vs. the web ERP — now closed:

| Gap | Fix | File |
|-----|-----|------|
| Edit member from detail screen | Edit button in AppBar → EditMemberScreen | `member_detail_screen.dart` |
| Delete individual payment record | Delete icon with confirm dialog on each payment row | `member_detail_screen.dart` |
| Delete individual attendance record | Delete icon on each attendance row | `member_detail_screen.dart` |
| Edit member (full profile + photo) | New `EditMemberScreen` with all fields + photo upload | `edit_member_screen.dart` |
| Date of Birth on add member | `_dob` state + date picker in Add Member form | `add_member_screen.dart` |
| Balance Due member filter | `Balance Due` chip + `asNum(m['balanceFees']) > 0` filter | `members_screen.dart` |
| Check-in quick action on dashboard | Check-in button → `CheckinScreen` | `dashboard_screen.dart` |
| Renewals quick action on dashboard | Renewals button → `RenewalsScreen` | `dashboard_screen.dart` |
| Plan features list | Features chip list in `_PlanForm` + display in `_PlanCard` | `plans_screen.dart` |
| Duplicate plan | Duplicate popup menu option + `_duplicate()` method | `plans_screen.dart` |
| Staff commission type + rate | Commission type dropdown (Percent/Fixed) + commission amount field | `staff_screen.dart` |
| GST number / website / Instagram in Settings | 3 new fields in gym info section | `settings_screen.dart` |

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
| 2 | Plans, Staff, Expenses, Supplements + More tab nav | ✅ Done |
| 3 | Leads, Renewals, Opportunities | ✅ Done |
| 4 | Classes, Personal Training | ✅ Done |
| 5 | Measurements, Diet, Workouts, Equipment | ✅ Done |
| 6 | Reports (PDF), Notifications, WhatsApp Hub | ✅ Done |
| 7 | Member Photos, Settings, Member QR | ✅ Done |
