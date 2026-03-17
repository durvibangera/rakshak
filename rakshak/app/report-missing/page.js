/**
 * FILE: app/report-missing/page.js
 * PURPOSE: User-facing page to file a missing person report.
 *          Accessible from homepage. No login required (phone-based identity).
 *          2-step: Reporter info → Missing person details + photo.
 */
'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const FONT = '"DM Sans", "Instrument Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const RELATIONSHIPS = ['Parent', 'Child', 'Spouse', 'Sibling', 'Grandparent', 'Grandchild', 'Friend', 'Neighbor', 'Other'];
const GENDERS = ['Male', 'Female', 'Other'];
const HEIGHT_OPTIONS = ['Short', 'Average', 'Tall'];
const BUILD_OPTIONS = ['Slim', 'Average', 'Heavy', 'Athletic'];
const SKIN_TONE_OPTIONS = ['Fair', 'Medium', 'Dark'];
const HAIR_COLOR_OPTIONS = ['Black', 'Brown', 'Blonde', 'Red', 'Gray', 'White', 'Dyed', 'Other'];
const HAIR_LENGTH_OPTIONS = ['Bald', 'Short', 'Medium', 'Long'];
const FACIAL_HAIR_OPTIONS = ['Clean Shaven', 'Beard', 'Mustache', 'Goatee', 'Stubble'];

