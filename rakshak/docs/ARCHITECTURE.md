# Hybrid Search Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    MISSING PERSON REPORT                     │
│  Reporter provides: name, photo, age, gender, physical      │
│  attributes, distinguishing marks, clothing, accessories    │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│              POST /api/missing-reports                       │
│  • Validates at least one identifying field                 │
│  • Extracts face embedding (if photo provided)              │
│  • Stores structured attributes in database                 │
│  • Triggers auto-match against existing victims             │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│         POST /api/missing-reports/search                     │
│                                                              │
│  STAGE 1: SQL FILTERING (< 100ms)                           │
│  ┌────────────────────────────────────────────────┐         │
│  │ SELECT * FROM users WHERE                      │         │
│  │   age BETWEEN 25 AND 35                        │         │
│  │   AND gender = 'Male'                          │         │
│  │   AND height = 'tall'                          │         │
│  │   AND hair_color = 'black'                     │         │
│  │   AND skin_tone = 'fair'                       │         │
│  │ LIMIT 50                                       │         │
│  └────────────────────────────────────────────────┘         │
│                    ↓                                         │
│              10,000 victims → 50 candidates                  │
│                                                              │
│  STAGE 2: SCORE CALCULATION (< 50ms)                        │
│  ┌────────────────────────────────────────────────┐         │
│  │ For each candidate:                            │         │
│  │   score = 0                                    │         │
│  │   if gender matches: score += 15               │         │
│  │   if age in range: score += 10                 │         │
│  │   if skin_tone matches: score += 10            │         │
│  │   if hair_color matches: score += 10           │         │
│  │   if height matches: score += 8                │         │
│  │   if build matches: score += 8                 │         │
│  │   if facial_hair matches: score += 7           │         │
│  │   if hair_length matches: score += 5           │         │
│  │   if marks match (keywords): score += 5 each   │         │
│  │                                                 │         │
│  │ Sort by score descending                       │         │
│  └────────────────────────────────────────────────┘         │
│                    ↓                                         │
│              50 candidates → Top 10 matches                  │
│                                                              │
│  STAGE 3: CLIP RANKING (< 2s) [Phase 5]                     │
│  ┌────────────────────────────────────────────────┐         │
│  │ Build text description from attributes         │         │
│  │ Encode with CLIP text encoder                  │         │
│  │ Encode candidate face images with CLIP         │         │
│  │ Calculate cosine similarity                    │         │
│  │ Re-rank by CLIP similarity                     │         │
│  └────────────────────────────────────────────────┘         │
│                    ↓                                         │
│              Top 10 → CLIP-ranked Top 10                     │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│              ADMIN REVIEW UI [Phase 6]                       │
│  • Shows missing report details                             │
│  • Displays top 10 matches with photos                      │
│  • Shows confidence scores & matched attributes             │
│  • Admin confirms/rejects match                             │
│  • System sends notification to reporter                    │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Missing Report Submission

```
User Input                    Database
─────────────────────────────────────────────────
Name: "Raj"                → name: "Raj"
Age Range: 25-30           → age_min: 25, age_max: 30
Gender: Male               → gender: "Male"
Height: Tall               → height: "tall"
Build: Average             → build: "average"
Skin Tone: Fair            → skin_tone: "fair"
Hair: Black, Short         → hair_color: "black", hair_length: "short"
Facial Hair: Beard         → facial_hair: "beard"
Marks: "scar on cheek"     → distinguishing_marks: "scar on cheek"
Clothing: "blue shirt"     → clothing_description: "blue shirt"
Accessories: "glasses"     → accessories: "glasses"
Photo: [base64]            → photo_url: "https://...", face_encoding: [512-dim]
```

### 2. Victim Registration

```
User Input                    Database
─────────────────────────────────────────────────
Name: "Raj Kumar"          → name: "Raj Kumar"
Age: 28                    → age: 28
Gender: Male               → gender: "Male"
Height: Tall               → height: "tall"
Build: Average             → build: "average"
Skin Tone: Fair            → skin_tone: "fair"
Hair: Black, Short         → hair_color: "black", hair_length: "short"
Facial Hair: Beard         → facial_hair: "beard"
Marks: "scar left cheek"   → distinguishing_marks: "scar left cheek"
Accessories: "glasses"     → accessories: "glasses"
Selfie: [base64]           → selfie_url: "https://...", face_encoding: [512-dim]
```

### 3. Matching Process

```
Missing Report              Victim Profile           Match Score
─────────────────────────────────────────────────────────────────
age_min: 25, age_max: 30 ✓ age: 28                  +10 (in range)
gender: "Male"           ✓ gender: "Male"           +15 (exact)
height: "tall"           ✓ height: "tall"           +8  (exact)
build: "average"         ✓ build: "average"         +8  (exact)
skin_tone: "fair"        ✓ skin_tone: "fair"        +10 (exact)
hair_color: "black"      ✓ hair_color: "black"      +10 (exact)
hair_length: "short"     ✓ hair_length: "short"     +5  (exact)
facial_hair: "beard"     ✓ facial_hair: "beard"     +7  (exact)
marks: "scar on cheek"   ✓ marks: "scar left cheek" +5  (keyword: "scar")
                                                     ────────────
                                                     Total: 78/100
                                                     Confidence: 0.78
```

## Database Schema

### missing_reports Table

