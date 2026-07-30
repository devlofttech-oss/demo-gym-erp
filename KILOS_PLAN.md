# Kilos ERP — Implementation Plan

**Rule:** Build what a real gym receptionist needs daily. Skip anything that needs a third-party API, complex approval workflows, or is rarely used.

---

## Module 1 — Dashboard
**Status: Partial**

| Feature | Decision | Notes |
|---|---|---|
| KPI cards (members, revenue, checkins, expenses) | ✅ Done | |
| Expiry alerts (7-day warning) | ✅ Done | |
| Revenue trend chart | ✅ Done | |
| Quick action buttons (Add Member, Record Payment, Check-in) | ❌ Add | Shortcut buttons on dashboard |
| Leads summary chip (total leads, follow-up today) | ❌ Add | Simple count chip |
| Tabs (Overview / Today / Revenue / Attendance) | ⏭ Skip | Adds complexity, single-page is fine |
| Alerts tab | ⏭ Skip | Expiry alerts on main view is enough |

---

## Module 2 — Member Management
**Status: Partial**

| Feature | Decision | Notes |
|---|---|---|
| Member list, add, profile | ✅ Done | |
| Status filter tabs (All/Active/Expiring/Expired) | ✅ Done | |
| Bulk Excel import | ✅ Done | |
| Photo upload | ✅ Done | |
| Emergency contact field | ❌ Add | Simple text field on AddMember |
| Fitness goal + basic health notes field | ❌ Add | Dropdown (Weight Loss / Muscle Gain / General Fitness / Stamina) + notes |
| Freeze / Unfreeze member status | ❌ Add | In member profile — sets status to Frozen with resume date |
| Frozen / Trial tabs in member list | ❌ Add | Filter tabs alongside Active/Expired |
| Document upload (ID proof, agreements) | ⏭ Skip | Rarely critical, adds storage complexity |
| Bulk status operations | ⏭ Skip | Overkill for single gym |
| WhatsApp number (separate from phone) | ⏭ Skip | Most gyms use same number for both |

---

## Module 3 — Membership Plans
**Status: Partial**

| Feature | Decision | Notes |
|---|---|---|
| Plan CRUD (Gym / PT / Group Class / Add-on) | ✅ Done | |
| Plan price, joining fee, duration, sessions | ✅ Done | |
| Active/Inactive toggle | ✅ Done | |
| GST % field on plan | ❌ Add | Shown on receipt/invoice (e.g. 18%) |
| Archived plans tab | ❌ Add | Inactive plans shown in Archived tab |
| Day-pass plan type | ❌ Add | Add `day-pass` as a plan type option |
| Freeze / transfer rules per plan | ⏭ Skip | Too complex, handle at member level |
| Coupon / promo codes | ⏭ Skip | Not essential for v1 |

---

## Module 4 — Membership Renewals & Lifecycle
**Status: Missing — BUILD THIS**

| Feature | Decision | Notes |
|---|---|---|
| Renewals page at `/renewals` | ❌ Add | List members expiring in 0–30 days |
| One-click renew button → PaymentPage | ❌ Add | Pre-fills member + current plan |
| Freeze member (with resume date) | ❌ Add | In member profile + renewals page |
| Unfreeze member | ❌ Add | Button when member status = Frozen |
| Upgrade / downgrade plan | ⏭ Skip | Done via Record Payment (change plan there) |
| Cancellation / refund workflow | ⏭ Skip | Admin can delete payment manually |
| Renewal history log | ❌ Add | Payment records already serve as history |

---

## Module 5 — Attendance & Access Control
**Status: Partial**

| Feature | Decision | Notes |
|---|---|---|
| QR scanner check-in | ✅ Done | |
| Manual check-in | ✅ Done | |
| Attendance log with date filter | ✅ Done | |
| Expired member warning on check-in | ✅ Done | |
| Balance due warning on check-in | ✅ Done | |
| Attendance streak (consecutive days) per member | ❌ Add | Show on member profile |
| Access denied log | ⏭ Skip | Low priority for small gyms |
| Biometric / RFID integration | ⏭ Skip | Hardware-dependent |

