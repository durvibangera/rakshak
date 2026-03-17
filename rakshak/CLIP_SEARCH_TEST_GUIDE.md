# CLIP Hybrid Search — End-to-End Test Guide

## Prerequisites

Before running any test, ensure both services are running:

**Terminal 1 — CLIP Service:**
```bash
cd face_recognition_module
./venv/Scripts/python.exe clip_service.py
```
Expected output: `CLIP model loaded successfully` + `Running on http://127.0.0.1:5001`

**Terminal 2 — Next.js App:**
```bash
cd rakshak
npm run dev
```
Expected output: `Ready on http://localhost:3000`

**Verify CLIP service health:**
```powershell
Invoke-WebRequest -Uri "http://localhost:5001/health" -UseBasicParsing | Select-Object -ExpandProperty Content
# Expected: {"model":"openai/clip-vit-base-patch32","status":"ok"}
```

---

## Test Case 1: Register a Test User (The "Missing" Person)

This simulates a person who has already registered at a relief camp.

1. Open `http://localhost:3000/register` in your browser
2. Fill in the form with these exact values:

| Field | Value |
|-------|-------|
| Name | Rahul Sharma |
| Phone | +91 9876543210 |
| Age | 28 |
| Gender | Male |
| Height | Tall |
| Build | Athletic |
| Skin Tone | Medium |
| Hair Color | Black |
| Hair Length | Short |
| Facial Hair | Clean Shaven |
| Distinguishing Marks | scar on left cheek |
| Accessories | glasses |

3. Upload a clear face photo (selfie) — this is critical for CLIP to work
4. Click **Register**
5. Note down the user's ID from the success screen (or check Supabase → users table)

---

## Test Case 2: File a Missing Person Report

This simulates a family member searching for Rahul.

1. Open `http://localhost:3000/report-missing`
2. **Step 1 — Reporter Info:**
   - Your Name: `Test Reporter`
   - Your Phone: `9999999999`
   - Click **Next**

3. **Step 2 — Missing Person Details:**

| Field | Value |
|-------|-------|
| Name | Rahul Sharma |
| Age Range Min | 25 |
| Age Range Max | 32 |
| Gender | Male |
| Height | Tall |
| Build | Athletic |
| Skin Tone | Medium |
| Hair Color | Black |
| Hair Length | Short |
| Facial Hair | Clean Shaven |
| Distinguishing Marks | scar on left cheek |
| Accessories | glasses |

4. Click **Submit Report**
5. Note the **Tracking ID** shown on the success screen (first 8 chars of the report UUID)
6. Get the full report UUID from Supabase → `missing_reports` table

---

## Test Case 3: Test Attribute-Only Search (use_clip=false)

Use the report UUID from Test Case 2.

```powershell
Invoke-WebRequest -Uri "http://localhost:3000/api/missing-reports/search" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body '{"report_id":"YOUR_REPORT_UUID_HERE","use_clip":false,"limit":50}' `
  -UseBasicParsing | Select-Object -ExpandProperty Content
```

**Expected response:**
```json
{
  "success": true,
  "report": { "id": "...", "name": "Rahul Sharma", "gender": "Male" },
  "matches": [
    {
      "name": "Rahul Sharma",
      "match_score": 63,
      "matched_attributes": ["gender", "height", "build", "skin_tone", "hair_color", "hair_length", "facial_hair"],
      "match_confidence": 0.63
    }
  ],
  "total_candidates": 1,
  "filters_applied": { "gender": true, "height": true, ... }
}
```

**What to verify:**
- `match_score` reflects matched attributes (gender=15, height=8, build=8, skin_tone=10, hair_color=10, hair_length=5, facial_hair=7 = 63 max)
- `matched_attributes` lists all matching fields
- No `clip_similarity` or `hybrid_score` fields (CLIP disabled)

---

## Test Case 4: Test Hybrid Search with CLIP (use_clip=true)

```powershell
Invoke-WebRequest -Uri "http://localhost:3000/api/missing-reports/search" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body '{"report_id":"YOUR_REPORT_UUID_HERE","use_clip":true,"limit":50}' `
  -UseBasicParsing | Select-Object -ExpandProperty Content
```

