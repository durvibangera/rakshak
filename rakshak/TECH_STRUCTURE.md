# Rakshak — Technical Structure

Technical overview of the **Rakshak Disaster Rescue Platform**: stack, folder layout, routes, APIs, and data flow.

---

## 1. Overview

- **Framework:** Next.js 14 (App Router)
- **UI:** React 18, inline styles + Tailwind
- **Backend:** Supabase (PostgreSQL, Auth, Realtime, Storage)
- **Maps:** MapLibre GL JS
- **Voice / SMS:** Twilio
- **Weather / disaster data:** Open-Meteo, USGS (via `weatherService.js`)

---

## 2. Directory Structure

```
rakshak/
├── app/                    # Next.js App Router (pages + API)
├── components/             # Reusable UI (common + map)
├── context/                # React context (Auth)
├── constants/              # Roles, disaster types, colors, languages
├── hooks/                  # useOfflineSync, useLocationTracker, etc.
├── lib/                    # Supabase clients, external services, utils, offline
├── ml/                     # Python scripts, ML data (safe zones, camps)
├── public/                 # Static assets, PWA manifest, service worker, icons
├── supabase-schema.sql     # DB schema (run in Supabase SQL Editor)
├── package.json
├── next.config.mjs
├── tailwind.config.js
└── jsconfig.json           # Path alias @/ → ./
```

---

## 3. App Router (`app/`)

### 3.1 Root & layout

| File | Purpose |
|------|---------|
| `layout.js` | Root layout: fonts, metadata, `AuthProvider`, `ErrorBoundary`, `ServiceWorkerRegistrar`, `OfflineBanner` |
| `page.js` | **Landing page**: CTAs (Register, Report Missing, Disaster Map, Track Report), Login / Admin / NGO links |
| `error.js` | Error boundary for the app |
| `not-found.js` | 404 page |
| `globals.css` | Global styles, button/link clickability |

### 3.2 Public / citizen pages

| Route | File | Purpose |
|-------|------|---------|
| `/register` | `register/page.js` | Citizen pre-registration: name, phone, address, state, GPS, selfie, QR identity |
| `/login` | `login/page.js` | Citizen login (redirects to register) |
| `/report-missing` | `report-missing/page.js` | File missing-person report |
| `/track-report` | `track-report/page.js` | Track missing-person report by phone |
| `/flood-prediction` | `flood-prediction/page.js` | Disaster prediction map, alerts, danger zones |
| `/offline` | `offline/page.js` | Offline / PWA info |

### 3.3 Admin / staff / camp

| Route | File | Purpose |
|-------|------|---------|
| `/admin-login` | `admin-login/page.js` | Central login: Camp Admin, Operator, Super Admin, NGO |
| `/camp/register` | `camp/register/page.js` | Register a relief camp (name, contact, location, radius) |
| `/camp/dashboard` | `camp/dashboard/page.js` | Camp admin: victims, QR check-in, manual registration, alerts |
| `/operator/dashboard` | `operator/dashboard/page.js` | Operator: QR check-in only, inventory |
| `/camp-admin/request-resources` | `camp-admin/request-resources/page.js` | Request resources |
| `/camp-admin/my-dispatches` | `camp-admin/my-dispatches/page.js` | View dispatches |

### 3.4 Super Admin

| Route | File | Purpose |
|-------|------|---------|
| `/super-admin/dashboard` | `super-admin/dashboard/page.js` | Super admin home |
| `/super-admin/simulate` | `super-admin/simulate/page.js` | Simulate disasters |
| `/super-admin/safe-zones` | `super-admin/safe-zones/page.js` | Safe zones |
| `/super-admin/ngos` | `super-admin/ngos/page.js` | NGO management |
| `/super-admin/sms-alerts` | `super-admin/sms-alerts/page.js` | SMS alerts |
| `/super-admin/allocation-history` | `super-admin/allocation-history/page.js` | Allocation history |

### 3.5 NGO

| Route | File | Purpose |
|-------|------|---------|
| `/ngo/login` | `ngo/login/page.js` | NGO login |
| `/ngo/portal` | `ngo/portal/page.js` | NGO portal |

### 3.6 Other app pages

| Route | File | Purpose |
|-------|------|---------|
| `/admin/dashboard` | `admin/dashboard/page.js` | Admin dashboard |
| `/ml-test` | `ml-test/page.js` | ML / prediction test |
| `/ngo-pipeline-test` | `ngo-pipeline-test/page.js` | NGO pipeline test |

---

## 4. API Routes (`app/api/`)

