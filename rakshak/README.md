# 🛡️ Rakshak — India's Disaster Response & Survival Platform

> **Multilingual, offline-first disaster response ecosystem built for India.**

PPT Link: https://www.canva.com/design/DAHCqZFwKY8/MpxLrr1N_tRpbwBMkG-JTQ/view?utm_content=DAHCqZFwKY8&utm_campaign=designshare&utm_medium=link2&utm_source=uniquelinks&utlId=h72f3b37a17

Rakshak connects disaster victims with relief camps, reunites separated families,
and enables NGOs to coordinate resources — all in the victim's local language,
even without internet connectivity.

## The Problem

Every year India faces devastating natural disasters. When they strike:
- Families are separated with no way to reconnect
- Mobile networks collapse within hours
- Victims lose identity documents
- Relief camps operate blindly without data
- Food/medical supplies are distributed inefficiently

## What Rakshak Does

### Phase 1 — Before Disaster (Prediction & Preparedness)
- AI-powered flood/cyclone/earthquake prediction
- Multilingual early warning alerts (app, SMS, voice calls)
- Pre-registration with QR emergency ID cards

### Phase 2 — First 48 Hours (Core Survival)
- Offline-capable camp locator with smart routing
- Bluetooth mesh SOS messaging without cell towers
- QR scan check-in with automatic family notification
- Real-time family safety tracker
- AI chatbot guidance in local language

### Phase 3 — After 48 Hours (Recovery)
- PTSD detection and counselor connections
- Government aid scheme discovery
- Long-term recovery tracking

## Tech Stack

- **Frontend**: Next.js 14 (App Router), Tailwind CSS, Mapbox GL JS, Recharts
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL + Auth + Realtime)
- **AI**: Anthropic Claude (chatbot), SarvamAI (translation + TTS)
- **Weather**: OpenWeatherMap API
- **Deployment**: Vercel + Supabase Cloud

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/basic-features/font-optimization) to automatically optimize and load Inter, a custom Google Font.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js/) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.