---

## Module 6 — Payments, Billing & Receipts
**Status: Partial**

| Feature | Decision | Notes |
|---|---|---|
| Cash / UPI / Card / Bank / Cheque recording | ✅ Done | |
| Partial / full payments | ✅ Done | |
| Outstanding balance tracking | ✅ Done | |
| Receipt PDF download | ✅ Done | |
| GST on receipt (based on plan GST %) | ❌ Add | Calculate and show GST on receipt |
| Pending Payments tab (better UI) | ❌ Add | Already exists, improve with due-date sort |
| Payment mode breakdown (basic reconciliation) | ❌ Add | Summary: Cash X / UPI Y / Card Z total |
| Advance payment recording | ❌ Add | Allow paid > total (store as credit) |
| Dynamic UPI QR generation | ⏭ Skip | Needs Razorpay/payment gateway API |
| Refund / credit-note workflow | ⏭ Skip | Manual process, not needed in software |
| WhatsApp / email receipt sharing | ⏭ Skip | Needs WhatsApp Business API |
| Full reconciliation report | ⏭ Skip | Basic mode breakdown is sufficient |

---

## Module 7 — Leads & CRM
**Status: Partial**

| Feature | Decision | Notes |
|---|---|---|
| Lead CRUD with stages and source | ✅ Done | |
| Follow-up date tracking | ✅ Done | |
| Lead → Member conversion button | ❌ Add | "Convert to Member" opens AddMember pre-filled |
| Lost reason field | ❌ Add | Dropdown when marking lead as Lost |
| Auto follow-up reminders | ⏭ Skip | Needs background jobs / cloud functions |
| Trial pass creation | ⏭ Skip | Treat trial as a free/short plan instead |
| Lead source performance report | ⏭ Skip | Covered in Reports module |

---

## Module 8 — Workout Management
**Status: Partial**

| Feature | Decision | Notes |
|---|---|---|
| Workout plan CRUD with exercises / sets / reps | ✅ Done | |
| Filter by level | ✅ Done | |
| Assign workout plan to a specific member | ❌ Add | Member picker on WorkoutForm |
| View assigned plans from member profile | ❌ Add | "Workouts" tab on MemberProfile |
| Exercise library (standalone searchable DB) | ⏭ Skip | Plans with exercise lists is enough |
| Video demonstrations | ⏭ Skip | External hosting needed |
| Progressive overload / personal records | ⏭ Skip | Advanced feature |

---

## Module 9 — Diet & Nutrition
**Status: Partial**

| Feature | Decision | Notes |
|---|---|---|
| Diet plan CRUD with goal / macros / meals | ✅ Done | |
| Assign diet plan to member (member picker) | ❌ Add | Replace freetext with member dropdown |
| View assigned diet from member profile | ❌ Add | "Diet" tab on MemberProfile |
| Food library | ⏭ Skip | Overkill for v1 |
| Indian food database | ⏭ Skip | Can be a future addition |

---

## Module 10 — Measurements & Progress
**Status: Partial**

| Feature | Decision | Notes |
|---|---|---|
| Body measurements CRUD (weight, BMI, chest etc.) | ✅ Done | |
| Member picker | ✅ Done | |
| Progress chart (weight over time line chart) | ❌ Add | Line chart per member |
| View measurements from member profile | ❌ Add | "Progress" tab on MemberProfile |
| Before/after photos | ⏭ Skip | Storage-heavy, low priority |
| Fitness tests (push-ups, plank etc.) | ⏭ Skip | Nice to have, not critical |

---

## Module 11 — Personal Training
**Status: Partial**

| Feature | Decision | Notes |
|---|---|---|
| PT packages CRUD | ✅ Done | |
| Session log (date, trainer, status) | ✅ Done | |
| Sessions remaining counter per package | ❌ Add | `sessionsUsed` tracked on package record |
| Trainer commission field on package | ❌ Add | Commission % or fixed amount |
| Link trainer to staff record (dropdown) | ❌ Add | Replace freetext with staff picker |
| Session booking calendar | ⏭ Skip | Complex UI, low priority for v1 |
| Substitute trainer | ⏭ Skip | Edge case |

