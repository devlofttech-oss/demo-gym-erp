# WhatsApp Cloud API — Go-Live Runbook (Feature 2)

This is the checklist to take the WhatsApp send feature from code → live. All the
code is already in the repo; these are the **dashboard + config** steps that only
you can do (Meta account, phone number, secrets).

Model: **centralized** — one Kilos-owned WhatsApp number sends for all gyms; the
gym's name is inserted into each message. Send-only (no reply inbox), one-click
send from the app buttons + bulk announcements. No daily auto-job.

---

## 1. Set these Environment Variables in Vercel
Vercel → Project (Kilos ERP) → **Settings → Environment Variables**. Server-only —
do **NOT** prefix with `VITE_` (that would leak them to the browser).

| Variable | Value | Where to get it |
|---|---|---|
| `WHATSAPP_TOKEN` | Access token | Meta app → WhatsApp → API Setup (temp token for testing) → later a **permanent** System User token |
| `WHATSAPP_PHONE_NUMBER_ID` | The "From" number's **Phone number ID** | Meta app → WhatsApp → API Setup (shown under the From number) |
| `FIREBASE_SERVICE_ACCOUNT` | The **entire** service-account JSON, pasted as one value | Firebase Console → Project settings → **Service accounts** → *Generate new private key* → download → paste the file's contents |
| `WHATSAPP_API_VERSION` | *(optional)* `v21.0` | default is fine |
| `WHATSAPP_TEMPLATE_LANG` | *(optional)* `en_US` | must match the language of your approved templates |
| `WHATSAPP_VERIFY_TOKEN` | *(webhook)* any string you invent, e.g. `kilos-wa-2026` | you'll type the same value in Meta's webhook config |

Optional template-name overrides (only if Meta approves them under different names):
`WA_TPL_RENEWAL`, `WA_TPL_PAYMENT`, `WA_TPL_CLASS`, `WA_TPL_ANNOUNCEMENT`.

After adding vars, **redeploy** (Vercel → Deployments → Redeploy) so the functions pick them up.

---

## 2. Create these Message Templates in Meta (get them approved)
Meta → WhatsApp Manager → **Message templates → Create template**. Language **English (US)**
(`en_US`) to match the default. Each `{{n}}` is filled in automatically by the app.

> The template **name**, **language**, and **number/order of variables** must match exactly.

**1. `renewal_reminder`** — Category: **Utility**
```
Hi {{1}}, your {{2}} membership is scheduled to expire on {{3}}. Please contact us if you have any questions about your account.
```
Sample values: {{1}}=Ravi, {{2}}=Iron Gym, {{3}}=2026-09-01

**2. `payment_due`** — Category: **Utility**
```
Hi {{1}}, this is a payment reminder from {{2}}. You have a pending balance of {{3}}. Please clear your dues at your earliest convenience.
```
Sample values: {{1}}=Ravi, {{2}}=Iron Gym, {{3}}=₹1,500

**3. `class_reminder`** — Category: **Marketing** *(Meta classifies attendance/re-engagement reminders as Marketing)*
```
Hi {{1}}, we've missed you at {{2}}! Regular attendance keeps you on track — see you at your next session. Stay consistent!
```
Sample values: {{1}}=Ravi, {{2}}=Iron Gym

**4. `announcement`** — Category: **Marketing** — variables: 1=name, 2=gym, 3=message
```
Hi {{1}}, here's an update from {{2}}:

{{3}}

Thank you for being a valued member!
```
Sample values: {{1}}=Ravi, {{2}}=Iron Gym, {{3}}=We're closed this Sunday for maintenance

Approval usually takes a few minutes to ~24h. **Marketing** templates are scrutinised
more; if `announcement` is rejected for being too generic, add a clearer fixed prefix
(e.g. start with "📢 Update from {{3}}:") and resubmit.

---

## 3. Business verification (to send to real members)
- The **test number** can only message the (max 5) numbers you add in API Setup — good
  for testing.
