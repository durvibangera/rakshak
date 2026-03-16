# Quick Start: Hybrid Search System

## 🚀 Get Started in 5 Minutes

### Step 1: Run Database Migration (2 min)

1. Open Supabase Dashboard
2. Go to SQL Editor
3. Copy contents of `rakshak/db/migrations/add_structured_fields.sql`
4. Paste and run
5. Verify: Check that `missing_reports` and `users` tables have new columns

### Step 2: Restart Dev Server (1 min)

```bash
cd rakshak
npm run dev
```

### Step 3: Test Missing Report Form (2 min)

1. Go to http://localhost:3000/report-missing
2. Fill out reporter info
3. Notice new "Physical Attributes" section
4. Fill some fields (all optional)
5. Submit report
6. ✅ Success!

## 🧪 Quick Test

Open browser console and run:

```javascript
// Test the search API
fetch('/api/missing-reports/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    report_id: 'YOUR_REPORT_ID',
    use_clip: false,
    limit: 50
  })
})
.then(r => r.json())
.then(console.log);
```

## 📚 Full Documentation

- **Overview:** `HYBRID_SEARCH_IMPLEMENTATION.md`
- **Testing:** `TEST_HYBRID_SEARCH.md`
- **Summary:** `IMPLEMENTATION_SUMMARY.md`
- **Phase 3:** `PHASE_3_REGISTRATION_UPDATE.md`

## ✅ What's Working

- ✅ Database schema updated
- ✅ Missing report form with structured fields
- ✅ Search API with SQL filtering
- ✅ Match scoring system
- ✅ All backward compatible

## ⏳ What's Next

- Phase 3: Update registration forms
- Phase 5: Add CLIP integration
- Phase 6: Build admin review UI

## 🐛 Issues?

Check `TEST_HYBRID_SEARCH.md` for troubleshooting.
