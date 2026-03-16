# Phase 3: Update Victim Registration Forms

## Overview
Add structured physical attribute fields to victim registration so they can be matched against missing person reports.

## Files to Update

### 1. `/app/register/page.js` (Public Registration)

**Add state variables after line 40:**
```javascript
// Structured attributes for matching
const [height, setHeight] = useState('');
const [build, setBuild] = useState('');
const [skinTone, setSkinTone] = useState('');
const [hairColor, setHairColor] = useState('');
const [hairLength, setHairLength] = useState('');
const [facialHair, setFacialHair] = useState('');
const [distinguishingMarks, setDistinguishingMarks] = useState('');
const [accessories, setAccessories] = useState('');
```

**Add constants after line 18:**
```javascript
const HEIGHT_OPTIONS = ['Short', 'Average', 'Tall'];
const BUILD_OPTIONS = ['Slim', 'Average', 'Heavy', 'Athletic'];
const SKIN_TONE_OPTIONS = ['Fair', 'Medium', 'Dark'];
const HAIR_COLOR_OPTIONS = ['Black', 'Brown', 'Blonde', 'Red', 'Gray', 'White', 'Dyed', 'Other'];
const HAIR_LENGTH_OPTIONS = ['Bald', 'Short', 'Medium', 'Long'];
const FACIAL_HAIR_OPTIONS = ['Clean Shaven', 'Beard', 'Mustache', 'Goatee', 'Stubble'];
```

**Add form fields in Step 2 (Medical section):**
```javascript
<div style={s.sectionDivider}>
  <h3 style={s.subsectionTitle}>Physical Attributes (for matching)</h3>
</div>

<div style={s.row}>
  <div style={s.halfField}>
    <label style={s.label}>Height</label>
    <select value={height} onChange={e => setHeight(e.target.value)} style={s.input}>
      <option value="">Select</option>
      {HEIGHT_OPTIONS.map(h => <option key={h} value={h.toLowerCase()}>{h}</option>)}
    </select>
  </div>
  <div style={s.halfField}>
    <label style={s.label}>Build</label>
    <select value={build} onChange={e => setBuild(e.target.value)} style={s.input}>
      <option value="">Select</option>
      {BUILD_OPTIONS.map(b => <option key={b} value={b.toLowerCase()}>{b}</option>)}
    </select>
  </div>
</div>

<div style={s.row}>
  <div style={s.halfField}>
    <label style={s.label}>Skin Tone</label>
    <select value={skinTone} onChange={e => setSkinTone(e.target.value)} style={s.input}>
      <option value="">Select</option>
      {SKIN_TONE_OPTIONS.map(st => <option key={st} value={st.toLowerCase()}>{st}</option>)}
    </select>
  </div>
  <div style={s.halfField}>
    <label style={s.label}>Hair Color</label>
    <select value={hairColor} onChange={e => setHairColor(e.target.value)} style={s.input}>
      <option value="">Select</option>
      {HAIR_COLOR_OPTIONS.map(hc => <option key={hc} value={hc.toLowerCase()}>{hc}</option>)}
    </select>
  </div>
</div>

<div style={s.row}>
  <div style={s.halfField}>
    <label style={s.label}>Hair Length</label>
    <select value={hairLength} onChange={e => setHairLength(e.target.value)} style={s.input}>
      <option value="">Select</option>
      {HAIR_LENGTH_OPTIONS.map(hl => <option key={hl} value={hl.toLowerCase()}>{hl}</option>)}
    </select>
  </div>
  <div style={s.halfField}>
    <label style={s.label}>Facial Hair</label>
    <select value={facialHair} onChange={e => setFacialHair(e.target.value)} style={s.input}>
      <option value="">Select</option>
      {FACIAL_HAIR_OPTIONS.map(fh => <option key={fh} value={fh.toLowerCase()}>{fh}</option>)}
    </select>
  </div>
</div>

<label style={s.label}>Distinguishing Marks</label>
<textarea
  value={distinguishingMarks}
  onChange={e => setDistinguishingMarks(e.target.value)}
  placeholder="Scars, tattoos, birthmarks, moles..."
  rows={2}
  style={{ ...s.input, resize: 'vertical' }}
/>

<label style={s.label}>Accessories</label>
<input
  type="text"
  value={accessories}
  onChange={e => setAccessories(e.target.value)}
  placeholder="Glasses, jewelry, watch..."
  style={s.input}
/>
```

**Update registration payload (around line 120):**
```javascript
const userData = {
  name: name.trim(),
  phone: fullPhone,
  address: address.trim() || null,
  state: state || null,
  blood_group: bloodGroup || null,
  medical_conditions: medicalConditions.trim() || null,
  current_medications: currentMedications.trim() || null,
  disability_status: disabilityStatus.trim() || null,
  emergency_contact_name: emergencyContactName.trim() || null,
  emergency_contact_phone: emergencyContactPhone.trim() || null,
  qr_code_id: generatedQrId,
  selfie_url: selfieUrl,
  registration_type: 'self',
  consent_given: true,
  consent_timestamp: new Date().toISOString(),
  // Structured attributes
  height: height || null,
  build: build || null,
  skin_tone: skinTone || null,
  hair_color: hairColor || null,
  hair_length: hairLength || null,
  facial_hair: facialHair || null,
  distinguishing_marks: distinguishingMarks.trim() || null,
  accessories: accessories.trim() || null,
};
```

### 2. `/app/camp/register/page.js` (Camp Registration)

Apply the same changes as above to the camp registration form.

**Key differences:**
- Camp registration is done by operators on behalf of victims
- May need to add a note: "These details help match with missing person reports"
- Same field structure and validation

### 3. `/app/api/victims/route.js` (API)

The API should already accept these fields since we updated the database schema. Verify the POST handler accepts:
- height
- build
- skin_tone
- hair_color
- hair_length
- facial_hair
- distinguishing_marks
- accessories

## Testing Checklist

- [ ] Run database migration in Supabase
- [ ] Test public registration with new fields
- [ ] Test camp registration with new fields
- [ ] Verify data is saved to database
- [ ] Test missing report search API with structured filters
- [ ] Verify matches are returned correctly

## Notes

- All new fields are optional (don't break existing flow)
- Fields improve matching accuracy but aren't required
- UI should clearly indicate these help with family reunification
- Consider adding tooltips explaining why these fields matter
