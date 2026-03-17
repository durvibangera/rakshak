// register page for da useres
'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useLocationTracker } from '@/hooks/useLocationTracker';
import { nanoid } from 'nanoid';
import CameraCapture from '@/components/common/CameraCapture';
import { QRCodeSVG } from 'qrcode.react';
import Link from 'next/link';

const FONT = '"DM Sans", "Instrument Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const STATES = [
  'Maharashtra', 'Gujarat', 'Karnataka', 'Tamil Nadu', 'Kerala',
  'Andhra Pradesh', 'Telangana', 'West Bengal', 'Rajasthan', 'Uttar Pradesh',
  'Madhya Pradesh', 'Bihar', 'Odisha', 'Assam', 'Himachal Pradesh',
  'Uttarakhand', 'Goa', 'Punjab', 'Haryana', 'Jharkhand',
];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const RELATIONSHIPS = ['Child', 'Spouse', 'Parent', 'Sibling', 'Other'];
const HEIGHT_OPTIONS = ['Short', 'Average', 'Tall'];
const BUILD_OPTIONS = ['Slim', 'Average', 'Heavy', 'Athletic'];
const SKIN_TONE_OPTIONS = ['Fair', 'Medium', 'Dark'];
const HAIR_COLOR_OPTIONS = ['Black', 'Brown', 'Blonde', 'Red', 'Gray', 'White', 'Dyed', 'Other'];
const HAIR_LENGTH_OPTIONS = ['Bald', 'Short', 'Medium', 'Long'];
const FACIAL_HAIR_OPTIONS = ['Clean Shaven', 'Beard', 'Mustache', 'Goatee', 'Stubble'];

const EMPTY_DEPENDENT = {
  name: '', age: '', gender: '', relationship: 'Child',
  height_cm: '', identifying_marks: '', blood_group: '',
  medical_conditions: '', photo: null, showCamera: false,
};

