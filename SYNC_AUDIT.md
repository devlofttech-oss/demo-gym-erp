# Web ↔ Mobile Sync Audit

Living document. Both apps share one Firestore DB (`gyms/{gymId}/{collection}`), so
**field-name mismatches = silent data divergence** (one app writes data the other can't read).
Severity: 🔴 Critical (field/data divergence) · 🟠 High (feature missing one side) · 🟡 Medium (behavior differs) · ⚪ Low (cosmetic).

Legend for status: ✅ synced · 🔧 in progress · ⏳ pending · 🚩 needs decision

---

## ▶ RESUME HERE (read this first if continuing after a break)

**Goal:** full feature + field parity between the React web ERP (`src/`) and the Flutter app (`mobile-app/`).
**User decisions (locked):** (1) **Full parity** — build every missing feature both directions. (2) **Hold pushes** — commit locally per phase, do NOT push to git (no OTA/Vercel) until the user says so.

**Progress:** Phase 0 ✅ · Phase 1 (Members) ✅ · **Next = Phase 2 (Payments & Dues).**

**Per-phase method (repeat for each domain):**
1. Spawn a `general-purpose` subagent to read both apps' files for the domain and return a field-matrix + feature-parity + severity-ranked discrepancy list (see the Phase 1 Members prompt as the template).
2. Verify the subagent's critical findings against the real files yourself before editing.
3. Sync: fix field mismatches first (web `db.js` schema is canonical), then build missing features both directions.
4. Build-check: web `npm run build`; mobile `& "D:\flutter\bin\dart.bat" analyze <changed dirs>` (flutter/dart is at `D:\flutter\bin`, not on PATH).
5. Commit locally with a `feat(sync)`/`fix(sync)` message. Do NOT push. Update this file's status.

**Carried into later phases from Phase 1:** creditApplied / payment-edit-on-mobile → Phase 2 · QR payload standardization / attendance-calendar-on-mobile → Phase 3 · per-member measurements on mobile → Phase 6 · mobile member document-upload (needs new file-picker dep) → cleanup pass.

---

## Phase 0 — Ground truth ✅
Both apps use identical collection paths `gyms/{gymId}/{collection}` via `tenantDb.js` / `tenant_db.dart`.
Web `db.js` is the canonical schema reference (older, richer). Super Admin portal is web-only **by design** (not a gap).

---

## Phase 1 — Members domain

### 🔴 CRITICAL field mismatches — ✅ SYNCED
| # | Issue | Fix applied | Files |
|---|---|---|---|
| C1 | Date-of-birth under 3 different keys: web `birthday`, mobile `dateOfBirth`, bulk-import `dob` → DOB invisible across apps | Standardized on **`birthday`**. Mobile add/edit now write `birthday`; mobile edit + web profile read `birthday ?? dateOfBirth` (back-compat); bulk-import writes `birthday` | add_member_screen.dart, edit_member_screen.dart, BulkImportMembers.jsx, MemberProfile.jsx |
| C2 | Expiry math differed: web `addMonths` (same day-of-month) vs mobile `addMonthsEnd` (last day of month) → **different expiryDate for same plan**, driving status/renewals apart | Rewrote mobile helper to `addMonths()` mirroring web exactly (same day, clamp on overflow); renamed + updated all 4 callers | helpers.dart, add_member_screen.dart, payment_screen.dart |
| C3 | Discount stored inconsistently: web writes `discountAmount`(₹, authoritative)+`discountPercent`(float); mobile wrote only `discountPercent`(rounded int) → totals/balance drift | Mobile now makes ₹ authoritative: writes `discountAmount` + float `discountPercent`, computes total from ₹ like web | add_member_screen.dart |

Verified: `npm run build` ✅ · `dart analyze` ✅ (only 2 pre-existing style lints, unrelated).

### 🟠 HIGH feature gaps
| # | Gap | Direction | Status |
|---|---|---|---|
| H1 | Freeze / Unfreeze membership (writes `status:Frozen`, `frozenOn`, `resumeDate`) | web → mobile | ✅ SYNCED — AppBar menu in member_detail_screen.dart, mirrors web field writes exactly |
| H2 | Delete member (+cascade payments/attendance) | web → mobile | ✅ SYNCED — AppBar menu + confirm; fetches full payment/attendance sets so nothing orphaned |
| H5 | Upsell Opportunities (`opportunities` collection) | mobile → web | ✅ SYNCED — Opportunities section added to MemberProfile.jsx, exact field parity (type/title/amount/notes/status/createdAt) |
| H3 | Edit member: change plan/fees/expiry + carry-forward `creditApplied` | web → mobile ⚠️ | ↪ deferred to **Phase 2 (Payments)** — capability exists on mobile via PaymentScreen; the `creditApplied` field gap is a payments concern |
| H4 | Per-member Body Measurements in detail view | web → mobile ❌ | ↪ deferred to **Phase 6 (Measurements)** — mobile has a standalone measurements screen; detail-embed handled with that domain |
| H6 | Bulk import | web only | ✅ intentional (desktop-only) |

### 🟡 remaining Members items
- 🟡 Member document upload (`documentUrl`/`documentName`) web-only → mobile needs a file picker (new dependency); **pending** — will add during a mobile-deps pass.
- 🟡 QR payload mismatch → ↪ **Phase 3 (Attendance/Scanner)**.
- 🟡 Payment edit (mobile delete-only) → ↪ **Phase 2**. Attendance calendar (mobile list-only) → ↪ **Phase 3**.

### 🟡 MEDIUM / ⚪ LOW — ⏳ PENDING
- 🟡 QR payload mismatch: web encodes raw member `id`; mobile encodes `kilos:member:{id}` → scanner cross-incompat. *(Handle in Phase 3 Attendance — scanner lives there.)*
- 🟡 Member document upload (`documentUrl`/`documentName`) web-only.
- 🟡 Payment edit web-only (mobile delete-only); attendance calendar web-only (mobile list-only).
- 🟡 Photo backends differ (web ImageKit / mobile Firebase Storage) — both store URL in `photoUrl`, cross-read OK, cleanup lifecycle differs.
- ⚪ Mobile list: no numeric filter-count badges, "Page X of Y" vs numbered pages, no QR download/share.

### Dead code flagged
`MemberDetail.jsx`, `OpportunityList.jsx`, `OpportunityDetail.jsx` target a **Frappe/ERPNext** backend (`Customer`/`Opportunity` doctypes) — share no data with the Firestore apps. Confirm they're unused before treating their fields as live schema.

---

## Phases 2–8 — ⏳ pending
Payments & Dues · Attendance & Check-in · Plans/Renewals/Subscription · Classes & PT · Workouts/Diet/Measurements · Staff/Equipment/Supplements/Expenses · Dashboard/Reports/Settings/Comms.
