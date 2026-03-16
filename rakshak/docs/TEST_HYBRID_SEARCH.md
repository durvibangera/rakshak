# Testing Hybrid Search System

## Prerequisites

1. Run database migration:
```sql
-- In Supabase SQL Editor, run:
-- rakshak/db/migrations/add_structured_fields.sql
```

2. Restart Next.js dev server:
```bash
cd rakshak
npm run dev
```

## Test Flow

### Step 1: Register a Test Victim

Go to `/register` and fill out:
- Name: "Raj Kumar"
- Phone: 9876543210
- Age: 28
- Gender: Male
- Height: Tall
- Build: Average
- Skin Tone: Fair
- Hair Color: Black
- Hair Length: Short
- Facial Hair: Beard
- Distinguishing Marks: "Scar on left cheek"
- Take selfie
- Submit

**Expected:** Registration successful, QR code displayed

### Step 2: File Missing Report

Go to `/report-missing` and fill out:
- Reporter Phone: 9999999999
- Missing Person Name: "Raj" (partial match)
- Age Range: 25-30
- Gender: Male
- Height: Tall
- Build: Average
- Skin Tone: Fair
- Hair Color: Black
- Hair Length: Short
- Facial Hair: Beard
- Distinguishing Marks: "scar on cheek"
- Submit

**Expected:** Report filed successfully, may show auto-match

### Step 3: Test Search API

Open browser console on any page and run:

```javascript
// Get the report ID from the previous step
const reportId = 'YOUR_REPORT_ID_HERE';

fetch('/api/missing-reports/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    report_id: reportId,
    use_clip: false,
    limit: 50
  })
})
.then(r => r.json())
.then(data => {
  console.log('Search Results:', data);
  console.log('Total Candidates:', data.total_candidates);
  console.log('Top Match:', data.matches[0]);
});
```

**Expected output:**
```json
{
  "success": true,
  "report": {
    "id": "abc-123",
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
      "match_score": 73,
      "match_confidence": 0.73,
      "matched_attributes": [
        "age", "gender", "height", "build", 
        "skin_tone", "hair_color", "hair_length", 
        "facial_hair", "distinguishing_marks"
      ]
    }
  ],
  "total_candidates": 1,
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

### Step 4: Test with Partial Matches

Register another victim with only some matching attributes:
- Name: "Amit Shah"
- Age: 27
- Gender: Male
- Height: Tall
- Build: Slim (different)
- Skin Tone: Medium (different)
- Hair Color: Black
- Hair Length: Long (different)

Then search again with the same report.

**Expected:** Both victims returned, but "Raj Kumar" has higher score

### Step 5: Test with No Matches

File a report with completely different attributes:
- Age Range: 50-60
- Gender: Female
- Height: Short

Search for this report.

**Expected:** Empty matches array or very low scores

## Validation Checklist

- [ ] Database migration applied successfully
- [ ] Missing report form shows new fields
- [ ] Registration form shows new fields (if Phase 3 implemented)
- [ ] Can submit report with only structured attributes (no photo)
- [ ] Search API returns results
- [ ] Match scores are calculated correctly
- [ ] Higher attribute overlap = higher score
- [ ] Filters are applied correctly
- [ ] No errors in console
- [ ] Response time < 3 seconds

## Common Issues

### Issue: "Column does not exist" error
**Solution:** Run the database migration in Supabase

### Issue: Search returns 0 matches
**Solution:** 
1. Check if victims have the structured fields populated
2. Try broader filters (remove some attributes)
3. Check database indexes are created

### Issue: Match scores are all 0
**Solution:** Verify the scoring logic in `/api/missing-reports/search/route.js`

### Issue: Slow response time
**Solution:** 
1. Check database indexes
2. Reduce limit parameter
3. Add more specific filters

## Next: Test CLIP Integration (Phase 5)

Once CLIP is implemented:

```javascript
fetch('/api/missing-reports/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    report_id: reportId,
    use_clip: true,  // Enable CLIP
    limit: 50
  })
})
.then(r => r.json())
.then(data => {
  console.log('CLIP-ranked results:', data);
  // Should show clip_similarity scores
});
```

## Performance Testing

Test with larger dataset:

```javascript
// Create 100 test victims with random attributes
for (let i = 0; i < 100; i++) {
  // Register victims via API
}

// Then search and measure time
const start = Date.now();
fetch('/api/missing-reports/search', { ... })
  .then(() => {
    const elapsed = Date.now() - start;
    console.log(`Search took ${elapsed}ms`);
  });
```

**Target:** < 3000ms for 100 candidates
