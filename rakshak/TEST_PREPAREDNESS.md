# How to test Camp Preparedness flow

Calls go **only after approval**. Flow: create alert → admin sees it → admin approves → Twilio calls everyone registered in that camp.

---

## Prerequisites

1. **Dev server running**
   ```bash
   cd sahaay && npm run dev
   ```
   Note the port (e.g. http://localhost:3000 or 3001).

2. **At least one camp** in Supabase `camps` table (e.g. from `/camp/register`).

3. **At least one user registered in that camp** (in `camp_victims`) with a **phone number** in `users`. E.g. use Operator dashboard QR check-in or add rows in Supabase.

4. **Twilio** configured in `.env.local`:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_PHONE_NUMBER`

---

## Step 1: Get a `camp_id`

**Option A – Supabase**  
Supabase Dashboard → Table Editor → `camps` → copy the `id` (UUID) of a camp.

**Option B – API**  
```bash
curl -s "http://localhost:3000/api/camps" | jq
```
Use the `id` of any camp from the response.

---

## Step 2: Create the preparedness alert

Replace `YOUR_CAMP_ID` with the UUID from Step 1. Use your actual dev URL/port if different.

```bash
curl -X POST "http://localhost:3000/api/camp-preparedness-alert" \
  -H "Content-Type: application/json" \
  -d "{\"camp_id\": \"YOUR_CAMP_ID\"}"
```

**Success response** looks like:
```json
{
  "success": true,
  "message": "Preparedness alert created. Admin/Super Admin will see it; calls go only after approval.",
  "alert_id": "<uuid>",
  "camp_id": "<uuid>",
  "camp_name": "My Camp"
}
```
Copy `alert_id` for the next step.

---

## Step 3: Approve the alert (calls go only after this)

**Option A – Camp Dashboard (UI)**  
1. Log in as Camp Admin or Operator (e.g. `/admin-login`).  
2. Open Camp dashboard (e.g. `/camp/dashboard`).  
3. Find the new “Evacuate – danger / preparedness” alert and click **Approve**.  
   That calls `PUT /api/alerts/approve` and then `/api/evacuate` with `preparedness: true`.

**Option B – API (curl)**  
Replace `YOUR_ALERT_ID` with the `alert_id` from Step 2.

```bash
curl -X PUT "http://localhost:3000/api/alerts/approve" \
  -H "Content-Type: application/json" \
  -d "{\"alert_id\": \"YOUR_ALERT_ID\", \"action\": \"approve\", \"reviewed_by\": \"test\"}"
```

After approval, the app calls everyone in `camp_victims` for that camp (with a phone in `users`) via Twilio with the preparedness message (Hindi + regional).

---

## Step 4: Verify

- **Twilio:** Console → Logs → Calls (or your Twilio dashboard).  
- **Supabase:** `call_logs` table should have new rows for the alert.  
- **Supabase:** `camp_alerts` row for this alert should have `status = 'calls_sent'`.

---

## Quick checklist

| Step | What | Result |
|------|------|--------|
| 1 | Get `camp_id` from Supabase or GET `/api/camps` | UUID |
| 2 | POST `/api/camp-preparedness-alert` with `{ "camp_id": "..." }` | `alert_id` in response |
| 3 | Approve in Camp Dashboard or PUT `/api/alerts/approve` with `alert_id`, `action: "approve"` | Calls triggered only after this |
| 4 | Check Twilio + `call_logs` + `camp_alerts.status` | Calls and DB updated |

If no one is in `camp_victims` for that camp (or they have no phone), evacuate returns “No users with phone in this camp” and no calls are made.
