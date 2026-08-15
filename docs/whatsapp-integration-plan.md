# WhatsApp Automation for Kilos ERP — Direct Meta Cloud API

## Context

Kilos gyms want to (a) **one-click message** a member/gym straight to WhatsApp, and (b) send
**bulk announcements + automated reminders** (renewals, payment due, birthdays). This is on
**Meta's official WhatsApp Cloud API** — not a reseller (AiSensy/Interakt/360dialog).

The core question — *"does it go from the Kilos number or the gym owner's registered number?"* — has a
hard-rule answer that decides the whole architecture (see below).

**Two separate features, two very different cost/effort profiles:**

| Feature | Tech | Cost | Effort |
|---|---|---|---|
| **A. One-click "message this member"** | `wa.me` deep link (click-to-chat) | **FREE, forever** | Tiny — already built |
| **B. Bulk announcements + auto reminders** | WhatsApp **Cloud API** (Meta Graph API) | Pay-per-message | Real build (backend needed) |

---

## The "whose number" answer

A phone number can live on **EITHER** the normal WhatsApp app **OR** the Business API — **never both**.
The number a gym typed at signup is almost certainly their **personal WhatsApp**, so it *cannot* be
used for the API without them losing WhatsApp on that phone.

Two possible models:

- **Centralized (RECOMMENDED to start):** Kilos/Devloft owns **one** WhatsApp Business number + API.
  All gyms' messages send from it. Members see a "Kilos" verified sender; the **gym's name goes in the
  message body** (e.g. *"Gold's Gym: your membership expires in 3 days"*). One verification, one token,
  one bill you re-charge to gyms. Fast to launch.
- **Per-gym (Tech Provider — later):** Register as a Meta **Tech Provider**; each gym connects its
  **own dedicated** number via embedded signup, so messages show the gym's brand. Requires each gym to
  buy a separate number + do business verification. High friction — defer until demand justifies it.

**Decision: build Centralized now, architect so a gym can be flipped to its own number later.**
The sender/token is read from a per-gym config doc, so per-gym is a config swap, not a rewrite.

---

## Pricing (Meta direct, India, 2026)

Meta bills **per delivered template message** (the old "1000 free conversations/month" model was retired
1 Jul 2025 — there is **no monthly free tier** now).

| Category | What we use it for | India rate (approx) |
|---|---|---|
| **Utility** | Renewal reminders, payment due, receipts, birthdays | **₹0.14 / msg** |
| **Marketing** | Promotions, offers, bulk announcements | **₹1.05–1.10 / msg** |
| **Authentication** | OTPs | ₹0.14 / msg |
| **Service** (user replies to us, within 24h) | Support replies | **FREE** |