```sql
CREATE TABLE missing_reports (
  id UUID PRIMARY KEY,
  reported_by UUID,
  name VARCHAR(255),              -- Optional now
  photo_url TEXT,
  face_encoding FLOAT[],
  age INTEGER,                    -- Deprecated, use age_min/age_max
  age_min INTEGER,                -- NEW
  age_max INTEGER,                -- NEW
  gender VARCHAR(20),
  relationship VARCHAR(50),
  last_known_location TEXT,
  last_known_lat FLOAT,
  last_known_lng FLOAT,
  identifying_details TEXT,
  phone_of_missing VARCHAR(20),
  
  -- NEW: Structured attributes
  height VARCHAR(20),             -- short, average, tall
  build VARCHAR(20),              -- slim, average, heavy, athletic
  skin_tone VARCHAR(20),          -- fair, medium, dark
  hair_color VARCHAR(50),         -- black, brown, blonde, red, gray, white, dyed
  hair_length VARCHAR(20),        -- bald, short, medium, long
  facial_hair VARCHAR(50),        -- clean_shaven, beard, mustache, goatee, stubble
  distinguishing_marks TEXT,      -- scars, tattoos, birthmarks
  clothing_description TEXT,      -- last known clothing
  accessories TEXT,               -- glasses, jewelry, watch
  
  status VARCHAR(20),
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### users Table

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  name VARCHAR(255),
  phone VARCHAR(20),
  age INTEGER,
  gender VARCHAR(20),
  selfie_url TEXT,
  face_encoding FLOAT[],
  
  -- NEW: Structured attributes
  height VARCHAR(20),
  build VARCHAR(20),
  skin_tone VARCHAR(20),
  hair_color VARCHAR(50),
  hair_length VARCHAR(20),
  facial_hair VARCHAR(50),
  distinguishing_marks TEXT,
  last_known_clothing TEXT,
  accessories TEXT,
  
  -- Other fields...
  blood_group VARCHAR(10),
  medical_conditions TEXT,
  assigned_camp_id UUID,
  created_at TIMESTAMP
);
```

## API Endpoints

### POST /api/missing-reports
**Purpose:** File a new missing person report

**Request:**
```json
{
  "reported_by": "uuid",
  "name": "Raj",
  "photo": "data:image/jpeg;base64,...",
  "age_min": 25,
  "age_max": 30,
  "gender": "Male",
  "height": "tall",
  "build": "average",
  "skin_tone": "fair",
  "hair_color": "black",
  "hair_length": "short",
  "facial_hair": "beard",
  "distinguishing_marks": "scar on left cheek",
  "clothing_description": "blue shirt, black jeans",
  "accessories": "glasses, silver watch",
  "phone_of_missing": "9876543210",
  "last_known_location": "Mumbai Central"
}
```

**Response:**
```json
{
  "success": true,
  "report": { "id": "uuid", ... },
  "autoMatch": {
    "type": "registered_user",
    "confidence": 0.85,
    "matched_camp_name": "Relief Camp A",
    "matched_user": { "id": "uuid", "name": "Raj Kumar" }
  }
}
```

### POST /api/missing-reports/search
**Purpose:** Search for matches to a missing report

**Request:**
```json
{
  "report_id": "uuid",
  "use_clip": false,
  "limit": 50
}
```

**Response:**
```json
{
  "success": true,
  "report": {
    "id": "uuid",
    "name": "Raj",
    "age_range": "25-30",
    "gender": "Male"
  },
  "matches": [
    {
      "id": "user-uuid",
      "name": "Raj Kumar",
      "age": 28,
      "gender": "Male",
      "height": "tall",
      "selfie_url": "https://...",
      "match_score": 78,
      "match_confidence": 0.78,
      "matched_attributes": [
        "age", "gender", "height", "build",
        "skin_tone", "hair_color", "hair_length",
        "facial_hair", "distinguishing_marks"
      ]
    }
  ],
  "total_candidates": 47,
  "filters_applied": {
    "age_range": true,
    "gender": true,
    "height": true,
    "build": true,
    "skin_tone": true,
    "hair_color": true,
    "hair_length": true,
    "facial_hair": true
  }
}
```

## Performance Characteristics

### SQL Filtering
- **Input:** 10,000 victims
- **Output:** 50 candidates
- **Time:** < 100ms
- **Method:** Indexed WHERE clauses

### Score Calculation
- **Input:** 50 candidates
- **Output:** Top 10 matches
- **Time:** < 50ms
- **Method:** In-memory scoring

### CLIP Ranking (Phase 5)
- **Input:** 50 candidates
- **Output:** Top 10 re-ranked
- **Time:** < 2s
- **Method:** GPU-accelerated neural network

### Total Search Time
- **Without CLIP:** < 200ms
- **With CLIP:** < 3s

## Scalability

### Current Capacity
- 10,000 victims: < 200ms
- 100,000 victims: < 500ms (with proper indexes)
- 1,000,000 victims: < 2s (may need sharding)

### Optimization Strategies
1. Database indexes on all filter columns
2. Limit candidate set to 50 before CLIP
3. Cache CLIP embeddings for victims
4. Use read replicas for search queries
5. Implement pagination for large result sets

## Security Considerations

1. **PII Protection:** All personal data encrypted at rest
2. **Access Control:** Only authorized admins can search
3. **Rate Limiting:** Prevent abuse of search API
4. **Audit Logging:** Track all searches and matches
5. **Data Retention:** Auto-delete old reports after 90 days
