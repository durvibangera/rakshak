# Hybrid Missing Person Search - Implementation Summary

## Overview

Implemented a two-stage hybrid search system for matching missing person reports with registered victims using:
1. **Structured attribute filtering** (SQL) - Narrows 10,000+ victims to ~50 candidates
2. **CLIP-based ranking** (Phase 5) - Ranks candidates by visual-text similarity

## What's Been Implemented

### ✅ Phase 1: Database Schema (COMPLETE)

**File:** `rakshak/db/migrations/add_structured_fields.sql`

Added structured fields to both `missing_reports` and `users` tables:
- Age range (min/max)
- Height (short/average/tall)
- Build (slim/average/heavy/athletic)
- Skin tone (fair/medium/dark)
- Hair color & length
- Facial hair
- Distinguishing marks
- Clothing description
- Accessories

**To apply:** Run the SQL migration in Supabase SQL Editor

### ✅ Phase 2: Missing Report Form (COMPLETE)

**File:** `rakshak/app/report-missing/page.js`

Updated the missing person report form to collect:
- All structured attributes via dropdowns
- Age range instead of single age
- Separate fields for distinguishing marks, clothing, accessories
- Improved validation (at least one identifying field required)

**Changes:**
- Added 11 new state variables
- Added 6 dropdown constant arrays
- Added new form section with 15+ fields
- Updated submit payload to include all new fields
- Added section divider styling

### ✅ Phase 3: Registration Forms (DOCUMENTED)

**File:** `rakshak/docs/PHASE_3_REGISTRATION_UPDATE.md`

Documented how to update:
- `/app/register/page.js` (public registration)
- `/app/camp/register/page.js` (camp registration)

**Status:** Documentation complete, implementation pending

### ✅ Phase 4: Hybrid Search API (COMPLETE)

**File:** `rakshak/app/api/missing-reports/search/route.js`

Created new search endpoint:
```
POST /api/missing-reports/search
Body: {
  report_id: "uuid",
  use_clip: false,
  limit: 50
}
```

**Features:**
- Fetches missing report by ID
- Builds dynamic SQL query with filters
- Applies age range, gender, height, build, skin tone, hair filters
- Calculates match scores based on attribute overlap
- Returns top 10 matches with confidence scores
- Placeholder for CLIP ranking (Phase 5)

**Scoring system:**
- Gender match: +15 points
- Age in range: +10 points
- Skin tone match: +10 points
- Hair color match: +10 points
- Height match: +8 points
- Build match: +8 points
- Facial hair match: +7 points
- Hair length match: +5 points
- Distinguishing marks (keyword): +5 per keyword

### ✅ Phase 4: API Updates (COMPLETE)

**File:** `rakshak/app/api/missing-reports/route.js`

Updated POST handler to:
- Accept all 11 new structured fields
- Store them in database
- Validate at least one identifying field is provided

## How It Works

### 1. Reporter Files Missing Report

```
User fills form:
├─ Basic info: name (optional), age range, gender
├─ Physical attributes: height, build, skin tone, hair
├─ Distinguishing marks: scars, tattoos, birthmarks
├─ Clothing & accessories
└─ Photo (optional)
```

### 2. System Searches for Matches

```
POST /api/missing-reports/search
├─ Stage 1: SQL Filter
│   ├─ WHERE age BETWEEN 25 AND 35
│   ├─ AND gender = 'Male'
│   ├─ AND height = 'tall'
│   ├─ AND hair_color = 'black'
│   └─ Result: 10,000 → 50 candidates
│
├─ Stage 2: Score Calculation
│   ├─ Match each attribute
│   ├─ Calculate confidence score
│   └─ Sort by score descending
│
└─ Stage 3: CLIP Ranking (Phase 5)
    ├─ Build text description
    ├─ Encode with CLIP
    ├─ Compare to face images
    └─ Return top 10 matches
```

### 3. Admin Reviews Matches

```
Admin UI (Phase 6):
├─ Shows missing report details
├─ Displays top 10 matches with photos
├─ Shows confidence scores & matched attributes
├─ Admin confirms/rejects match
└─ System notifies reporter
```

## API Usage Examples

### Search for matches