**Worked examples (per gym):**
- 500 members, monthly renewal reminder (Utility): 500 × ₹0.14 ≈ **₹70/month**
- Promo blast to 500 (Marketing): 500 × ₹1.10 ≈ **₹550/blast**
- Individual one-click messages (Feature A): **₹0** (uses the gym's own WhatsApp app)

**Other cost notes:**
- Meta charges no platform/subscription fee for Cloud API — you only pay per message. Backend hosting is
  a few ₹/month at this scale.
- **Messaging tier:** unverified account = 250 messages/24h. After **business verification** → 1,000/day,
  auto-scaling to 10k/100k/unlimited as volume + quality hold. Verify early.
- **Billing:** Meta charges **whoever owns the WABA** (= Kilos, in the centralized model). You then
  re-bill gyms (bundle into their plan, per-message markup, or a monthly WhatsApp add-on).

---

## Current codebase reality

- React 19 + Vite front end; **Firebase/Firestore** data store (`gym-erp-demo`), shared with the Flutter
  mobile app. Multi-tenant: `gyms/{gymId}/members/{memberId}` etc.
- Members already have `phone`, `expiryDate`, `status`, `birthday` — everything reminders need.
- `src/utils/whatsapp.js` already opens `wa.me/91{phone}` — Feature A is essentially done.
- `src/pages/communication/CommunicationHub.jsx` — announcement UI exists but **has no backend that
  actually sends**.
- **No outbound-HTTP backend exists.** The Cloud API needs a server to hold the secret token + run
  scheduled jobs.

---

## Implementation plan

### Phase 1 — Feature A: free one-click WhatsApp (no Meta account needed)
1. Extend `src/utils/whatsapp.js` with message templates (renewal, payment-due, birthday, welcome) that
   interpolate member + gym name and pre-fill the `wa.me?text=` body.
2. Wire "WhatsApp" buttons in member/payment/class pages (the `SendWhatsAppModal` already does this).
3. Responsive on mobile web. **Cost ₹0. No API, no verification.**

### Phase 2 — Feature B: Cloud API backend (paid automation)

**One-time Meta setup (manual, done by you):** create Meta Business Portfolio → WhatsApp Business app →
add & verify the Kilos phone number → submit **business verification** → create + get approval for
message **templates** → generate a **permanent access token** via a System User.

**Backend — Firebase Cloud Functions (2nd gen), Node.js** (data + auth already in Firebase; scheduled/
Firestore triggers native). *Requires the Firebase **Blaze** pay-as-you-go plan — Spark can't call Meta.*

1. **Secrets:** `WHATSAPP_TOKEN` + `PHONE_NUMBER_ID` in **Firebase Secret Manager** (never Firestore/client).
2. `sendWhatsAppMessage` — **callable function**: takes gym + recipient(s) + template + params, calls the
   Meta Graph API, writes a log doc per send (`gyms/{gymId}/messageLogs`).
3. `dailyReminders` — **scheduled function** (Cloud Scheduler, daily): scans members for
   expiry-within-N-days / payment-due / birthday, sends the matching **Utility** template, respecting a
   per-gym on/off toggle + quiet hours.
4. `whatsappWebhook` — **HTTP function**: receives Meta delivery/read/failed callbacks, updates log docs.

**Firestore additions:**
- `gyms/{gymId}/settings/whatsapp` — `{ enabled, senderConfig (default=Kilos, overridable later),
  reminderDays, quietHours, marketingOptIn }` — the per-gym-number hook.
- `gyms/{gymId}/messageLogs/{id}` — audit + delivery status + cost tracking.
- Add `whatsappOptIn` to member docs (Meta requires opt-in for business-initiated messages).
- Update `firestore.rules` so only Functions write logs; clients read their own gym's.

**Front-end wiring:**
- `CommunicationHub.jsx` — wire the WhatsApp channel + "Send" to call `sendWhatsAppMessage`; show
  per-recipient status; add an audience picker (all / expiring / plan / custom).
- WhatsApp settings page (toggle automation, reminder-days, opt-in view).
- Pre-send **cost estimate** ("~500 msgs × ₹1.10 ≈ ₹550").

### Phase 3 — Per-gym numbers (Tech Provider) — future
Register as Meta Tech Provider, add embedded-signup so a gym connects its own number; `senderConfig` is
already per-gym, so `sendWhatsAppMessage` just reads that gym's token. No rewrite.

---

## Verification
- **Phase 1:** click a member's WhatsApp button on desktop + phone browser → correct chat opens with the
  right pre-filled text. No cost.
- **Phase 2:** with a Meta **test number**, send one template to your own WhatsApp via the callable
  function; confirm a `messageLogs` doc marked `delivered`. Trigger `dailyReminders` manually and confirm
  only in-window members get messaged. Send a small bulk from CommunicationHub and watch statuses update
  via the webhook.

## Open items to confirm before Phase 2
- Is the Firebase project already on **Blaze**? (Required.)
- Which phone number becomes the Kilos WABA number? (Must NOT be on the WhatsApp app.)
- How you want to re-bill gyms (bundled in plan vs add-on vs markup).

## Sources
- WhatsApp API pricing 2026 — https://blueticks.co/blog/whatsapp-business-api-pricing-2026
- Is the WhatsApp API free (2026) — https://www.unipile.com/is-the-whatsapp-api-free/
- Messaging limits / tiers — https://chatarmin.com/en/blog/whats-app-messaging-limits
- Meta Tech Provider / embedded signup — https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/overview
