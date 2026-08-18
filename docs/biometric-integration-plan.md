# Biometric Integration Plan — Kilos ERP

Fingerprint / Face / RFID attendance via ZKTeco / eSSL devices

---

## How It Actually Works (the protocol)

Most gym biometric machines (ZKTeco, eSSL, Realtime) are **standalone IP devices** — they sit on the gym's WiFi/LAN and can push attendance logs to a server over HTTP.

The protocol is called **ADMS Push (ZKTeco standard)**. The device is configured with a server URL. Every punch sends an HTTP POST automatically — no Windows bridge app, no polling, no SDK install.

This is exactly how EasyGymSoftware, Okfit, FitGymSoftware and every modern Indian gym ERP does it.

### Data flow

```
Member taps finger
  → Device HTTP POST to /iclock/cdata?SN=DEVICE_SERIAL&table=ATTLOG
    → Firebase Cloud Function (validates + writes)
      → Firestore gyms/{gymId}/attendance/{id}
        → Kilos ERP (real-time via onSnapshot)
```

### Actual request format

```
# 1. Device registers on boot
GET /iclock/cdata?SN=ABC123456&options=all

# 2. Device pushes each punch immediately
POST /iclock/cdata?SN=ABC123456&table=ATTLOG
Body: 1024\t2025-08-18 09:14:32\t0\t1\t0\t0
      userId  timestamp            punch  verify

# 3. Our server must respond with:
200 OK → "OK"    # device confirmed, continues
200 OK → "DENY"  # door stays locked (expired member)
```

---

## Gym Owner Setup Flow

What the owner does — should take under 10 minutes.

**Step 1 — Open Kilos ERP → Settings → Biometric Devices**
Click "Add Device". They get a unique **Gym Token** and a pre-filled **Server URL**.
```
Server URL: https://api.kilos.app/bio/ABC123GYM
Gym Token:  ABC123GYM
```

**Step 2 — Find device IP address**
Shown on the device screen: Menu → Network → IP Address. Usually `192.168.1.105`.

**Step 3 — Open device web interface**
Type the device IP in their browser. Login with `admin / admin` (ZKTeco/eSSL default).

**Step 4 — Paste the Server URL into ADMS / Cloud Settings**
In device web interface: **Communication → ADMS → Server Address**. Paste the URL. Save → Reboot.
```
For eSSL:     Communication Settings → Push Server
For Realtime: Network → Cloud Server URL
```

**Step 5 — Device shows "Online" in Kilos ERP — done**
Within 30 seconds of rebooting, the device pings our server. The device card turns green. Every future punch syncs automatically.

**Step 6 — Link member fingerprint IDs**
Each enrolled member on the device has a numeric User ID (e.g. `1024`). In Kilos ERP Member profile → enter that ID. Punch `1024` = Rahul's attendance from now on.
```
Bulk option: export user list from device (.csv) → import in ERP Settings
```

---

## What We Build

### Cloud Function (backend)
- Receives ADMS push from any device
- Validates gym token (maps device SN → gymId)
- Matches `deviceUserId → memberId` via Firestore mapping
- Writes to `gyms/{gymId}/attendance/{id}`
- Returns `"OK"` or `"DENY"` for expired members

### Settings → Biometric Devices page
- Add Device button → generates gym token
- Shows Server URL to copy-paste
- Device list with online/offline status + last seen + punches today
- Remove device option

### Member Profile → Device ID field
- Field: "Biometric User ID" (number from device)
- Once set, punches auto-match to this member
- Unlinked punches go to "Unknown Punches" queue for manual assignment

### Attendance Page updates
- Biometric punches appear alongside manual check-ins
- `Biometric` vs `Manual` source badge on each record
- Live widget: who's inside right now (IN without matching OUT)
- Duplicate punch guard: ignore second punch within 5 min

---

## Build Phases

### Phase 1 — Cloud Function + Device Setup (2 days)
- Firebase Cloud Function to receive ZKTeco ADMS push
- Parse device payload (user ID, timestamp, punch type)
- Match device SN → gymId via Firestore
- Write attendance record
- Return correct ACK (`"OK"` / `"DENY"`)

### Phase 2 — Device–Member Mapping UI (1 day)
- Settings page: register device, enter serial number
- Member profile: Biometric User ID field
- Firestore mapping: `deviceUserId → memberId`
- Bulk CSV import for existing enrolled devices

### Phase 3 — Attendance UI Updates (1 day)
- Source badge (Biometric / Manual) on each record
- Live "who's inside" dashboard widget
- Member profile punch history
- Duplicate guard (ignore punch within 5 min window)

### Phase 4 — Door / Turnstile Control (optional, 0.5 day)
- Cloud Function checks member `expiryDate` before ACK
- Expired member → respond `"DENY"` → device beeps red, door locked
- Works with ZKTeco access control + electric lock combos

---

## Device Compatibility

| Brand | Models | Price (India) | ADMS Push | Web Interface |
|---|---|---|---|---|
| **ZKTeco** ⭐ most common | F18, F22, SpeedFace V5L, MB360 | ₹4k–₹18k | Yes | Yes |
| **eSSL** | E9, E10, MB160ID, FacePass | ₹3.5k–₹10k | Yes | Yes |
| **Realtime** | T304, T304i, Face702 | ₹5k–₹12k | Yes | Yes |
| **Mantra** | MFS100 (USB only) | ₹2k–₹4k | No | No |
| **Legacy / pre-2018** | Any old device | — | No | — |

All ZKTeco / eSSL / Realtime devices speak the same ADMS protocol — one Cloud Function handles all of them.

**For Mantra and legacy devices:** provide a **Kilos Bridge** small desktop app (Node.js/Electron). Owner installs it on any gym PC, enters Gym Token, it polls the device over USB/LAN and pushes punches to Firestore. Same end result.

---

## How Competitors Do It

| Competitor | Approach |
|---|---|
| EasyGymSoftware / Okfit / FitGymSoftware | Direct ADMS push to cloud. Gym owner pastes server URL into device. Brand-specific PDF guides provided. No bridge app. |
| Gymmaster / GymMinder | Support ZKTeco via ADMS. Also sell their own branded RFID hardware bundled with subscription. |
| Mindbody / Glofox | No biometric support — tablet check-in app or QR codes only. Too expensive for Indian market. |
| Old Indian desktop software | Windows app + ZKLib SDK on a PC at the gym. No cloud sync. This is what everyone is moving away from. |

---

## Effort Estimate

| Task | Estimate |
|---|---|
| Cloud Function (ADMS receiver) | 2 days |
| Settings → Device management UI | 1 day |
| Member profile → Device ID field | 0.5 day |
| Attendance page — biometric badge + live widget | 0.5 day |
| Test with real ZKTeco device | 2 days |
| Door deny for expired members | 0.5 day |
| **Core total (Phases 1–3)** | **~6–7 days** |
| Bridge desktop app (legacy fallback) | +3–4 days |

---

## One Prerequisite

**Firebase Blaze plan required for Cloud Functions.**
The ADMS receiver endpoint needs Firebase Blaze (pay-as-you-go). Cost per gym: ₹5–₹20/month in function invocations — negligible.

**Alternative if you want to skip Blaze:** Deploy a free Node.js service on Railway.app or Render.com. Same ADMS receiver logic, writes to Firestore via admin SDK. Zero cost on free tiers.

---

## Recommended Device to Buy for Testing

**ZKTeco F18** — ₹4,000–₹6,000. Fingerprint + RFID. Full ADMS push support. Most common device in Indian gyms. One device is enough for full dev + QA.
