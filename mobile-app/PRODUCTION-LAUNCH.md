# Kilos — Production Launch Guide (Android)

Everything needed to take Kilos from internal testing to a public Google Play
production release. Copy/paste the ready-made text into Play Console.

---

## ⚠️ Timeline gate (personal developer account)

Your Play account is a **personal** account, so Google requires:

> A **closed test** with **at least 12 testers** who stay opted-in for **14 continuous days**, before you can apply for production access.

**Plan:** start the closed test now, and use the 14 days to finish the store
listing below. When the 14 days are up, "Apply for production" unlocks and you
submit — everything else will already be ready.

### Start the closed test
1. Play Console → **Test and release → Testing → Closed testing → Create track** (or use the default "Alpha").
2. Create a release, upload the AAB (same one from the CI `Cut store release` workflow → `kilos-release-aab`).
3. **Testers tab → create an email list with 12+ real Google accounts** → save.
4. Share the opt-in link with all 12 testers → they must **install and stay opted in** for 14 days.
5. Keep the track active; don't remove testers during the 14 days.

> Tip: the 12 testers must actually **join** (opt in). Ask them to open the link,
> tap "Become a tester", and install. Google counts opted-in testers.

---

## Store listing — ready-to-paste copy

**App name:** `Kilos`

**Short description (≤80 chars):**
```
Gym management made simple — members, payments, attendance & QR check-in.
```

**Full description (≤4000 chars):**
```
Kilos is a complete gym management app for gym owners and staff. Run your entire
front desk from your phone — no paperwork, no spreadsheets.

MEMBERS
• Add members in seconds with plan, fees and photo
• Search and filter by status: active, expiring, expired, frozen
• Spot absentees automatically and send WhatsApp reminders

PAYMENTS
• Record payments and renewals with partial-payment support
• Track dues and expired memberships at a glance
• Revenue summaries by day, month and payment mode

ATTENDANCE & CHECK-IN
• Fast QR check-in — scan a member's code to mark entry/exit
• Balance-due and grace-period alerts right at the door
• Full attendance log, grouped by date

DASHBOARD
• Live revenue, active members and daily attendance
• Charts for revenue trend, plan mix and revenue vs expenses
• Today's check-ins and recent activity

Kilos syncs instantly with the Kilos web dashboard — the same account works on
both, so your team is always up to date.

Built for Indian gyms by Devloft Technologies.
```

**App category:** Business (alternative: Health & Fitness)
**Tags:** gym management, fitness, membership, attendance
**Contact email:** support@devlofttech.com  *(confirm this inbox exists)*
**Website:** https://kilos.devlofttech.com

### Graphics (in `mobile-app/store/`)
| Asset | File | Status |
|-------|------|--------|
| App icon 512×512 | `kilos_play_icon_512.png` | ✅ ready |
| Feature graphic 1024×500 | `kilos_feature_graphic_1024x500.png` | ✅ ready |
| Phone screenshots (2–8) | — | ⬜ **you capture** (see below) |

### Screenshots — how to capture (needs your login)
The listing needs 2–8 phone screenshots (min 1080px). Easiest:
1. Open Kilos on your phone (the Play build).
2. Screenshot: **Dashboard**, **Members list**, **Check-in**, **Payments**, **Attendance**.
3. Upload those 4–5 PNGs directly in Play Console → Store listing → Phone screenshots.
(You can also frame them nicely later; raw device screenshots are accepted.)

---

## Required policy links (LIVE on your site)

- **Privacy policy:** https://kilos.devlofttech.com/privacy
- **Terms of service:** https://kilos.devlofttech.com/terms
- **Account & data deletion:** https://kilos.devlofttech.com/delete-account

Paste the **privacy policy** URL into Play Console → App content → Privacy policy.
The app also has in-app deletion: **Profile (top-right) → Delete account**.

---

## App content forms — the answers

**App access** (reviewers need to sign in):
- Choose "All or some functionality is restricted" → add login instructions:
  - Provide a **demo Google/email + password** with a test gym's data.
  - Steps: "Open app → enter the email and password above → you'll land on the dashboard."

**Data safety** (Play Console → App content → Data safety):
- Does your app collect or share user data? **Yes, collect. No selling/sharing for ads.**
- Data types collected:
  - **Personal info:** Name, Email address, Phone number → *App functionality, Account management* → **Required**
  - **Photos** (optional member photos) → *App functionality* → Optional
  - **App activity** (attendance/usage within the gym) → *App functionality*
- Is data encrypted in transit? **Yes**
- Can users request data deletion? **Yes** → deletion URL: `https://kilos.devlofttech.com/delete-account`
- Data is **not** used for advertising or shared with third parties for ads.

**Content rating** (questionnaire):
- Category: **Utility / Productivity / Business** (not a game).
- No violence, sexual content, gambling, or user-to-user unmoderated content.
- Expected rating: **Everyone / 3+**.

**Ads:** No ads.
**Target audience:** 18+ (business users / gym staff).
**Government / financial / health declarations:** none apply (Kilos records
membership payments but is not a payment processor or a medical/health app).

---

## Cutting the production release

The current baseline is **1.0.0 (1)**. For production, cut a fresh baseline that
includes the latest changes (splash screen, in-app delete account, update banner):

1. Bump the version in `pubspec.yaml`: `version: 1.0.1+2`.
2. Run the **Cut store release (baseline)** GitHub Action (or push tag `v1.0.1`).
3. Download the `kilos-release-aab` artifact.
4. Play Console → **Production → Create new release** → upload the AAB → fill release notes → **Review → Roll out to production** (available after the 14-day closed test + production access is granted).
5. Production review takes a few days.

> After each production release, day-to-day Dart changes still ship instantly via
> the Shorebird OTA workflow on push to `main` — no store round trip.

---

## Quick status
- ✅ App on Play internal testing, installed, OTA loop proven
- ✅ Legal pages live (privacy/terms/delete)
- ✅ In-app account deletion
- ✅ Icon + feature graphic + splash
- ⬜ 12-tester / 14-day closed test (start now)
- ⬜ Screenshots (capture from phone)
- ⬜ Data safety + content rating + app access forms (answers above)
- ⬜ Apply for production → submit