```javascript
const response = await fetch('/api/missing-reports/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    report_id: 'abc-123-def',
    use_clip: false,
    limit: 50
  })
});

const data = await response.json();
// {
//   success: true,
//   report: { id, name, age_range, gender },
//   matches: [
//     {
//       id, name, age, gender, height, selfie_url,
//       match_score: 73,
//       match_confidence: 0.73,
//       matched_attributes: ['gender', 'age', 'height', 'hair_color']
//     },
//     ...
//   ],
//   total_candidates: 47,
//   filters_applied: { age_range: true, gender: true, ... }
// }
```

### File missing report with structured data

```javascript
const response = await fetch('/api/missing-reports', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    reported_by: 'user-uuid',
    name: 'John Doe',
    age_min: 25,
    age_max: 35,
    gender: 'Male',
    height: 'tall',
    build: 'average',
    skin_tone: 'fair',
    hair_color: 'black',
    hair_length: 'short',
    facial_hair: 'beard',
    distinguishing_marks: 'scar on left cheek, tattoo on right arm',
    clothing_description: 'blue shirt, black jeans',
    accessories: 'glasses, silver watch',
    photo: 'data:image/jpeg;base64,...'
  })
});
```

## Next Steps

### Phase 5: CLIP Integration (2-3 days)

**Files to create:**
- `rakshak/lib/ai/clipMatching.js` - Next.js integration
- `face_recognition_module/clip_service.py` - Python CLIP service
- Update `face_recognition_module/requirements.txt`

**Tasks:**
1. Install transformers + torch
2. Load CLIP model (openai/clip-vit-base-patch32)
3. Create `/clip-rank` endpoint
4. Build description from report fields
5. Encode text + images
6. Calculate cosine similarity
7. Return ranked results

### Phase 6: Admin Review UI (2 days)

**Files to create:**
- `rakshak/app/admin/missing-matches/page.js`
- `rakshak/app/admin/missing-matches/[id]/page.js`

**Features:**
- List all missing reports with match counts
- View top 10 matches for each report
- Side-by-side comparison (report photo vs candidate photo)
- Confirm/reject match buttons
- Send SMS notification to reporter
- Update report status to 'reunited'

### Phase 7: Testing (2 days)

**Test cases:**
1. Report with only age + gender → Many candidates
2. Report with age + gender + height + hair → ~50 candidates
3. Report with detailed description + CLIP → Top 10 accurate
4. Report with photo → Face recognition (existing flow)
5. Edge cases: No matches, multiple perfect matches

### Phase 8: Deployment (1 day)

1. Run database migration in production
2. Deploy updated Next.js app
3. Deploy Python CLIP service
4. Update environment variables
5. Monitor performance & accuracy

## Performance Benchmarks

**Target metrics:**
- SQL filter: < 100ms
- Score calculation: < 50ms
- CLIP ranking (50 candidates): < 2s
- Total search time: < 3s

**Accuracy goals:**
- Recall: 90%+ (actual match in top 10)
- Precision: 70%+ (top 10 contains correct match)
- False positive rate: < 10%

## Database Indexes

Already created in migration:
```sql
CREATE INDEX idx_users_age ON users(age);
CREATE INDEX idx_users_gender ON users(gender);
CREATE INDEX idx_users_height ON users(height);
CREATE INDEX idx_users_build ON users(build);
CREATE INDEX idx_users_skin_tone ON users(skin_tone);
CREATE INDEX idx_users_hair_color ON users(hair_color);
```

## Configuration

Add to `.env`:
```bash
# CLIP Integration (Phase 5)
FACE_SERVICE_URL=http://localhost:5001
CLIP_ENABLED=true
CLIP_MODEL=openai/clip-vit-base-patch32
```

## Notes

- All structured fields are optional (backward compatible)
- Existing face recognition still works (higher priority)
- Phone number matching still works (second priority)
- Structured search is fallback when photo/phone unavailable
- CLIP adds ranking layer on top of SQL filtering
- Manual review by staff is final verification step

## Questions?

See individual phase documentation:
- Phase 1-2: This file
- Phase 3: `PHASE_3_REGISTRATION_UPDATE.md`
- Phase 5: TBD (CLIP integration guide)
- Phase 6: TBD (Admin UI guide)
