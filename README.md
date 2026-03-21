<div align="center">

# Sahaay (Rakshak)

**Multi-Disaster Response & Relief Operations Platform**

[![Next.js](https://img.shields.io/badge/Next.js-App%20Router-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-18-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL%20%7C%20Auth%20%7C%20Storage-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![Twilio](https://img.shields.io/badge/Twilio-Voice%20%7C%20SMS-F22F46?style=for-the-badge&logo=twilio&logoColor=white)](https://www.twilio.com/)
[![MapLibre](https://img.shields.io/badge/MapLibre-GL%20JS-396CB2?style=for-the-badge)](https://maplibre.org/)
[![PWA](https://img.shields.io/badge/PWA-Offline%20Queue%20%2B%20Sync-5A0FC8?style=for-the-badge)](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
[![Azure](https://img.shields.io/badge/Deployment-Azure%20App%20Service-0078D4?style=for-the-badge&logo=microsoftazure&logoColor=white)](https://azure.microsoft.com/)
[![Python](https://img.shields.io/badge/Python-ML%20Modules-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)

<br/>

Live: <https://sahaay.azurewebsites.net/>  
Repository: <https://github.com/durvibangera/rakshak>

</div>

---

## Highlights

- Disaster response workflows for **citizens, camp admins, operators, NGOs, and super admins**
- **QR identity generation + QR camp check-in** for rapid intake during emergencies
- **Missing report + unidentified person** workflows with traceable case handling
- **Face-assisted matching APIs** for identity/reunification support (`/api/face-embedding`, `/api/face-match`)
- **Alert approval -> evacuation execution** with multilingual **Twilio Voice/SMS** delivery
- **Offline-first queueing** using IndexedDB + sync engine + service worker
- **Map-based situational awareness** with disaster overlays and camp locations
- **Camp resource + allocation pipelines** (requests, dispatches, kit inventory, NGO assignment)

---

## Architecture

```text
┌───────────────────────────────────────────────────────────────────────────┐
│                 Next.js App (UI + API)                                   │
│  Citizen Pages: register, login, report-missing, track-report            │
│  Ops Pages: camp dashboard, operator, super-admin, NGO portal            │
│  APIs: victims/camps/alerts/evacuate/missing/resources/ml/sync           │
└────────────────────────────┬──────────────────────────────────────────────┘
                             │
            ┌────────────────┼────────────────┬────────────────┐
            ▼                ▼                ▼                ▼
┌──────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌───────────────┐
│ Supabase         │ │ Twilio          │ │ External Data    │ │ Offline Stack │
│ PostgreSQL       │ │ Voice + SMS     │ │ Open-Meteo/USGS  │ │ IndexedDB     │
│ Auth             │ │ Evacuation      │ │ prediction inputs│ │ Service Worker│
│ Storage          │ │ notifications   │ │                  │ │ sync engine   │
│ Realtime         │ └─────────────────┘ └─────────────────┘ └───────────────┘
└──────────────────┘
                             │
                             ▼
                 Python/ML modules (risk/allocation datasets & scripts)
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js (App Router), React, JavaScript, Tailwind + inline styles |
| **Backend** | Next.js API Routes (server-side handlers) |
| **Database** | Supabase PostgreSQL |
| **Auth & Identity** | Supabase Auth, role-based access flows |
| **Storage** | Supabase Storage (selfies/photos) |
| **Realtime** | Supabase Realtime (alerts stream) |
| **Communication** | Twilio Voice + SMS |
| **Mapping** | MapLibre GL JS |
| **Offline/PWA** | IndexedDB (`idb`), service worker (`sw.js`), background sync, offline queue |
| **Prediction Inputs** | Open-Meteo + USGS integrations |
| **ML Modules** | Python scripts/data under `ml/` + app-level ML API routes |
| **Deployment** | Azure App Service |

---

## Main Features

### 1) Citizen Safety
- Pre-registration with QR identity
- Selfie/profile capture and emergency profile fields
- Missing person report filing and report tracking

### 2) Camp Operations
- Camp registration and camp dashboard
- Victim registration (manual + QR + face-assisted flows)
- Unidentified person intake and status updates
- Camp resources panel (beds, food, water, medical supplies, power, internet)

### 3) Alerts, Calls, and Evacuation
- Disaster alert creation and operator approval
- Camp-focused evacuation logic
- Twilio multilingual voice and SMS notification flows

### 4) Offline Reliability
- Queue write actions while offline
- Show queued operations in UI
- Sync queued actions automatically when network returns

---

## API Surface (Selected)

### Auth
- `POST /api/auth/otp`
- `POST /api/auth/ngo`
- `POST /api/auth/phone-login`

### Victims / Camps
- `GET,POST /api/victims`
- `GET,POST /api/qr-lookup`
- `GET,POST /api/camps`
- `GET,POST,PATCH /api/camp-resources`
- `GET,POST /api/dependents`

### Missing / Unidentified
- `GET,POST /api/missing-reports`
- `GET,POST /api/unidentified-persons`

### Alerts / Evacuation / Comms
- `GET,POST /api/alerts`
- `PUT /api/alerts/approve`
- `POST /api/evacuate`
- `GET /api/voice-twiml`
- `POST /api/sms-alert`

### ML / Prediction
- `GET /api/predict`
- `POST /api/ml/predict`
- `POST /api/ml/safe-zone`
- `POST /api/ml/phase`
- `POST /api/ml/allocate`

### Offline
- `POST /api/sync`

---

## Project Structure

```text
rakshak/
├── app/                    # Next.js pages + API routes
├── components/             # Common UI + map components
├── context/                # Auth context
├── hooks/                  # Offline sync/status, alerts, location
├── lib/
│   ├── supabase/           # client/server/admin clients
│   ├── external/           # Twilio/weather integrations
│   ├── offline/            # IndexedDB queue + sync engine
│   ├── ai/                 # app-level AI helpers
│   └── utils/              # language, distance, role helpers
├── ml/                     # Python scripts + datasets
├── public/                 # PWA manifest, service worker, models, icons
└── supabase-schema.sql
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- npm
- Supabase project
- Twilio account (for call/SMS flows)

### 1) Install

```bash
npm install
```

### 2) Environment

Create `.env.local` in `rakshak/`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
TWILIO_VERIFIED_TO_NUMBERS=
```

Add optional keys used by external/AI modules as needed.

### 3) Run

```bash
npm run dev
```

Open: `http://localhost:3000`

---

## Operational Notes

- Offline actions are persisted locally, then replayed to `/api/sync` when online.
- Some advanced modules are environment-dependent (credentials/services required).
- Ensure Supabase RLS policies and service-role usage are configured securely before production rollout.

---

## Roadmap

- [x] QR identity + camp check-in workflows
- [x] Missing/unidentified person management
- [x] Alert approval and evacuation communication
- [x] Offline queue + sync pipeline
- [ ] Enhanced observability dashboards
- [ ] Expanded multilingual voice templates
- [ ] Stronger automated test coverage for critical APIs

---

<div align="center">

Built for high-pressure disaster response scenarios where reliability matters most.

</div>
