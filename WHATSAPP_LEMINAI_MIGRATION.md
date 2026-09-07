# WhatsApp: migrate from direct Meta Cloud API → LeminAi

Status: **planning** · marketing templates already removed (only `renewal` + `payment` utility templates remain).

## ⚠️ Read this first — what LeminAi actually is

Research finding: **LeminAi is an *official* Meta partner** ("Meta Verified Tech Partner" / BSP), not an unofficial gateway. It resells the **official WhatsApp Business API** and handles the onboarding (business verification, number provisioning, blue tick) for you.

What that means for "we didn't get approval":
- If the blocker was the **Meta Cloud API self-setup** (WABA + business verification + number registration) → **LeminAi solves this**: they hand you a ready working WhatsApp Business number.
- If the blocker was **template approval** → LeminAi does **NOT** bypass it (it's still official). BUT our two templates are **Utility** category (`renewal_reminder`, `payment_due`) — transactional, low-risk, and approve quickly/reliably. LeminAi (as partner) submits them for you.
- LeminAi does **not** let you send un-approved free-form marketing. If that's ever needed, the only alternatives are unofficial gateways (Ultramsg, whapi.cloud, wasenderapi) which **violate WhatsApp ToS and risk number bans** — not recommended for a business number.

**Bottom line:** for our 2 utility reminders, LeminAi is a legitimate, good choice. It mainly removes the self-onboarding pain.

## What we need from the LeminAi dashboard (blocking the code)

LeminAi's API details are behind their dashboard (`app.leminai.com` / `chat.leminai.com`), not public. To finish the integration we need:
1. **API base URL** (e.g. `https://api.leminai.com/...` or a per-account endpoint)
2. **API key / access token** + how it's passed (Bearer header vs `x-api-key`)
3. **Send-message request format** — template send: field names for `to` / `template_name` / `language` / body params (or campaign-based)
4. **Approved template names** for our 2 templates (LeminAi may register them under its own names)
5. Whether there's a **webhook** for delivery/read receipts (optional)

## Current architecture (Meta Cloud API)

```
Frontend (SendWhatsAppModal / whatsapp_api_sheet)
  → POST /api/whatsapp/send            (api/whatsapp/send.js)  — Firebase-auth'd, gym-scoped
     → buildTemplate(type,...)         (api/_lib/whatsappTemplates.js)  — 2 utility templates
     → sendTemplate(...)               (api/_lib/whatsapp.js)  — POST graph.facebook.com/<ver>/<phoneId>/messages
     → deduct gyms/{gymId}.waCredits, log to gyms/{gymId}/messageLogs
```
Env (Vercel): `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_API_VERSION`, `WHATSAPP_TEMPLATE_LANG`, `WA_TPL_RENEWAL`, `WA_TPL_PAYMENT`.

## Target architecture (provider-swappable)

Keep the whole app (frontend, `send.js`, credits, logs) unchanged. Introduce a **provider adapter** so only the transport swaps, chosen by one env var.

```
send.js  → buildTemplate(...)  (unchanged)
         → sendViaProvider(...)          NEW: api/_lib/waProvider.js
              switch (process.env.WA_PROVIDER) {
                'meta'    → api/_lib/whatsapp.js   (existing graph.facebook.com)
                'leminai' → api/_lib/providers/leminai.js   (NEW)
              }
```
- Both adapters expose the same function: `sendTemplate({ toPhone, template, language, components }) → { ok, id?, error? }`.
- `WA_PROVIDER=leminai` flips production to LeminAi with zero frontend changes.
- Keep `meta` adapter so we can flip back instantly if LeminAi has issues.

## Migration steps

1. ✅ **Remove marketing templates** — done (`class`, `announcement` gone; only `renewal`/`payment` remain). Commit local.
2. **Refactor transport into an adapter** — extract the existing Meta call in `api/_lib/whatsapp.js` behind `sendTemplate(...)`; add `api/_lib/waProvider.js` that dispatches on `WA_PROVIDER` (default `meta`, so nothing changes until we flip).
3. **Write `api/_lib/providers/leminai.js`** — implement `sendTemplate` against LeminAi's REST API (needs the 5 details above). Map our `template`/`components` → LeminAi's payload shape. Read `LEMINAI_API_URL`, `LEMINAI_API_KEY`, `LEMINAI_TPL_RENEWAL`, `LEMINAI_TPL_PAYMENT` from env.
4. **Get the 2 utility templates approved via LeminAi** (renewal_reminder, payment_due) — same wording as `whatsappTemplates.js` / `whatsappTemplatePreviews.js`.
5. **Set env on Vercel** — `WA_PROVIDER=leminai` + the LeminAi vars. Deploy.
6. **Test** one renewal + one payment send to a known number; confirm delivery + `messageLogs` entry.
7. **Decide credits model** (see below).

## Decisions needed
- **Credits model:** today each gym has `waCredits` and we deduct per send. LeminAi bills *you* (the operator) on its plan (₹599/₹999/mo + Meta conversation charges). Keep the per-gym credit system as your reseller markup, or drop it and absorb the cost? (No code change needed to keep it — deduction is provider-agnostic.)
- **One number for all gyms vs per-gym numbers:** simplest is one operator-owned LeminAi number sending on behalf of all gyms (sender = "Kilos"). Per-gym numbers = more setup + cost.
- **Keep Meta adapter?** Recommended yes — cheap insurance to flip back.

## Files in play
- `api/_lib/whatsapp.js` (existing Meta transport → becomes the `meta` adapter)
- `api/_lib/whatsappTemplates.js` (2 templates, unchanged)
- `api/whatsapp/send.js` (unchanged; already provider-agnostic above the transport)
- `api/_lib/waProvider.js` (NEW dispatcher)
- `api/_lib/providers/leminai.js` (NEW)
- Frontend `SendWhatsAppModal.jsx` / mobile `whatsapp_api_sheet.dart` — **no change**