- To message real members and lift the 250/day cap: Meta → **Business verification**
  (upload Devloft's GST, incorporation certificate, PAN, address proof). 2–4 days.
- Then add your **dedicated** production number (a SIM **not** on the WhatsApp app),
  set its display name (e.g. "Kilos"), and swap `WHATSAPP_TOKEN` to a **permanent**
  System User token + `WHATSAPP_PHONE_NUMBER_ID` to the production number.

---

## 3b. Delivery / read status webhook (optional, recommended at go-live)
Turns "sent" into **delivered ✓✓ / read** on each `messageLogs` entry. Not needed to
send; wire it when you're near launch (webhooks only receive real data once the app
is **Published**).

In Meta → your app → **WhatsApp → Configuration → Webhooks** (the "Configure Webhooks"
step):
1. **Callback URL:** `https://app-kilos.devlofttech.com/api/whatsapp/webhook`
2. **Verify token:** the exact string you set in `WHATSAPP_VERIFY_TOKEN` (e.g. `kilos-wa-2026`)
3. Click **Verify and save** (our GET handler answers the challenge).
4. Under **Webhook fields**, subscribe to **`messages`** (this delivers status updates too).
5. **Publish the app** (App Review → publish) so production status events are delivered.

First run may hit a Firestore error asking for a **collection-group index** on
`messageLogs.wamid` — click the link in the error to auto-create it (one-time).

> We ignore incoming member *messages* (send-only). Capturing/showing replies is a
> future feature (needs a chat UI).

## 4. How to test
1. In Meta API Setup, add **your own number** to the allowed test recipients.
2. Approve the 4 templates (step 2).
3. Set the env vars (step 1) on a Vercel deployment and redeploy.
4. Open the deployed app → **Renewals** → a member (use one whose number = your test
   number) → **Remind** → the confirm modal → **Send**. You should receive it on WhatsApp,
   and a `messageLogs` doc appears under that gym in Firestore with `status: sent`.
5. Try **Communication Hub → New Announcement → Send on WhatsApp** for a bulk send.

> **Local dev note:** `/api/whatsapp/send` only runs on Vercel (or via `vercel dev`).
> Under plain `npm run dev` the button will error — test on a Vercel preview/prod deploy.

---

## 5. What the code does (for reference)
- `api/whatsapp/send.js` — verifies the caller's Firebase login + gym membership, reads
  each member from Firestore, sends the template via the Graph API, logs every attempt to
  `gyms/{gymId}/messageLogs`.
- `api/_lib/*` — Admin SDK init, Graph API sender, template registry (edit template
  wording/params in `api/_lib/whatsappTemplates.js`).
- Frontend: every reminder button + bulk announcements call `sendWhatsApp()` →
  `src/utils/whatsappApi.js`. Confirm/preview UI in `SendWhatsAppModal.jsx`.

## Cost per message (India, Meta direct)

Meta bills **per delivered message**, by category. Every reminder is **Utility**
(cheap); only bulk announcements are **Marketing** (higher). No platform/subscription
fee — billed to the WABA owner (Kilos).

| In-app button / feature | Template | Category | Cost / message |
|---|---|---|---|
| **Renewals → Remind** | `renewal_reminder` | Utility | **≈ ₹0.14** |
| **Members list → Remind** (expiring) | `renewal_reminder` | Utility | **≈ ₹0.14** |
| **Member profile → Remind** (balance due) | `payment_due` | Utility | **≈ ₹0.14** |
| **Members list → ₹ Due** (balance) | `payment_due` | Utility | **≈ ₹0.14** |
| **Payments → message** (dues / expired) | `payment_due` / `renewal_reminder` | Utility | **≈ ₹0.14** |
| **Classes → send message** (attendance) | `class_reminder` | **Marketing** | **≈ ₹1.10** |
| **Members list → Send Reminder** (absence) | `class_reminder` | **Marketing** | **≈ ₹1.10** |
| **Communication Hub → announcement** | `announcement` | **Marketing** | **≈ ₹1.10** |

The modal's "≈ ₹" estimate = (number of recipients) × (rate above). Examples:
- Remind 1 member to renew → 1 × ₹0.14 ≈ **₹0.14**
- Payment reminder to 30 members with dues → 30 × ₹0.14 ≈ **₹4.20**
- Announcement to 500 members → 500 × ₹1.10 ≈ **₹550**

> Rates are approximate (Meta adjusts India pricing periodically) and shown for
> planning; Meta's invoice is the source of truth. Incoming replies from members
> (service messages) are **free**.