---

## Module 12 — Staff Management
**Status: Partial**

| Feature | Decision | Notes |
|---|---|---|
| Staff CRUD (name, role, phone, salary, photo) | ✅ Done | |
| QR ID card | ✅ Done | |
| Login account creation | ✅ Done | |
| Certifications field | ❌ Add | Simple text list on staff profile |
| Commission type (salary / commission % / both) | ❌ Add | Field on staff form |
| Staff attendance view on profile | ✅ Done | |
| Shift management | ⏭ Skip | Complex scheduling, not needed v1 |
| Detailed attendance analytics (hours/month) | ⏭ Skip | Basic log is enough |

---

## Module 13 — Communication & Notifications
**Status: Partial**

| Feature | Decision | Notes |
|---|---|---|
| Announcements with target audience | ✅ Done | |
| Follow-up reminders (manual) | ✅ Done | |
| Notification log | ✅ Done | |
| WhatsApp / SMS / email actual sending | ⏭ Skip | Needs external API (WhatsApp Business, Twilio) |
| Automated renewal / birthday reminders | ⏭ Skip | Needs cloud functions / cron jobs |
| Message templates | ⏭ Skip | No sending = no templates needed |

> **Note:** Communication hub is UI-only for now. Real sending requires WhatsApp Business API setup per gym.

---

## Module 14 — Reports & Settings
**Status: Partial**

| Feature | Decision | Notes |
|---|---|---|
| Monthly report (revenue, admissions, renewals) | ✅ Done | |
| PDF + Excel export | ✅ Done | |
| Attendance report (visits per member, peak hours) | ❌ Add | New report tab |
| Leads report (source breakdown, conversion rate) | ❌ Add | New report tab |
| Payment mode reconciliation report | ❌ Add | Cash/UPI/Card breakdown by date range |
| GST configuration in settings | ❌ Add | Default GST % field in gym settings |
| Trainer commission report | ⏭ Skip | Low priority for v1 |
| Churn / retention report | ⏭ Skip | Derivable from existing data, add later |

---

## Build Priority Order

### Phase 1 — Core gaps (high daily use)
1. **Module 4** — Renewals page (list expiring members + one-click renew)
2. **Module 2** — Freeze/Unfreeze on member profile + Frozen tab in list
3. **Module 7** — Lead → Member conversion button + lost reason field
4. **Module 6** — GST on receipt + payment mode breakdown summary

### Phase 2 — Member profile enrichment
5. **Module 2** — Emergency contact + fitness goal fields on AddMember
6. **Module 10** — Progress chart on member profile (Measurements tab)
7. **Module 8** — Assign workout plan to member + Workouts tab on profile
8. **Module 9** — Fix diet member assignment picker + Diet tab on profile

### Phase 3 — Reports & polish
9. **Module 14** — Attendance report + Leads report tabs
10. **Module 11** — Sessions remaining counter + trainer picker from staff
11. **Module 12** — Certifications + commission type fields
12. **Module 1** — Quick action buttons on dashboard
13. **Module 3** — GST field on plan + Day-pass type + Archived tab

---

## What We Are NOT Building (and why)
- WhatsApp / SMS / email sending — needs WhatsApp Business API approval per gym
- Dynamic UPI QR — needs Razorpay / payment gateway integration
- Refund / credit-note approval workflow — manual process, not worth the complexity
- Exercise / food library databases — not critical for daily gym ops
- Shift management — overkill for single-location gyms
- Before/after photo hosting — Firebase Storage costs + privacy concerns
- Trial pass workflow — treat as a free/1-day plan instead
- Biometric / RFID hardware — device-specific, out of scope
- Progressive overload tracking — advanced PT feature
- Coupon / promo codes — add in v2