const STEPS = [
  { num: 1, label: 'Your Info' },
  { num: 2, label: 'Medical & Family' },
  { num: 3, label: 'Confirm' },
];

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [address, setAddress] = useState('');
  const [state, setState] = useState('Maharashtra');
  const [bloodGroup, setBloodGroup] = useState('');
  const [medicalConditions, setMedicalConditions] = useState('');
  const [currentMedications, setCurrentMedications] = useState('');
  const [disabilityStatus, setDisabilityStatus] = useState('');
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
  const [lat, setLat] = useState(null);
  const [lng, setLng] = useState(null);
  const [locationStatus, setLocationStatus] = useState('');
  const [selfie, setSelfie] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const [consent, setConsent] = useState(false);
  const [height, setHeight] = useState('');
  const [build, setBuild] = useState('');
  const [skinTone, setSkinTone] = useState('');
  const [hairColor, setHairColor] = useState('');
  const [hairLength, setHairLength] = useState('');
  const [facialHair, setFacialHair] = useState('');
  const [distinguishingMarks, setDistinguishingMarks] = useState('');
  const [accessories, setAccessories] = useState('');
  const [dependents, setDependents] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [registeredPhone, setRegisteredPhone] = useState('');
  const [step, setStep] = useState(1);

  const detectLocation = () => {
    if (!navigator.geolocation) { setLocationStatus('GPS not available'); return; }
    setLocationStatus('Detecting…');
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLat(pos.coords.latitude); setLng(pos.coords.longitude); setLocationStatus(`${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`); },
      () => setLocationStatus('Location access denied'),
      { timeout: 5000, maximumAge: 60000 }
    );
  };

  const addDependent = () => setDependents(prev => [...prev, { ...EMPTY_DEPENDENT }]);
  const updateDependent = (i, field, value) => setDependents(prev => prev.map((d, idx) => idx === i ? { ...d, [field]: value } : d));
  const removeDependent = (i) => setDependents(prev => prev.filter((_, idx) => idx !== i));

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) return setError('Enter your name');
    if (!phone.trim() || phone.replace(/\D/g, '').length < 10) return setError('Enter valid 10-digit phone number');
    if (!selfie) return setError('Please take a selfie for identification');
    if (!consent) return setError('Please give consent to proceed');
    setLoading(true);
    try {
      const fullPhone = phone.startsWith('+91') ? phone : `+91${phone.replace(/\D/g, '')}`;
      const generatedQrId = nanoid(12);
      const compressedSelfie = await compressImg(selfie, 480, 0.7);
      let selfie_url = null;
      const base64Data = compressedSelfie.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
      const fileName = `selfies/${fullPhone.replace('+', '')}.jpg`;
      const { error: uploadError } = await supabase.storage.from('sahaay').upload(fileName, buffer, { contentType: 'image/jpeg', upsert: true });
      if (!uploadError) { const { data: urlData } = supabase.storage.from('sahaay').getPublicUrl(fileName); selfie_url = urlData?.publicUrl; }
      let face_encoding = null;
      try {
        const embRes = await fetch('/api/face-embedding', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image_base64: compressedSelfie }) });
        const embData = await embRes.json();
        if (embData.success) face_encoding = embData.embedding;
      } catch {}
      const { data, error: dbError } = await supabase.from('users').upsert({
        name: name.trim(), phone: fullPhone, age: age ? parseInt(age) : null, gender: gender || null,
        address: address.trim() || null, state, lat, lng,
        selfie_url, face_encoding, blood_group: bloodGroup || null,
        medical_conditions: medicalConditions.trim() || null, current_medications: currentMedications.trim() || null,
        disability_status: disabilityStatus.trim() || null, emergency_contact_name: emergencyContactName.trim() || null,
        emergency_contact_phone: emergencyContactPhone.trim() || null, registration_type: 'self',
        qr_code_id: generatedQrId, role: 'verified_user', consent_given: true,
        consent_timestamp: new Date().toISOString(), updated_at: new Date().toISOString(),
        height: height || null, build: build || null, skin_tone: skinTone || null,
        hair_color: hairColor || null, hair_length: hairLength || null, facial_hair: facialHair || null,
        distinguishing_marks: distinguishingMarks.trim() || null, accessories: accessories.trim() || null,
      }, { onConflict: 'phone' }).select().single();
      if (dbError) throw dbError;
      if (dependents.length > 0 && data?.id) {
        for (const dep of dependents) {
          if (!dep.name?.trim()) continue;
          let depPhoto = dep.photo ? await compressImg(dep.photo, 320, 0.6) : null;
          try {
            await fetch('/api/dependents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ parent_user_id: data.id, name: dep.name.trim(), relationship: dep.relationship || 'Other', age: dep.age ? parseInt(dep.age) : null, gender: dep.gender || null, height_cm: dep.height_cm ? parseInt(dep.height_cm) : null, identifying_marks: dep.identifying_marks || null, blood_group: dep.blood_group || null, medical_conditions: dep.medical_conditions || null, photo_base64: depPhoto || null }) });
          } catch {}
        }
      }
      localStorage.setItem('sahaay_phone', fullPhone);
      setRegisteredPhone(fullPhone);
      setSuccess(true);
    } catch (err) { setError(err.message || 'Registration failed'); }
    setLoading(false);
  };

  const savedPhone = typeof window !== 'undefined' ? localStorage.getItem('sahaay_phone') : null;
  useLocationTracker(success ? registeredPhone : savedPhone);

  // ═══════════════════════════════════════════════
  // SUCCESS SCREEN
  // ═══════════════════════════════════════════════
  if (success) {
    return (
      <div style={s.page}>
        <div style={s.bgPattern} />
        <div style={s.successCard}>
          <div style={s.successCardStripe} />
          <div style={s.successCardBody}>
            <div style={s.successIconWrap}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <p style={s.successEyebrow}>Registration Complete</p>
            <h2 style={s.successHeading}>You&apos;re Protected, {name.split(' ')[0]}!</h2>
            <p style={s.successSubtext}>
              You&apos;ll receive automated voice call alerts for disasters near you.
              {dependents.filter(d => d.name?.trim()).length > 0 && ` ${dependents.filter(d => d.name?.trim()).length} dependent(s) also registered.`}
            </p>

            <div style={s.qrSection}>
              <p style={s.qrEyebrow}>Your Emergency QR Identity Card</p>
              <p style={s.qrHint}>Screenshot this — works offline at any relief camp</p>
              <div style={s.qrBox}>
                <QRCodeSVG value={JSON.stringify({ phone: registeredPhone })} size={160} bgColor="#FFFFFF" fgColor="#0F172A" level="M" includeMargin={true} />
              </div>
              <p style={s.qrPhone}>{registeredPhone}</p>
              <div style={s.qrVerifiedBadge}>
                <div style={s.qrVerifiedDot} />
                Verified & Active
              </div>
            </div>

            <div style={s.successActions}>
              <Link href="/flood-prediction" style={s.successBtnPrimary}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/></svg>
                View Disaster Map
              </Link>
              <Link href="/user/dashboard" style={s.successBtnSecondary}>Go to Dashboard →</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════
  // REGISTRATION FORM
  // ═══════════════════════════════════════════════
  return (
    <div style={s.page}>
      <div style={s.bgPattern} />

      {/* Top bar */}
      <div style={s.topBar}>
        <div style={s.topBarBrand}>
          <img src="/logo-light.png" alt="Sahaay" style={{ height: 52, width: 'auto', objectFit: 'contain' }} />
        </div>
        <Link href="/" style={s.topBarBack}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
          </svg>
          Back to Home
        </Link>
      </div>

      <div style={s.card}>
        <div style={s.cardStripe} />
        <div style={s.cardBody}>

          {/* Header */}
          <div style={s.cardHeader}>
            <div style={s.logoWrap}>
              <img src="/logo-light.png" alt="Sahaay" style={{ height: 60, width: 'auto', objectFit: 'contain' }} />
            </div>
            <div>
              <p style={s.eyebrow}>Civilian Registration</p>
              <h1 style={s.heading}>Register for Sahaay</h1>
            </div>
          </div>
          <p style={s.subheading}>Pre-register for disaster alerts, QR identity card, and family reunification services.</p>

          {/* Step indicator */}
          <div style={s.stepBar}>
            {STEPS.map((st, i) => (
              <div key={st.num} style={s.stepItemWrap}>
                <div style={{ ...s.stepItem, ...(step >= st.num ? s.stepItemActive : {}), ...(step === st.num ? s.stepItemCurrent : {}) }}>
                  {step > st.num ? (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                  ) : st.num}
                </div>
                <span style={{ ...s.stepLabel, ...(step >= st.num ? s.stepLabelActive : {}) }}>{st.label}</span>
                {i < STEPS.length - 1 && <div style={{ ...s.stepLine, ...(step > st.num ? s.stepLineActive : {}) }} />}
              </div>
            ))}
          </div>

          <form onSubmit={handleRegister} style={s.form}>

            {/* ═══ STEP 1 ═══ */}
            {step === 1 && (
              <>
                <FieldBlock label="Selfie Photo" required hint="Used for AI-assisted family reunification">
                  {selfie ? (
                    <div style={s.selfiePreview}>
                      <img src={selfie} alt="Selfie" style={s.selfieImg} />
                      <button type="button" onClick={() => { setSelfie(null); setShowCamera(false); }} style={s.retakeBtn}>Retake</button>
                    </div>
                  ) : showCamera ? (
                    <CameraCapture onCapture={(data) => { setSelfie(data); setShowCamera(false); }} onClose={() => setShowCamera(false)} facingMode="user" label="Take Selfie" />
                  ) : (
                    <button type="button" onClick={() => setShowCamera(true)} style={s.cameraBtn}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                      Open Camera for Selfie
                    </button>
                  )}
                </FieldBlock>

                <div style={s.fieldRow}>
                  <FieldBlock label="Full Name" required style={{ flex: 1 }}>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" style={s.input} />
                  </FieldBlock>
                </div>

                <div style={s.twoCol}>
                  <FieldBlock label="Age">
                    <input type="number" value={age} onChange={(e) => setAge(e.target.value)} placeholder="Your age" min="1" max="120" style={s.input} />
                  </FieldBlock>
                  <FieldBlock label="Gender">
                    <select value={gender} onChange={(e) => setGender(e.target.value)} style={s.input}>
                      <option value="">Select</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </FieldBlock>
                </div>

                <FieldBlock label="Phone Number" required hint="This becomes your unique ID and QR card">
                  <div style={s.phoneRow}>
                    <div style={s.phonePrefix}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2A19.79 19.79 0 013.07 8.81 2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
                      <span style={s.phonePrefixText}>+91</span>
                    </div>
                    <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))} placeholder="9876543210" maxLength={10} style={s.phoneInput} />
                    {phone.replace(/\D/g, '').length === 10 && (
                      <div style={s.phoneCheck}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      </div>
                    )}
                  </div>
                </FieldBlock>

                <FieldBlock label="Home Address">
                  <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Your home address" style={s.input} />
                </FieldBlock>

                <div style={s.twoCol}>
                  <FieldBlock label="State" required>
                    <select value={state} onChange={(e) => setState(e.target.value)} style={s.input}>
                      {STATES.map(st => <option key={st} value={st}>{st}</option>)}
                    </select>
                  </FieldBlock>
                  <FieldBlock label="GPS Location">
                    <button type="button" onClick={detectLocation} style={s.locationBtn}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={lat ? '#059669' : '#9CA3AF'} strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
                      <span style={{ color: lat ? '#059669' : '#6B7280' }}>{locationStatus || 'Detect Location'}</span>
                    </button>
                  </FieldBlock>
                </div>

                {error && <ErrorBox message={error} />}
                <button type="button" onClick={() => {
                  if (!name.trim()) return setError('Enter your name');
                  if (!phone.trim() || phone.replace(/\D/g, '').length < 10) return setError('Enter valid phone number');
                  if (!selfie) return setError('Take a selfie first');
                  setError(''); setStep(2);
                }} style={s.btnPrimary}>
                  Next — Medical & Family
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              </>
            )}

            {/* ═══ STEP 2 ═══ */}
            {step === 2 && (
              <>
                <div style={s.twoCol}>
                  <FieldBlock label="Blood Group">
                    <select value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)} style={s.input}>
                      <option value="">Select</option>
                      {BLOOD_GROUPS.map(bg => <option key={bg} value={bg}>{bg}</option>)}
                    </select>
                  </FieldBlock>
                  <FieldBlock label="Disability">
                    <input type="text" value={disabilityStatus} onChange={(e) => setDisabilityStatus(e.target.value)} placeholder="None / details" style={s.input} />
                  </FieldBlock>
                </div>

                <FieldBlock label="Medical Conditions">
                  <input type="text" value={medicalConditions} onChange={(e) => setMedicalConditions(e.target.value)} placeholder="e.g. Diabetes, Heart condition" style={s.input} />
                </FieldBlock>

                <FieldBlock label="Current Medications">
                  <input type="text" value={currentMedications} onChange={(e) => setCurrentMedications(e.target.value)} placeholder="e.g. Metformin, Insulin" style={s.input} />
                </FieldBlock>

                {/* Emergency Contact */}
                <div style={s.subPanel}>
                  <p style={s.subPanelTitle}>Emergency Contact</p>
                  <p style={s.subPanelHint}>Someone outside the affected area who can be reached</p>
                  <div style={s.twoCol}>
                    <input type="text" value={emergencyContactName} onChange={(e) => setEmergencyContactName(e.target.value)} placeholder="Name" style={s.input} />
                    <input type="tel" value={emergencyContactPhone} onChange={(e) => setEmergencyContactPhone(e.target.value)} placeholder="Phone number" style={s.input} />
                  </div>
                </div>

                {/* Physical Attributes */}
                <div style={s.subPanel}>
                  <p style={s.subPanelTitle}>Physical Attributes</p>
                  <p style={s.subPanelHint}>Helps match you if your QR card isn&apos;t available</p>
                  <div style={s.twoCol}>
                    <FieldBlock label="Height">
                      <select value={height} onChange={e => setHeight(e.target.value)} style={s.inputSm}>
                        <option value="">Select</option>
                        {HEIGHT_OPTIONS.map(h => <option key={h} value={h.toLowerCase()}>{h}</option>)}
                      </select>
                    </FieldBlock>
                    <FieldBlock label="Build">
                      <select value={build} onChange={e => setBuild(e.target.value)} style={s.inputSm}>
                        <option value="">Select</option>
                        {BUILD_OPTIONS.map(b => <option key={b} value={b.toLowerCase()}>{b}</option>)}
                      </select>
                    </FieldBlock>
                  </div>
                  <div style={s.twoCol}>
                    <FieldBlock label="Skin Tone">
                      <select value={skinTone} onChange={e => setSkinTone(e.target.value)} style={s.inputSm}>
                        <option value="">Select</option>
                        {SKIN_TONE_OPTIONS.map(st => <option key={st} value={st.toLowerCase()}>{st}</option>)}
                      </select>
                    </FieldBlock>
                    <FieldBlock label="Hair Color">
                      <select value={hairColor} onChange={e => setHairColor(e.target.value)} style={s.inputSm}>
                        <option value="">Select</option>
                        {HAIR_COLOR_OPTIONS.map(h => <option key={h} value={h.toLowerCase()}>{h}</option>)}
                      </select>
                    </FieldBlock>
                  </div>
                  <div style={s.twoCol}>
                    <FieldBlock label="Hair Length">
                      <select value={hairLength} onChange={e => setHairLength(e.target.value)} style={s.inputSm}>
                        <option value="">Select</option>
                        {HAIR_LENGTH_OPTIONS.map(h => <option key={h} value={h.toLowerCase()}>{h}</option>)}
                      </select>
                    </FieldBlock>
                    <FieldBlock label="Facial Hair">
                      <select value={facialHair} onChange={e => setFacialHair(e.target.value)} style={s.inputSm}>
                        <option value="">Select</option>
                        {FACIAL_HAIR_OPTIONS.map(f => <option key={f} value={f.toLowerCase()}>{f}</option>)}
                      </select>
                    </FieldBlock>
                  </div>
                  <FieldBlock label="Distinguishing Marks">
                    <input type="text" value={distinguishingMarks} onChange={e => setDistinguishingMarks(e.target.value)} placeholder="Scars, tattoos, birthmarks…" style={s.inputSm} />
                  </FieldBlock>
                  <FieldBlock label="Accessories">
                    <input type="text" value={accessories} onChange={e => setAccessories(e.target.value)} placeholder="Glasses, jewellery, watch…" style={s.inputSm} />
                  </FieldBlock>
                </div>

                {/* Dependents */}
                <div style={s.subPanel}>
                  <div style={s.subPanelTopRow}>
                    <div>
                      <p style={s.subPanelTitle}>Family Members / Dependents</p>
                      <p style={s.subPanelHint}>Children, elderly, spouse — anyone who may need to be found</p>
                    </div>
                    <button type="button" onClick={addDependent} style={s.addDepBtn}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      Add
                    </button>
                  </div>

                  {dependents.map((dep, idx) => (
                    <div key={idx} style={s.depCard}>
                      <div style={s.depCardHeader}>
                        <span style={s.depCardLabel}>Dependent {idx + 1}</span>
                        <button type="button" onClick={() => removeDependent(idx)} style={s.depRemoveBtn}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          Remove
                        </button>
                      </div>

                      {dep.photo ? (
                        <div style={s.depPhotoPreview}>
                          <img src={dep.photo} alt="" style={s.depPhotoImg} />
                          <button type="button" onClick={() => updateDependent(idx, 'photo', null)} style={s.retakeBtn}>Retake</button>
                        </div>
                      ) : dep.showCamera ? (
                        <CameraCapture onCapture={(data) => { updateDependent(idx, 'photo', data); updateDependent(idx, 'showCamera', false); }} onClose={() => updateDependent(idx, 'showCamera', false)} facingMode="environment" label="Take Photo" />
                      ) : (
                        <button type="button" onClick={() => updateDependent(idx, 'showCamera', true)} style={{ ...s.cameraBtn, padding: '10px', fontSize: 13, marginBottom: 10 }}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                          Take Photo of Dependent
                        </button>
                      )}

                      <div style={s.twoCol}>
                        <input type="text" value={dep.name} onChange={e => updateDependent(idx, 'name', e.target.value)} placeholder="Full name *" style={s.inputSm} />
                        <select value={dep.relationship} onChange={e => updateDependent(idx, 'relationship', e.target.value)} style={s.inputSm}>
                          {RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </div>
                      <div style={{ ...s.twoCol, marginTop: 8 }}>
                        <input type="number" value={dep.age} onChange={e => updateDependent(idx, 'age', e.target.value)} placeholder="Age" style={s.inputSm} />
                        <select value={dep.gender} onChange={e => updateDependent(idx, 'gender', e.target.value)} style={s.inputSm}>
                          <option value="">Gender</option>
                          <option>Male</option><option>Female</option><option>Other</option>
                        </select>
                      </div>
                      <div style={{ marginTop: 8 }}>
                        <input type="text" value={dep.identifying_marks} onChange={e => updateDependent(idx, 'identifying_marks', e.target.value)} placeholder="Identifying marks (birthmarks, scars…)" style={s.inputSm} />
                      </div>
                      <div style={{ ...s.twoCol, marginTop: 8 }}>
                        <select value={dep.blood_group} onChange={e => updateDependent(idx, 'blood_group', e.target.value)} style={s.inputSm}>
                          <option value="">Blood Group</option>
                          {BLOOD_GROUPS.map(bg => <option key={bg}>{bg}</option>)}
                        </select>
                        <input type="text" value={dep.medical_conditions} onChange={e => updateDependent(idx, 'medical_conditions', e.target.value)} placeholder="Medical conditions" style={s.inputSm} />
                      </div>
                    </div>
                  ))}
                </div>

                {error && <ErrorBox message={error} />}
                <div style={s.btnRow}>
                  <button type="button" onClick={() => setStep(1)} style={s.btnBack}>← Back</button>
                  <button type="button" onClick={() => { setError(''); setStep(3); }} style={{ ...s.btnPrimary, flex: 1 }}>
                    Next — Confirm
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                </div>
              </>
            )}

            {/* ═══ STEP 3 ═══ */}
            {step === 3 && (
              <>
                {/* Summary card */}
                <div style={s.summaryCard}>
                  <p style={s.summaryTitle}>Registration Summary</p>
                  <div style={s.summaryPersonRow}>
                    {selfie && <img src={selfie} alt="" style={s.summaryPhoto} />}
                    <div>
                      <p style={s.summaryName}>{name}</p>
                      <p style={s.summaryMeta}>+91{phone} · {state}{age && ` · ${age} years`}{gender && ` · ${gender}`}</p>
                    </div>
                  </div>
                  <div style={s.summaryDetails}>
                    {bloodGroup && <SummaryRow label="Blood Group" value={bloodGroup} />}
                    {medicalConditions && <SummaryRow label="Medical" value={medicalConditions} />}
                    {emergencyContactName && <SummaryRow label="Emergency Contact" value={`${emergencyContactName} · ${emergencyContactPhone}`} />}
                    {lat && <SummaryRow label="Location" value={`${lat.toFixed(4)}, ${lng.toFixed(4)}`} />}
                    {dependents.filter(d => d.name?.trim()).length > 0 && (
                      <SummaryRow label="Dependents" value={dependents.filter(d => d.name?.trim()).map(d => d.name).join(', ')} highlight />
                    )}
                  </div>
                </div>

                {/* Consent */}
                <div style={{ ...s.consentCard, ...(consent ? s.consentCardActive : {}) }}>
                  <label style={s.consentLabel}>
                    <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={s.consentCheckbox} />
                    <span style={s.consentText}>
                      I consent to my photo, phone number, and personal details being stored and used for
                      <strong> disaster rescue and family reunification</strong> purposes. My photo may be matched
                      against missing person reports to help locate me or my dependents during emergencies.
                    </span>
                  </label>
                </div>

                {error && <ErrorBox message={error} />}

                <div style={s.btnRow}>
                  <button type="button" onClick={() => setStep(2)} style={s.btnBack}>← Back</button>
                  <button type="submit" disabled={loading || !consent} style={{ ...s.btnPrimary, flex: 1, opacity: (loading || !consent) ? 0.55 : 1, cursor: (loading || !consent) ? 'not-allowed' : 'pointer' }}>
                    {loading ? (
                      <><span style={s.spinner} /> Registering…</>
                    ) : (
                      <>Register & Get QR Card <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg></>
                    )}
                  </button>
                </div>
              </>
            )}

          </form>
        </div>
      </div>

      <div style={s.bottomNote}>
        Already registered?{' '}
        <Link href="/login" style={s.bottomNoteLink}>Login here →</Link>
      </div>
    </div>
  );
}