### 4.1 Auth

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/auth/otp` | POST | OTP send/verify |
| `/api/auth/ngo` | POST | NGO auth |

### 4.2 Users, victims, camps

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/victims` | GET, POST | List/create victims; GET by `camp_id` returns camp_victims + users |
| `/api/qr-lookup` | GET/POST | Lookup user by QR id (or phone), auto check-in to camp |
| `/api/camps` | GET, POST | List camps, get by id/code, register camp |
| `/api/camp-resources` | GET, POST, PATCH | Camp inventory (beds, food, water, etc.) |
| `/api/dependents` | GET, POST | Dependents under a user |
| `/api/unidentified-persons` | GET, POST | Unidentified person records |

### 4.3 Alerts, evacuation, calls

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/alerts` | GET, POST | List/create disaster alerts |
| `/api/alerts/approve` | POST | Camp operator approve/reject alert → triggers calls |
| `/api/evacuate` | POST | Start evacuation calls for an alert |
| `/api/voice-twiml` | GET | TwiML for Twilio voice (Hindi/regional) |
| `/api/test-call` | GET/POST | Test single call |
| `/api/test-flood-kj` | GET/POST | Test flood near KJ Somaiya (Hindi + Marathi) |
| `/api/test-trigger` | GET/POST | Test disaster trigger + calls |
| `/api/dummy-disaster` | POST | Create dummy disaster alert |
| `/api/sms-alert` | POST | Send SMS fallback |

### 4.4 Missing persons

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/missing-reports` | GET, POST | Create/list missing-person reports, match with camps |

### 4.5 Prediction & ML

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/predict` | GET, POST | Run disaster prediction at lat/lng |
| `/api/ml/predict` | POST | ML prediction |
| `/api/ml/safe-zone` | POST | Safe zone recommendation |
| `/api/ml/phase` | POST | Phase/severity |
| `/api/ml/allocate` | POST | Allocation logic |

### 4.6 Resources, NGOs, allocations

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/resource-requests` | GET, POST | Resource requests |
| `/api/ngos` | GET, POST | NGO CRUD |
| `/api/ngos/assign` | POST | Assign NGO to area/request |
| `/api/allocation-rounds` | GET, POST | Allocation rounds |
| `/api/dispatch-orders` | GET, POST | Dispatch orders |
| `/api/kit-inventory` | GET, POST | Kit inventory |
| `/api/donations` | GET, POST | Donations |