export default function ReportMissingPage() {
  const router = useRouter();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cameraActive, setCameraActive] = useState(false);

  const [reporterPhone, setReporterPhone] = useState('');
  const [reporterName, setReporterName] = useState('');
  const [missingName, setMissingName] = useState('');
  const [missingAge, setMissingAge] = useState('');
  const [missingGender, setMissingGender] = useState('');
  const [relationship, setRelationship] = useState('');
  const [lastKnownLocation, setLastKnownLocation] = useState('');
  const [identifyingDetails, setIdentifyingDetails] = useState('');
  const [phoneOfMissing, setPhoneOfMissing] = useState('');
  const [photo, setPhoto] = useState(null);

  const [ageMin, setAgeMin] = useState('');
  const [ageMax, setAgeMax] = useState('');
  const [height, setHeight] = useState('');
  const [build, setBuild] = useState('');
  const [skinTone, setSkinTone] = useState('');
  const [hairColor, setHairColor] = useState('');
  const [hairLength, setHairLength] = useState('');
  const [facialHair, setFacialHair] = useState('');
  const [distinguishingMarks, setDistinguishingMarks] = useState('');
  const [clothingDescription, setClothingDescription] = useState('');
  const [accessories, setAccessories] = useState('');
  const [report, setReport] = useState(null);
  const [autoMatch, setAutoMatch] = useState(null);
  const [geoLat, setGeoLat] = useState(null);
  const [geoLng, setGeoLng] = useState(null);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      setCameraActive(true);
    } catch {
      setError('Camera access denied');
    }
  }, []);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    setPhoto(canvas.toDataURL('image/jpeg', 0.8));
    stopCamera();
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  useEffect(() => {
    if (cameraActive && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [cameraActive]);

  useEffect(() => { return () => stopCamera(); }, [stopCamera]);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => { setGeoLat(pos.coords.latitude); setGeoLng(pos.coords.longitude); },
        () => {}
      );
    }
  }, []);

  const goToStep2 = () => {
    if (!reporterPhone || reporterPhone.length < 10) { setError('Enter a valid phone number'); return; }
    setError('');
    setStep(2);
  };

  const submitReport = async () => {
    if (!missingName.trim() && !phoneOfMissing && !photo && !identifyingDetails.trim()) {
      setError('Provide at least one: name, photo, phone, or identifying details');
      return;
    }
    setError('');
    setLoading(true);
    try {
      let reported_by = null;
      const normalPhone = reporterPhone.startsWith('+91') ? reporterPhone : `+91${reporterPhone.replace(/\D/g, '')}`;
      try {
        const lookupRes = await fetch(`/api/qr-lookup?phone=${encodeURIComponent(normalPhone)}`);
        const lookupData = await lookupRes.json();
        if (lookupData.found) reported_by = lookupData.user.id;
      } catch {}

      const payload = {
        reported_by, name: missingName.trim() || null, photo: photo || null,
        age: missingAge || null, gender: missingGender || null, relationship: relationship || null,
        last_known_location: lastKnownLocation || null, last_known_lat: geoLat, last_known_lng: geoLng,
        identifying_details: identifyingDetails || null, phone_of_missing: phoneOfMissing || null,
        age_min: ageMin || null, age_max: ageMax || null, height: height || null, build: build || null,
        skin_tone: skinTone || null, hair_color: hairColor || null, hair_length: hairLength || null,
        facial_hair: facialHair || null, distinguishing_marks: distinguishingMarks || null,
        clothing_description: clothingDescription || null, accessories: accessories || null,
      };

      const res = await fetch('/api/missing-reports', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) { setReport(data.report); setAutoMatch(data.autoMatch); setStep(3); }
      else setError(data.error || 'Failed to file report');
    } catch { setError('Network error. Please try again.'); }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#EEF2F7', fontFamily: FONT, color: '#111827' }}>
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Nav */}
      <header style={s.nav}>
        <div style={s.navLeft}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center' }}>
            <img src="/logo-light.png" alt="Sahaay" style={{ height: 52, width: 'auto', objectFit: 'contain' }} />
          </Link>
        </div>
        <div style={s.navCenter}>
          <h1 style={s.navTitle}>Report Missing Person</h1>
        </div>
        <div style={s.navRight}>
          <Link href="/" style={s.backBtn}>← Back to Home</Link>
        </div>
      </header>

      {/* Body */}
      <div style={s.body}>
        <div style={s.card}>

          {/* Progress */}
          <div style={s.progress}>
            {[
              { n: 1, label: 'Your Info' },
              { n: 2, label: 'Missing Person' },
              { n: 3, label: 'Submitted' },
            ].map(({ n, label }) => (
              <div key={n} style={s.progressStep}>
                <div style={{ ...s.progressDot, background: step >= n ? '#1B3676' : '#E2E8F0', color: step >= n ? 'white' : '#9CA3AF' }}>
                  {step > n ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                  ) : n}
                </div>
                <span style={{ ...s.progressLabel, color: step >= n ? '#1B3676' : '#9CA3AF', fontWeight: step === n ? 700 : 500 }}>{label}</span>
                {n < 3 && <div style={{ ...s.progressLine, background: step > n ? '#1B3676' : '#E2E8F0' }} />}
              </div>
            ))}
          </div>

          {error && <div style={s.error}>{error}</div>}

          {/* Step 1 */}
          {step === 1 && (
            <div style={s.section}>
              <p style={s.eyebrow}>Step 1 of 2</p>
              <h2 style={s.sectionTitle}>Your Information</h2>
              <p style={s.sectionDesc}>Who is filing this report?</p>

              <label style={s.label}>Your Name</label>
              <input type="text" value={reporterName} onChange={e => setReporterName(e.target.value)} placeholder="Full name" style={s.input} />

              <label style={s.label}>Your Phone Number *</label>
              <div style={s.phoneRow}>
                <span style={s.phonePrefix}>+91</span>
                <input type="tel" value={reporterPhone}
                  onChange={e => setReporterPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="10-digit number" style={s.phoneInput} maxLength={10} />
              </div>

              <button onClick={goToStep2} style={{ ...s.primaryBtn, flex: '0 0 auto', width: 'fit-content', minWidth: 0, padding: '10px 16px', minHeight: 40, marginTop: 12 }}>
                Next — Missing Person Details →
              </button>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div style={s.section}>
              <p style={s.eyebrow}>Step 2 of 2</p>
              <h2 style={s.sectionTitle}>Missing Person Details</h2>
              <p style={s.sectionDesc}>Provide as much detail as possible</p>

              {/* Photo */}
              <div style={s.photoSection}>
                {photo ? (
                  <div style={{ position: 'relative' }}>
                    <img src={photo} alt="Missing person" style={s.photoPreview} />
                    <button onClick={() => setPhoto(null)} style={s.removePhotoBtn}>✕</button>
                  </div>
                ) : cameraActive ? (
                  <div>
                    <video ref={videoRef} style={s.video} autoPlay playsInline muted />
                    <button onClick={capturePhoto} style={s.captureBtn}>📸 Take Photo</button>
                  </div>
                ) : (
                  <button onClick={startCamera} style={s.openCameraBtn}>
                    📷 Add Photo of Missing Person
                  </button>
                )}
                <p style={s.photoHint}>A photo greatly increases match chances</p>
              </div>

              <label style={s.label}>Name of Missing Person</label>
              <input type="text" value={missingName} onChange={e => setMissingName(e.target.value)} placeholder="Full name (if known)" style={s.input} />

              <div style={s.row}>
                <div style={s.halfField}>
                  <label style={s.label}>Age</label>
                  <input type="number" value={missingAge} onChange={e => setMissingAge(e.target.value)} placeholder="Age" style={s.input} />
                </div>
                <div style={s.halfField}>
                  <label style={s.label}>Gender</label>
                  <select value={missingGender} onChange={e => setMissingGender(e.target.value)} style={s.input}>
                    <option value="">Select</option>
                    {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
              </div>

              <label style={s.label}>Relationship to You</label>
              <select value={relationship} onChange={e => setRelationship(e.target.value)} style={s.input}>
                <option value="">Select</option>
                {RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>

              <label style={s.label}>Their Phone Number (if known)</label>
              <input type="tel" value={phoneOfMissing}
                onChange={e => setPhoneOfMissing(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="10-digit number" style={s.input} />

              <label style={s.label}>Last Known Location</label>
              <input type="text" value={lastKnownLocation} onChange={e => setLastKnownLocation(e.target.value)} placeholder="Area, village, landmark..." style={s.input} />

              {/* Physical Attributes */}
              <div style={s.divider}>
                <span style={s.dividerLabel}>Physical Attributes — Optional but helps matching</span>
              </div>

              <div style={s.row}>
                <div style={s.halfField}>
                  <label style={s.label}>Age Range</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="number" value={ageMin} onChange={e => setAgeMin(e.target.value)} placeholder="Min" style={{ ...s.input, width: '100%' }} />
                    <span style={{ color: '#9CA3AF', flexShrink: 0 }}>–</span>
                    <input type="number" value={ageMax} onChange={e => setAgeMax(e.target.value)} placeholder="Max" style={{ ...s.input, width: '100%' }} />
                  </div>
                </div>
                <div style={s.halfField}>
                  <label style={s.label}>Height</label>
                  <select value={height} onChange={e => setHeight(e.target.value)} style={s.input}>
                    <option value="">Select</option>
                    {HEIGHT_OPTIONS.map(h => <option key={h} value={h.toLowerCase()}>{h}</option>)}
                  </select>
                </div>
              </div>

              <div style={s.row}>
                <div style={s.halfField}>
                  <label style={s.label}>Build</label>
                  <select value={build} onChange={e => setBuild(e.target.value)} style={s.input}>
                    <option value="">Select</option>
                    {BUILD_OPTIONS.map(b => <option key={b} value={b.toLowerCase()}>{b}</option>)}
                  </select>
                </div>
                <div style={s.halfField}>
                  <label style={s.label}>Skin Tone</label>
                  <select value={skinTone} onChange={e => setSkinTone(e.target.value)} style={s.input}>
                    <option value="">Select</option>
                    {SKIN_TONE_OPTIONS.map(st => <option key={st} value={st.toLowerCase()}>{st}</option>)}
                  </select>
                </div>
              </div>

              <div style={s.row}>
                <div style={s.halfField}>
                  <label style={s.label}>Hair Color</label>
                  <select value={hairColor} onChange={e => setHairColor(e.target.value)} style={s.input}>
                    <option value="">Select</option>
                    {HAIR_COLOR_OPTIONS.map(h => <option key={h} value={h.toLowerCase()}>{h}</option>)}
                  </select>
                </div>
                <div style={s.halfField}>
                  <label style={s.label}>Hair Length</label>
                  <select value={hairLength} onChange={e => setHairLength(e.target.value)} style={s.input}>
                    <option value="">Select</option>
                    {HAIR_LENGTH_OPTIONS.map(h => <option key={h} value={h.toLowerCase()}>{h}</option>)}
                  </select>
                </div>
              </div>

              <label style={s.label}>Facial Hair</label>
              <select value={facialHair} onChange={e => setFacialHair(e.target.value)} style={s.input}>
                <option value="">Select</option>
                {FACIAL_HAIR_OPTIONS.map(f => <option key={f} value={f.toLowerCase()}>{f}</option>)}
              </select>

              <label style={s.label}>Distinguishing Marks</label>
              <textarea value={distinguishingMarks} onChange={e => setDistinguishingMarks(e.target.value)}
                placeholder="Scars, tattoos, birthmarks, moles, visible injuries..." rows={2} style={{ ...s.input, resize: 'vertical' }} />

              <label style={s.label}>Clothing Description</label>
              <textarea value={clothingDescription} onChange={e => setClothingDescription(e.target.value)}
                placeholder="Last known clothing: shirt color, pants, shoes..." rows={2} style={{ ...s.input, resize: 'vertical' }} />

              <label style={s.label}>Accessories</label>
              <input type="text" value={accessories} onChange={e => setAccessories(e.target.value)} placeholder="Glasses, jewelry, watch, bag..." style={s.input} />

              <label style={s.label}>Other Identifying Details</label>
              <textarea value={identifyingDetails} onChange={e => setIdentifyingDetails(e.target.value)}
                placeholder="Any other unique features or information..." rows={3} style={{ ...s.input, resize: 'vertical' }} />

              <div style={s.btnRow}>
                <button onClick={() => setStep(1)} style={s.secondaryBtn}>← Back</button>
                <button onClick={submitReport} disabled={loading} style={{ ...s.primaryBtn, opacity: loading ? 0.7 : 1 }}>
                  {loading ? 'Submitting...' : '🔍 Submit Report'}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Success */}
          {step === 3 && (
            <div style={s.section}>
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <div style={s.successIcon}>
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', margin: '14px 0 4px' }}>Report Filed Successfully</h2>
                <p style={{ fontSize: 13, color: '#6B7280', margin: 0 }}>Tracking ID: {report?.id?.slice(0, 8).toUpperCase()}</p>
              </div>

              {autoMatch && (
                <div style={s.matchCard}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontSize: 22 }}>🎯</span>
                    <div>
                      <h3 style={{ fontSize: 15, fontWeight: 700, color: '#065F46', margin: 0 }}>Possible Match Found!</h3>
                      <p style={{ fontSize: 12, color: '#6B7280', margin: '2px 0 0' }}>{Math.round(autoMatch.confidence * 100)}% confidence</p>
                    </div>
                  </div>
                  {autoMatch.type === 'registered_user' && autoMatch.matched_user && (
                    <p style={{ fontSize: 14, color: '#374151', margin: '6px 0' }}>Name: <strong>{autoMatch.matched_user.name}</strong></p>
                  )}
                  {autoMatch.camp_name && (
                    <p style={{ fontSize: 14, color: '#374151', margin: '4px 0' }}>Located at: <strong style={{ color: '#059669' }}>{autoMatch.camp_name}</strong></p>
                  )}
                  <p style={{ fontSize: 12, color: '#6B7280', margin: '8px 0 0' }}>A camp admin will review this match and contact you.</p>
                </div>
              )}

              {!autoMatch && (
                <div style={s.noMatchCard}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#374151', margin: '0 0 4px' }}>No immediate match found</p>
                  <p style={{ fontSize: 13, color: '#6B7280', margin: 0, lineHeight: 1.6 }}>
                    Your report is now active. If your family member arrives at any camp or is registered by rescue teams, you&apos;ll be notified automatically.
                  </p>
                </div>
              )}

              <div style={s.infoBox}>
                <h4 style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', margin: '0 0 8px' }}>What happens next?</h4>
                <ul style={{ fontSize: 13, color: '#6B7280', margin: 0, paddingLeft: 18, lineHeight: 1.9 }}>
                  <li>Your report is shared across all active camps</li>
                  <li>Face matching runs automatically as new people arrive</li>
                  <li>Camp admins review potential matches</li>
                  <li>You&apos;ll receive an SMS/call when a match is confirmed</li>
                </ul>
              </div>

              <div style={s.btnRow}>
                <button onClick={() => {
                  setStep(1); setReport(null); setAutoMatch(null);
                  setMissingName(''); setMissingAge(''); setMissingGender(''); setRelationship('');
                  setLastKnownLocation(''); setIdentifyingDetails(''); setPhoneOfMissing(''); setPhoto(null);
                }} style={s.secondaryBtn}>Report Another Person</button>
                <button onClick={() => router.push('/')} style={s.primaryBtn}>← Back to Home</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const s = {
  nav: {
    background: 'white', borderBottom: '1px solid #E2E8F0', padding: '0 24px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    height: 72, position: 'sticky', top: 0, zIndex: 200,
    boxShadow: '0 2px 10px rgba(2,6,23,0.06)', fontFamily: FONT,
  },
  navLeft: { display: 'flex', alignItems: 'center', minWidth: 120 },
  navCenter: { display: 'flex', justifyContent: 'center', flex: 1 },
  navTitle: { fontSize: 16, fontWeight: 700, color: '#0F172A', margin: 0 },
  navRight: { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', minWidth: 120 },
  backBtn: {
    fontSize: 13.5, fontWeight: 600, color: '#374151', background: 'white',
    border: '1px solid #D1D5DB', padding: '7px 16px', borderRadius: 7, textDecoration: 'none',
  },
  body: { maxWidth: 780, margin: '24px auto', padding: '0 16px 64px' },
  card: {
    background: 'white', border: '1px solid #E2E8F0', borderRadius: 14,
    boxShadow: '0 10px 24px rgba(15,23,42,0.06)', overflow: 'hidden',
  },
  progress: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '22px 20px 18px', borderBottom: '1px solid #F1F5F9', gap: 0,
    flexWrap: 'wrap',
  },
  progressStep: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 },
  progressDot: {
    width: 28, height: 28, borderRadius: '50%', display: 'flex',
    alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0,
  },
  progressLabel: { fontSize: 12.5, whiteSpace: 'nowrap' },
  progressLine: { width: 34, height: 2, margin: '0 6px', flexShrink: 0 },
  error: {
    margin: '0 28px 16px', padding: '10px 14px', background: '#FEF2F2',
    border: '1px solid #FECACA', borderRadius: 8, color: '#DC2626', fontSize: 13,
  },
  section: { padding: '24px 22px' },
  eyebrow: { fontSize: 11, fontWeight: 700, color: '#1B3676', textTransform: 'uppercase', letterSpacing: '0.8px', margin: '0 0 6px' },
  sectionTitle: { fontSize: 20, fontWeight: 800, color: '#0F172A', margin: '0 0 4px', letterSpacing: '-0.3px' },
  sectionDesc: { fontSize: 13.5, color: '#6B7280', margin: '0 0 22px' },
  label: {
    display: 'block', fontSize: 12.5, fontWeight: 600, color: '#374151',
    marginBottom: 6, marginTop: 14, letterSpacing: '0.2px',
  },
  input: {
    width: '100%', padding: '12px 14px', background: 'white',
    border: '1px solid #D1D5DB', borderRadius: 8, color: '#111827',
    fontSize: 14, outline: 'none', boxSizing: 'border-box',
    fontFamily: FONT,
  },
  phoneRow: {
    display: 'flex', alignItems: 'center', border: '1px solid #D1D5DB',
    borderRadius: 8, overflow: 'hidden',
  },
  phonePrefix: {
    padding: '12px 14px', color: '#6B7280', fontWeight: 600, fontSize: 14,
    background: '#F8FAFC', borderRight: '1px solid #D1D5DB', flexShrink: 0,
  },
  phoneInput: {
    flex: 1, padding: '12px 14px', background: 'white', border: 'none',
    color: '#111827', fontSize: 14, outline: 'none', fontFamily: FONT,
  },
  row: { display: 'flex', gap: 12, flexWrap: 'wrap' },
  halfField: { flex: 1 },
  divider: {
    marginTop: 28, marginBottom: 4, paddingTop: 24,
    borderTop: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', gap: 10,
  },
  dividerLabel: {
    fontSize: 11.5, fontWeight: 700, color: '#9CA3AF',
    textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap',
  },
  btnRow: { display: 'flex', gap: 10, marginTop: 24, flexWrap: 'wrap' },
  primaryBtn: {
    flex: 1, minHeight: 46, padding: '12px 20px', background: '#1B3676',
    color: 'white', border: 'none', borderRadius: 8, fontSize: 14,
    fontWeight: 700, cursor: 'pointer', fontFamily: FONT,
  },
  secondaryBtn: {
    flex: 1, minHeight: 46, padding: '12px 20px', background: 'white', color: '#374151',
    border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 14, fontWeight: 600,
    cursor: 'pointer', fontFamily: FONT,
  },
  photoSection: { marginBottom: 8, textAlign: 'center' },
  photoPreview: { width: '100%', maxHeight: 280, objectFit: 'cover', borderRadius: 10, border: '1px solid #E2E8F0' },
  removePhotoBtn: {
    position: 'absolute', top: 8, right: 8, width: 30, height: 30,
    borderRadius: '50%', background: 'rgba(220,38,38,0.9)', color: 'white',
    border: 'none', fontSize: 14, cursor: 'pointer', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
  },
  video: { width: '100%', borderRadius: 10, border: '1px solid #E2E8F0', maxHeight: 280 },
  captureBtn: {
    width: '100%', padding: 11, marginTop: 8, background: '#059669',
    color: 'white', border: 'none', borderRadius: 8, fontSize: 14,
    fontWeight: 700, cursor: 'pointer', fontFamily: FONT,
  },
  openCameraBtn: {
    width: '100%', padding: 20, background: '#F8FAFC', border: '2px dashed #D1D5DB',
    borderRadius: 10, color: '#6B7280', fontSize: 14, fontWeight: 600,
    cursor: 'pointer', fontFamily: FONT,
  },
  photoHint: { fontSize: 11.5, color: '#9CA3AF', margin: '6px 0 0' },
  successIcon: {
    width: 68, height: 68, borderRadius: '50%', background: '#ECFDF5',
    border: '1px solid #A7F3D0', display: 'flex', alignItems: 'center',
    justifyContent: 'center', margin: '0 auto',
  },
  matchCard: {
    padding: 16, background: '#F0FDF4', border: '1px solid #BBF7D0',
    borderRadius: 10, marginBottom: 14,
  },
  noMatchCard: {
    padding: 16, background: '#F8FAFC', border: '1px solid #E2E8F0',
    borderRadius: 10, marginBottom: 14,
  },
  infoBox: {
    padding: 16, background: '#EEF2FF', border: '1px solid #C7D2FE',
    borderRadius: 10, marginBottom: 4,
  },
};
