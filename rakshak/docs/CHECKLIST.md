# Deployment Checklist

## Phase 1-4: Complete ✅

- [x] Database migration created
- [x] Missing report form updated
- [x] API endpoints updated
- [x] Search API created
- [x] Documentation written

## Before Testing

- [ ] Run database migration in Supabase
- [ ] Restart Next.js dev server
- [ ] Clear browser cache

## Testing

- [ ] File missing report with structured fields
- [ ] Register victim with structured fields
- [ ] Test search API
- [ ] Verify match scores
- [ ] Check performance (< 3s)

## Phase 3: Registration Forms

- [ ] Update `/app/register/page.js`
- [ ] Update `/app/camp/register/page.js`
- [ ] Test registration flow
- [ ] Verify data saved correctly

## Phase 5: CLIP Integration

- [ ] Install Python dependencies
- [ ] Create CLIP service endpoint
- [ ] Test CLIP ranking
- [ ] Measure accuracy improvement

## Phase 6: Admin UI

- [ ] Build match review page
- [ ] Add confirm/reject buttons
- [ ] Implement notifications
- [ ] Test end-to-end flow

## Production Deployment

- [ ] Run migration in production DB
- [ ] Deploy Next.js app
- [ ] Deploy Python service
- [ ] Update environment variables
- [ ] Monitor performance
- [ ] Collect user feedback