### 4.7 Offline & misc

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/sync` | POST | Process offline queue (sync to Supabase) |
| `/api/face-match` | POST | Face match (demo/placeholder) |
| `/api/tts-audio` | GET/POST | TTS audio for voice |
| `/api/safe-zones` | GET, POST | Safe zones |
| `/api/seed-test-accounts` | POST | Seed test users/camps |

---

## 5. Components (`components/`)

### 5.1 Common

| Component | Purpose |
|-----------|---------|
| `ErrorBoundary.js` | Catches React errors, shows fallback |
| `RoleGate.js` | Restricts by role (super_admin, camp_admin, operator, etc.) |
| `OfflineBanner.js` | Offline/syncing banner, “Sync Now” |
| `ServiceWorkerRegistrar.js` | Registers `/sw.js` (no UI) |
| `QRScanner.js` | Camera QR scan (front camera), jsQR |
| `CameraCapture.js` | Take photo (selfie/victim) |
| `FaceScanner.js` | Face capture for identification |
| `LoadingSkeleton.js` | Loading placeholder |
| `AlertBanner.js` | Alert message banner |
| `LanguageToggle.js` | Language switcher |

### 5.2 Map

| Component | Purpose |
|-----------|---------|
| `CampMap.js` | MapLibre map, camp markers, interaction |
| `DangerZoneLayer.js` | Danger zones overlay on map |

---

## 6. Lib (`lib/`)

### 6.1 Supabase

| File | Purpose |
|------|---------|
| `supabase/client.js` | Browser client (RLS applies) |
| `supabase/server.js` | Server client for API routes |
| `supabase/admin.js` | Service role (bypass RLS) |

### 6.2 External services

| File | Purpose |
|------|---------|
| `external/callService.js` | Twilio voice: initiate call, Hindi/regional TwiML |
| `external/weatherService.js` | Open-Meteo, USGS; flood/quake/landslide/cyclone risk |
| `external/digilockerService.js` | Digilocker integration (if used) |

### 6.3 Offline

| File | Purpose |
|------|---------|
| `offline/offlineStore.js` | IndexedDB (idb) for offline queue |
| `offline/syncEngine.js` | Flush queue to Supabase when online |
| `offline/offlineFetch.js` | Fetch wrapper / offline handling |

### 6.4 Utils

| File | Purpose |
|------|---------|
| `utils/distanceCalculator.js` | Haversine distance |
| `utils/findUsersByLocation.js` | Find users in radius (for calls) |
| `utils/languageSelector.js` | State → language, disaster message text |
| `utils/languageConfig.js` | Language config |
| `utils/emergencyContacts.js` | Emergency contact helpers |
| `utils/roleGuard.js` | Server-side role checks |

### 6.5 AI / ML (app-level)

| File | Purpose |
|------|---------|
| `ai/claudeService.js` | Claude API |
| `ai/sarvamService.js` | Sarvam AI |
| `ai/ptsdDetection.js` | PTSD detection (e.g. from text) |

---

## 7. Context & hooks

### 7.1 Context

| File | Purpose |
|------|---------|
| `context/AuthContext.js` | Auth state, user profile, `refreshProfile()`, login/logout |

### 7.2 Hooks

| Hook | Purpose |
|------|---------|
| `useOfflineSync.js` | Online status, pending count, `syncNow()` |
| `useOfflineStatus.js` | Online/offline only |
| `useLocationTracker.js` | Geolocation |
| `useRealtimeAlerts.js` | Supabase Realtime for alerts |
| `useTranslation.js` | Translation/locale |

---

## 8. Constants

| File | Purpose |
|------|---------|
| `constants/roles.js` | Role enum + labels (super_admin, camp_admin, operator, verified_user, etc.) |
| `constants/disasterTypes.js` | Disaster type enum |
| `constants/colors.js` | UI color set |
| `constants/languages.js` | Language list/codes |

---

## 9. Database (Supabase)

Main tables (see `supabase-schema.sql` and any migration files):

| Table | Purpose |
|-------|---------|
| `users` | Citizens: name, phone, address, state, lat/lng, selfie_url, blood_group, medical_conditions, qr_code_id, role, auth_uid, etc. |
| `alerts` | Disaster alerts: type, risk, lat/lng, location_name, source, resolved_at |
| `predictions` | Prediction history: lat/lng, overall + per-disaster risk |
| `call_logs` | Twilio call log: alert_id, user_id, phone, status, call_sid, language |
| `camps` | Relief camps: name, operator_*, lat/lng, radius_km, status, camp_code, admin_user_id |
| `camp_victims` | Check-ins: camp_id, user_id, checked_in_at, checked_in_via (manual | qr | face) |
| `camp_alerts` | Alert approval: camp_id, disaster_type, severity, status (pending | approved | rejected | calls_sent) |
| `offline_queue` | Offline actions to sync: camp_id, action_type, payload, synced |
| `dependents` | Dependents linked to a user (v2) |
| `missing_reports` | Missing-person reports (v2) |
| `unidentified_persons` | Unidentified persons (v2) |
| `camp_resources` | Per-camp inventory (v2) |
| `audit_logs` | Audit trail (v2) |

RLS is enabled on these tables; policies allow read/write as needed for anon and service role.

---

## 10. Public & PWA

| Path | Purpose |
|------|---------|
| `public/manifest.json` | PWA manifest, name, icons, theme |
| `public/sw.js` | Service worker (caching, offline) |
| `public/icons/icon-192.png`, `icon-512.png` | PWA icons |
| `public/models/` | Face detection model files (if used) |

---

## 11. Scripts (`package.json`)

| Command | Purpose |
|---------|---------|
| `npm run dev` | Next.js dev server (default port 3000) |
| `npm run build` | Production build |
| `npm run start` | Run production server |
| `npm run lint` | ESLint |

---

## 12. Environment

Use `.env.local` (never commit). Typical variables:

- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL  
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key  
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` — Twilio voice/SMS  
- Any keys for weather, AI, or other external APIs used in `lib/`

---

## 13. High-level flows

1. **Citizen:** Landing → Register (or Login) → QR identity; can Report Missing, Track Report, view Disaster Map.
2. **Camp:** Admin registers camp → Camp dashboard / Operator dashboard → QR check-in or manual victim entry → Camp resources updated.
3. **Alerts:** Prediction or manual alert → `alerts` / `camp_alerts` → Operator approves → `/api/evacuate` + `callService` → Twilio calls in Hindi/regional language.
4. **Offline:** Actions stored in IndexedDB → when online, `syncEngine` + `/api/sync` push to Supabase.

This document reflects the structure as of the last update; new routes or tables should be added here as they are introduced.