**Expected response:**
```json
{
  "success": true,
  "clip_enabled": true,
  "matches": [
    {
      "name": "Rahul Sharma",
      "match_score": 63,
      "clip_similarity": 0.25,
      "hybrid_score": 40.2,
      "matched_attributes": ["gender", "height", "build", ...],
      "match_confidence": 0.63
    }
  ],
  "total_candidates": 1
}
```

**What to verify:**
- `clip_enabled: true` is present in response
- Each match has a `clip_similarity` field (0.0–1.0)
- Each match has a `hybrid_score` = `(match_score * 0.4) + (clip_similarity * 60)`
- Results are sorted by `hybrid_score` descending

**Check CLIP service logs** (Terminal 1) for:
```
[CLIP] Ranking 1 candidates with description: "age 25-32, male, tall height, athletic build, medium skin, short black hair, scar on left cheek, wearing glasses"
[CLIP] Ranked candidates. Top 3 similarities: 0.XXX
```

---

## Test Case 5: Test Graceful Degradation (CLIP service down)

1. **Stop the CLIP service** (Ctrl+C in Terminal 1)
2. Run the hybrid search again:

```powershell
Invoke-WebRequest -Uri "http://localhost:3000/api/missing-reports/search" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body '{"report_id":"YOUR_REPORT_UUID_HERE","use_clip":true,"limit":50}' `
  -UseBasicParsing | Select-Object -ExpandProperty Content
```

**Expected response:** Same as attribute-only search — results returned without `clip_similarity`, no error thrown.

**Check Next.js logs** (Terminal 2) for:
```
[CLIP] Ranking failed: fetch failed
```

3. **Restart the CLIP service** when done.

---

## Test Case 6: Verify Hybrid Score Formula

With results from Test Case 4, manually verify the formula:

```
hybrid_score = (match_score * 0.4) + (clip_similarity * 60)
```

Example:
- `match_score = 63`, `clip_similarity = 0.25`
- Expected: `(63 * 0.4) + (0.25 * 60) = 25.2 + 15 = 40.2`

---

## Test Case 7: CLIP Service Direct Test

Test the CLIP service independently:

```powershell
Invoke-WebRequest -Uri "http://localhost:5001/clip-rank" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body '{"description":"age 25-32, male, tall height, athletic build, medium skin, short black hair, scar on left cheek, wearing glasses","candidates":[{"id":"test-1","name":"Rahul Sharma","image_url":"https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400","match_score":63}]}' `
  -UseBasicParsing | Select-Object -ExpandProperty Content
```

**Expected response:**
```json
[
  {
    "id": "test-1",
    "name": "Rahul Sharma",
    "clip_similarity": 0.XXXX,
    "match_score": 63
  }
]
```

---

## Scoring Reference

| Attribute | Points |
|-----------|--------|
| Gender match | 15 |
| Skin tone match | 10 |
| Hair color match | 10 |
| Height match | 8 |
| Build match | 8 |
| Facial hair match | 7 |
| Hair length match | 5 |
| Distinguishing marks (per keyword) | 5 |

**Hybrid formula:** `(attribute_score * 0.4) + (clip_similarity * 60)`
- Max attribute contribution: 40 points
- Max CLIP contribution: 60 points
- Max hybrid score: 100

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| `Could not find 'age' column` | Run the migration SQL in Supabase SQL Editor |
| `CLIP service returned 500` | Check Terminal 1 for Python errors |
| `fetch failed` on CLIP | CLIP service not running — start it in Terminal 1 |
| `Report not found` | Wrong report UUID — check Supabase `missing_reports` table |
| `clip_similarity` missing from response | CLIP failed silently — check Next.js logs in Terminal 2 |