/* ─── Sub-components ─── */

function FieldBlock({ label, required, hint, children, style: blockStyle }) {
  return (
    <div style={{ ...sc.fieldBlock, ...blockStyle }}>
      <div style={sc.fieldLabelRow}>
        <label style={sc.fieldLabel}>
          {label}
          {required && <span style={sc.fieldRequired}> *</span>}
        </label>
        {hint && <span style={sc.fieldHint}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function ErrorBox({ message }) {
  return (
    <div style={sc.errorBox}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      {message}
    </div>
  );
}

function SummaryRow({ label, value, highlight }) {
  return (
    <div style={sc.summaryRow}>
      <span style={sc.summaryRowLabel}>{label}</span>
      <span style={{ ...sc.summaryRowValue, color: highlight ? '#059669' : '#374151' }}>{value}</span>
    </div>
  );
}

function compressImg(base64, maxWidth = 480, quality = 0.7) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, maxWidth / img.width);
      canvas.width = img.width * scale; canvas.height = img.height * scale;
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(base64);
    img.src = base64;
  });
}

/* ─── Styles ─── */

const s = {
  page: { minHeight: '100vh', background: '#F1F5F9', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', padding: '24px 16px 48px', fontFamily: FONT, position: 'relative' },
  bgPattern: { position: 'fixed', inset: 0, backgroundImage: 'radial-gradient(#CBD5E1 1px, transparent 1px)', backgroundSize: '28px 28px', opacity: 0.45, pointerEvents: 'none', zIndex: 0 },

  topBar: { width: '100%', maxWidth: 520, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, position: 'relative', zIndex: 1 },
  topBarBrand: { display: 'flex', alignItems: 'center', gap: 7 },
  topBarName: { fontSize: 16, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.3px' },
  topBarBack: { display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: '#6B7280', textDecoration: 'none' },

  card: { width: '100%', maxWidth: 520, background: 'white', border: '1px solid #E2E8F0', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.07)', overflow: 'hidden', position: 'relative', zIndex: 1 },
  cardStripe: { height: 4, background: 'linear-gradient(90deg, #1D4ED8, #2563EB, #60A5FA)' },
  cardBody: { padding: '24px 28px 32px' },

  cardHeader: { display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 },
  logoWrap: { width: 50, height: 50, borderRadius: 12, background: '#EFF6FF', border: '1px solid #BFDBFE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  eyebrow: { fontSize: 11, fontWeight: 600, color: '#2563EB', textTransform: 'uppercase', letterSpacing: '0.8px', margin: '0 0 3px' },
  heading: { fontSize: 22, fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.5px' },
  subheading: { fontSize: 13.5, color: '#6B7280', lineHeight: 1.6, margin: '0 0 22px' },

  stepBar: { display: 'flex', alignItems: 'center', marginBottom: 24, gap: 0 },
  stepItemWrap: { display: 'flex', alignItems: 'center', gap: 6, flex: 1 },
  stepItem: { width: 28, height: 28, borderRadius: '50%', background: '#F1F5F9', border: '2px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#9CA3AF', flexShrink: 0, transition: 'all 0.2s' },
  stepItemActive: { background: '#2563EB', border: '2px solid #2563EB', color: 'white' },
  stepItemCurrent: { background: '#2563EB', border: '2px solid #1D4ED8', boxShadow: '0 0 0 3px rgba(37,99,235,0.2)' },
  stepLabel: { fontSize: 12, fontWeight: 500, color: '#9CA3AF', whiteSpace: 'nowrap' },
  stepLabelActive: { color: '#2563EB', fontWeight: 600 },
  stepLine: { flex: 1, height: 2, background: '#E2E8F0', margin: '0 4px', transition: 'background 0.2s' },
  stepLineActive: { background: '#2563EB' },

  form: { display: 'flex', flexDirection: 'column', gap: 14 },

  input: { width: '100%', padding: '11px 13px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 9, color: '#0F172A', fontSize: 14.5, outline: 'none', boxSizing: 'border-box', fontFamily: FONT },
  inputSm: { width: '100%', padding: '9px 11px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, color: '#0F172A', fontSize: 13.5, outline: 'none', boxSizing: 'border-box', fontFamily: FONT },

  twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  fieldRow: { display: 'flex', gap: 10 },

  phoneRow: { display: 'flex', alignItems: 'center', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 9, overflow: 'hidden' },
  phonePrefix: { display: 'flex', alignItems: 'center', gap: 5, padding: '11px 12px', borderRight: '1px solid #E2E8F0', background: '#F1F5F9', flexShrink: 0 },
  phonePrefixText: { fontSize: 14, fontWeight: 700, color: '#475569' },
  phoneInput: { flex: 1, padding: '11px 13px', background: 'transparent', border: 'none', color: '#0F172A', fontSize: 15, outline: 'none', fontFamily: FONT },
  phoneCheck: { paddingRight: 12, display: 'flex', alignItems: 'center' },

  locationBtn: { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '11px 13px', background: '#F8FAFC', border: '1px dashed #D1D5DB', borderRadius: 9, fontSize: 13.5, cursor: 'pointer', fontFamily: FONT },

  cameraBtn: { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px', background: '#F8FAFC', border: '2px dashed #BFDBFE', borderRadius: 10, color: '#2563EB', fontSize: 14, cursor: 'pointer', fontFamily: FONT },
  selfiePreview: { position: 'relative', borderRadius: 10, overflow: 'hidden' },
  selfieImg: { width: '100%', maxHeight: 220, objectFit: 'cover', display: 'block' },
  retakeBtn: { position: 'absolute', top: 8, right: 8, padding: '5px 12px', background: 'rgba(0,0,0,0.65)', border: 'none', borderRadius: 7, color: 'white', fontSize: 12, cursor: 'pointer', fontFamily: FONT },

  subPanel: { background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 11, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 },
  subPanelTopRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  subPanelTitle: { fontSize: 13.5, fontWeight: 700, color: '#374151', margin: '0 0 2px' },
  subPanelHint: { fontSize: 12, color: '#9CA3AF', margin: 0 },

  addDepBtn: { display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 7, color: '#2563EB', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: FONT, whiteSpace: 'nowrap' },

  depCard: { background: 'white', border: '1px solid #E2E8F0', borderRadius: 10, padding: '12px 14px', marginTop: 6 },
  depCardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  depCardLabel: { fontSize: 12, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' },
  depRemoveBtn: { display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: '#DC2626', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: FONT },
  depPhotoPreview: { position: 'relative', borderRadius: 8, overflow: 'hidden', marginBottom: 10 },
  depPhotoImg: { width: '100%', maxHeight: 120, objectFit: 'cover', display: 'block' },

  summaryCard: { background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 11, padding: '14px 16px' },
  summaryTitle: { fontSize: 12, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.7px', margin: '0 0 12px' },
  summaryPersonRow: { display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 },
  summaryPhoto: { width: 48, height: 48, borderRadius: 10, objectFit: 'cover', border: '1px solid #E2E8F0' },
  summaryName: { fontSize: 16, fontWeight: 700, color: '#0F172A', margin: 0 },
  summaryMeta: { fontSize: 12.5, color: '#6B7280', margin: '2px 0 0' },
  summaryDetails: { display: 'flex', flexDirection: 'column', gap: 4 },

  consentCard: { background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 11, padding: '14px 16px', transition: 'border-color 0.2s' },
  consentCardActive: { background: '#F0FDF4', borderColor: '#BBF7D0' },
  consentLabel: { display: 'flex', gap: 10, cursor: 'pointer', alignItems: 'flex-start' },
  consentCheckbox: { marginTop: 2, accentColor: '#2563EB', width: 17, height: 17, flexShrink: 0 },
  consentText: { fontSize: 13, color: '#475569', lineHeight: 1.6 },

  btnPrimary: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, width: '100%', padding: '12px', background: '#2563EB', color: 'white', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: FONT, boxShadow: '0 2px 10px rgba(37,99,235,0.28)', transition: 'opacity 0.15s' },
  btnBack: { padding: '12px 18px', background: 'white', color: '#374151', border: '1px solid #E2E8F0', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: FONT },
  btnRow: { display: 'flex', gap: 10 },
  spinner: { width: 16, height: 16, border: '2.5px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block', flexShrink: 0 },

  bottomNote: { marginTop: 18, fontSize: 13.5, color: '#6B7280', position: 'relative', zIndex: 1 },
  bottomNoteLink: { color: '#2563EB', fontWeight: 700, textDecoration: 'none' },

  /* Success */
  successCard: { width: '100%', maxWidth: 440, background: 'white', border: '1px solid #E2E8F0', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.07)', overflow: 'hidden', position: 'relative', zIndex: 1 },
  successCardStripe: { height: 4, background: 'linear-gradient(90deg, #059669, #10B981, #34D399)' },
  successCardBody: { padding: '28px 28px 32px', textAlign: 'center' },
  successIconWrap: { width: 64, height: 64, borderRadius: '50%', background: '#ECFDF5', border: '1px solid #A7F3D0', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  successEyebrow: { fontSize: 11, fontWeight: 600, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.8px', margin: '0 0 6px' },
  successHeading: { fontSize: 24, fontWeight: 800, color: '#0F172A', margin: '0 0 10px', letterSpacing: '-0.5px' },
  successSubtext: { fontSize: 14, color: '#6B7280', lineHeight: 1.6, margin: '0 0 20px' },
  qrSection: { background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: '20px', marginBottom: 20 },
  qrEyebrow: { fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.8px', margin: '0 0 4px' },
  qrHint: { fontSize: 12.5, color: '#9CA3AF', margin: '0 0 16px' },
  qrBox: { display: 'inline-block', padding: 12, background: 'white', borderRadius: 12, border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' },
  qrPhone: { fontSize: 15, fontWeight: 700, color: '#0F172A', margin: '12px 0 8px', letterSpacing: '0.3px' },
  qrVerifiedBadge: { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: '#059669', background: '#ECFDF5', border: '1px solid #A7F3D0', padding: '4px 12px', borderRadius: 20 },
  qrVerifiedDot: { width: 6, height: 6, borderRadius: '50%', background: '#22C55E' },
  successActions: { display: 'flex', gap: 10 },
  successBtnPrimary: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '11px', background: '#2563EB', color: 'white', borderRadius: 10, fontWeight: 600, textDecoration: 'none', fontSize: 14, fontFamily: FONT, boxShadow: '0 2px 8px rgba(37,99,235,0.25)' },
  successBtnSecondary: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '11px', background: 'white', color: '#374151', border: '1px solid #E2E8F0', borderRadius: 10, fontWeight: 600, textDecoration: 'none', fontSize: 14, fontFamily: FONT },
};

const sc = {
  fieldBlock: { display: 'flex', flexDirection: 'column' },
  fieldLabelRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  fieldLabel: { fontSize: 13, fontWeight: 600, color: '#374151' },
  fieldRequired: { color: '#DC2626' },
  fieldHint: { fontSize: 11.5, color: '#9CA3AF' },
  errorBox: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 13px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 9, color: '#DC2626', fontSize: 13.5 },
  summaryRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid #F1F5F9' },
  summaryRowLabel: { fontSize: 12.5, color: '#9CA3AF' },
  summaryRowValue: { fontSize: 13, fontWeight: 600, color: '#374151', textAlign: 'right', maxWidth: '65%' },
};