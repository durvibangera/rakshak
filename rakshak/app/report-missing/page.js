/**
 * FILE: app/report-missing/page.js
 * PURPOSE: User-facing page to file a missing person report.
 *          Accessible from homepage. No login required (phone-based identity).
 *          2-step: Reporter info → Missing person details + photo.
 */
'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';

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

  const [step, setStep] = useState(1); // 1 = reporter, 2 = missing person, 3 = success
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cameraActive, setCameraActive] = useState(false);

  // Reporter info
  const [reporterPhone, setReporterPhone] = useState('');
  const [reporterName, setReporterName] = useState('');

  // Missing person info
  const [missingName, setMissingName] = useState('');
  const [missingAge, setMissingAge] = useState('');
  const [missingGender, setMissingGender] = useState('');
  const [relationship, setRelationship] = useState('');
  const [lastKnownLocation, setLastKnownLocation] = useState('');
  const [identifyingDetails, setIdentifyingDetails] = useState('');
  const [phoneOfMissing, setPhoneOfMissing] = useState('');
  const [photo, setPhoto] = useState(null);

  // Structured attributes for hybrid search
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

  // Result
  const [report, setReport] = useState(null);
  const [autoMatch, setAutoMatch] = useState(null);

  // ── Camera controls ──
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
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    setPhoto(dataUrl);
    stopCamera();
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  // Attach stream to video element once it's rendered
  useEffect(() => {
    if (cameraActive && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [cameraActive]);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  // ── Get geolocation ──
  const [geoLat, setGeoLat] = useState(null);
  const [geoLng, setGeoLng] = useState(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => { setGeoLat(pos.coords.latitude); setGeoLng(pos.coords.longitude); },
        () => {}
      );
    }
  }, []);

  // ── Step 1 validation ──
  const goToStep2 = () => {
    if (!reporterPhone || reporterPhone.length < 10) {
      setError('Enter a valid phone number');
      return;
    }
    setError('');
    setStep(2);
  };

  // ── Submit report ──
  const submitReport = async () => {
    // Validate at least one identifying field is provided
    if (!missingName.trim() && !phoneOfMissing && !photo && !identifyingDetails.trim()) {
      setError('Provide at least one: name, photo, phone, or identifying details');
      return;
    }
    setError('');
    setLoading(true);

    try {
      // Look up reporter's user ID
      let reported_by = null;
      const normalPhone = reporterPhone.startsWith('+91') ? reporterPhone : `+91${reporterPhone.replace(/\D/g, '')}`;
      try {
        const lookupRes = await fetch(`/api/qr-lookup?phone=${encodeURIComponent(normalPhone)}`);
        const lookupData = await lookupRes.json();
        if (lookupData.found) reported_by = lookupData.user.id;
      } catch {}

      const payload = {
        reported_by,
        name: missingName.trim() || null,
        photo: photo || null,
        age: missingAge || null,
        gender: missingGender || null,
        relationship: relationship || null,
        last_known_location: lastKnownLocation || null,
        last_known_lat: geoLat,
        last_known_lng: geoLng,
        identifying_details: identifyingDetails || null,
        phone_of_missing: phoneOfMissing || null,
        // Structured attributes
        age_min: ageMin || null,
        age_max: ageMax || null,
        height: height || null,
        build: build || null,
        skin_tone: skinTone || null,
        hair_color: hairColor || null,
        hair_length: hairLength || null,
        facial_hair: facialHair || null,
        distinguishing_marks: distinguishingMarks || null,
        clothing_description: clothingDescription || null,
        accessories: accessories || null,
      };

      const res = await fetch('/api/missing-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.success) {
        setReport(data.report);
        setAutoMatch(data.autoMatch);
        setStep(3);
      } else {
        setError(data.error || 'Failed to file report');
      }
    } catch {
      setError('Network error. Please try again.');
    }
    setLoading(false);
  };

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════

  return (
    <div style={p.page}>
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Header */}
      <div style={p.header}>
        <button onClick={() => router.push('/')} style={p.backBtn}>← Back</button>
        <h1 style={p.title}>Report Missing Person</h1>
        <div style={{ width: 60 }} />
      </div>

      {/* Progress */}
      <div style={p.progress}>
        {[1, 2, 3].map(s => (
          <div key={s} style={{
            ...p.progressDot,
            background: step >= s ? '#3B82F6' : '#334155',
          }} />
        ))}
      </div>

      {error && <div style={p.error}>{error}</div>}

      {/* ═══ Step 1: Reporter Info ═══ */}
      {step === 1 && (
        <div style={p.section}>
          <h2 style={p.sectionTitle}>Your Information</h2>
          <p style={p.sectionDesc}>Who is filing this report?</p>

          <label style={p.label}>Your Name</label>
          <input
            type="text"
            value={reporterName}
            onChange={e => setReporterName(e.target.value)}
            placeholder="Full name"
            style={p.input}
          />

          <label style={p.label}>Your Phone Number *</label>
          <div style={p.phoneRow}>
            <span style={p.phonePrefix}>+91</span>
            <input
              type="tel"
              value={reporterPhone}
              onChange={e => setReporterPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="10-digit number"
              style={p.phoneInput}
              maxLength={10}
            />
          </div>

          <button onClick={goToStep2} style={p.primaryBtn}>
            Next — Missing Person Details →
          </button>
        </div>
      )}

      {/* ═══ Step 2: Missing Person Details ═══ */}
      {step === 2 && (
        <div style={p.section}>
          <h2 style={p.sectionTitle}>Missing Person Details</h2>
          <p style={p.sectionDesc}>Provide as much detail as possible</p>

          {/* Photo capture */}
          <div style={p.photoSection}>
            {photo ? (
              <div style={{ position: 'relative' }}>
                <img src={photo} alt="Missing person" style={p.photoPreview} />
                <button onClick={() => { setPhoto(null); }} style={p.removePhotoBtn}>✕</button>
              </div>
            ) : cameraActive ? (
              <div>
                <video ref={videoRef} style={p.video} autoPlay playsInline muted />
                <button onClick={capturePhoto} style={p.captureBtn}>📸 Take Photo</button>
              </div>
            ) : (
              <button onClick={startCamera} style={p.openCameraBtn}>
                📷 Add Photo of Missing Person
              </button>
            )}
            <p style={p.photoHint}>A photo greatly increases match chances</p>
          </div>

          <label style={p.label}>Name of Missing Person</label>
          <input
            type="text"
            value={missingName}
            onChange={e => setMissingName(e.target.value)}
            placeholder="Full name (if known)"
            style={p.input}
          />

          <div style={p.row}>
            <div style={p.halfField}>
              <label style={p.label}>Age</label>
              <input
                type="number"
                value={missingAge}
                onChange={e => setMissingAge(e.target.value)}
                placeholder="Age"
                style={p.input}
              />
            </div>
            <div style={p.halfField}>
              <label style={p.label}>Gender</label>
              <select value={missingGender} onChange={e => setMissingGender(e.target.value)} style={p.input}>
                <option value="">Select</option>
                {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          </div>

          <label style={p.label}>Relationship to You</label>
          <select value={relationship} onChange={e => setRelationship(e.target.value)} style={p.input}>
            <option value="">Select</option>
            {RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>

          <label style={p.label}>Their Phone Number (if known)</label>
          <input
            type="tel"
            value={phoneOfMissing}
            onChange={e => setPhoneOfMissing(e.target.value.replace(/\D/g, '').slice(0, 10))}
            placeholder="10-digit number"
            style={p.input}
          />

          <label style={p.label}>Last Known Location</label>
          <input
            type="text"
            value={lastKnownLocation}
            onChange={e => setLastKnownLocation(e.target.value)}
            placeholder="Area, village, landmark..."
            style={p.input}
          />

          {/* ═══ Physical Attributes Section ═══ */}
          <div style={p.sectionDivider}>
            <h3 style={p.subsectionTitle}>Physical Attributes (Optional but helps matching)</h3>
          </div>

          <div style={p.row}>
            <div style={p.halfField}>
              <label style={p.label}>Age Range</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="number"
                  value={ageMin}
                  onChange={e => setAgeMin(e.target.value)}
                  placeholder="Min"
                  style={{ ...p.input, width: '100%' }}
                />
                <span style={{ color: '#64748B' }}>-</span>
                <input
                  type="number"
                  value={ageMax}
                  onChange={e => setAgeMax(e.target.value)}
                  placeholder="Max"
                  style={{ ...p.input, width: '100%' }}
                />
              </div>
            </div>
            <div style={p.halfField}>
              <label style={p.label}>Height</label>
              <select value={height} onChange={e => setHeight(e.target.value)} style={p.input}>
                <option value="">Select</option>
                {HEIGHT_OPTIONS.map(h => <option key={h} value={h.toLowerCase()}>{h}</option>)}
              </select>
            </div>
          </div>

          <div style={p.row}>
            <div style={p.halfField}>
              <label style={p.label}>Build</label>
              <select value={build} onChange={e => setBuild(e.target.value)} style={p.input}>
                <option value="">Select</option>
                {BUILD_OPTIONS.map(b => <option key={b} value={b.toLowerCase()}>{b}</option>)}
              </select>
            </div>
            <div style={p.halfField}>
              <label style={p.label}>Skin Tone</label>
              <select value={skinTone} onChange={e => setSkinTone(e.target.value)} style={p.input}>
                <option value="">Select</option>
                {SKIN_TONE_OPTIONS.map(s => <option key={s} value={s.toLowerCase()}>{s}</option>)}
              </select>
            </div>
          </div>

          <div style={p.row}>
            <div style={p.halfField}>
              <label style={p.label}>Hair Color</label>
              <select value={hairColor} onChange={e => setHairColor(e.target.value)} style={p.input}>
                <option value="">Select</option>
                {HAIR_COLOR_OPTIONS.map(h => <option key={h} value={h.toLowerCase()}>{h}</option>)}
              </select>
            </div>
            <div style={p.halfField}>
              <label style={p.label}>Hair Length</label>
              <select value={hairLength} onChange={e => setHairLength(e.target.value)} style={p.input}>
                <option value="">Select</option>
                {HAIR_LENGTH_OPTIONS.map(h => <option key={h} value={h.toLowerCase()}>{h}</option>)}
              </select>
            </div>
          </div>

          <label style={p.label}>Facial Hair</label>
          <select value={facialHair} onChange={e => setFacialHair(e.target.value)} style={p.input}>
            <option value="">Select</option>
            {FACIAL_HAIR_OPTIONS.map(f => <option key={f} value={f.toLowerCase()}>{f}</option>)}
          </select>

          <label style={p.label}>Distinguishing Marks</label>
          <textarea
            value={distinguishingMarks}
            onChange={e => setDistinguishingMarks(e.target.value)}
            placeholder="Scars, tattoos, birthmarks, moles, visible injuries..."
            rows={2}
            style={{ ...p.input, resize: 'vertical' }}
          />

          <label style={p.label}>Clothing Description</label>
          <textarea
            value={clothingDescription}
            onChange={e => setClothingDescription(e.target.value)}
            placeholder="Last known clothing: shirt color, pants, shoes..."
            rows={2}
            style={{ ...p.input, resize: 'vertical' }}
          />

          <label style={p.label}>Accessories</label>
          <input
            type="text"
            value={accessories}
            onChange={e => setAccessories(e.target.value)}
            placeholder="Glasses, jewelry, watch, bag..."
            style={p.input}
          />

          <label style={p.label}>Other Identifying Details</label>
          <textarea
            value={identifyingDetails}
            onChange={e => setIdentifyingDetails(e.target.value)}
            placeholder="Any other unique features or information..."
            rows={3}
            style={{ ...p.input, resize: 'vertical' }}
          />

          <div style={p.btnRow}>
            <button onClick={() => setStep(1)} style={p.secondaryBtn}>← Back</button>
            <button onClick={submitReport} disabled={loading} style={p.primaryBtn}>
              {loading ? 'Submitting...' : '🔍 Submit Report'}
            </button>
          </div>
        </div>
      )}

      {/* ═══ Step 3: Success ═══ */}
      {step === 3 && (
        <div style={p.section}>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={p.successIcon}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#F1F5F9', margin: '12px 0 4px' }}>
              Report Filed Successfully
            </h2>
            <p style={{ fontSize: 13, color: '#64748B', margin: 0 }}>
              Tracking ID: {report?.id?.slice(0, 8).toUpperCase()}
            </p>
          </div>

          {/* Auto-match result */}
          {autoMatch && (
            <div style={p.matchCard}>
              <div style={p.matchHeader}>
                <span style={{ fontSize: 20 }}>🎯</span>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: '#86EFAC', margin: 0 }}>
                    Possible Match Found!
                  </h3>
                  <p style={{ fontSize: 12, color: '#94A3B8', margin: '2px 0 0' }}>
                    {Math.round(autoMatch.confidence * 100)}% confidence
                  </p>
                </div>
              </div>

              {autoMatch.type === 'registered_user' && autoMatch.matched_user && (
                <p style={{ fontSize: 14, color: '#E2E8F0', margin: '8px 0' }}>
                  Name: <strong>{autoMatch.matched_user.name}</strong>
                </p>
              )}
              {autoMatch.camp_name && (
                <p style={{ fontSize: 14, color: '#E2E8F0', margin: '4px 0' }}>
                  Located at: <strong style={{ color: '#86EFAC' }}>{autoMatch.camp_name}</strong>
                </p>
              )}
              <p style={{ fontSize: 12, color: '#64748B', margin: '8px 0 0' }}>
                A camp admin will review this match and contact you.
              </p>
            </div>
          )}

          {!autoMatch && (
            <div style={p.noMatchCard}>
              <p style={{ fontSize: 14, color: '#E2E8F0', margin: '0 0 4px' }}>
                No immediate match found
              </p>
              <p style={{ fontSize: 13, color: '#94A3B8', margin: 0 }}>
                Your report is now active. If your family member arrives at any camp or is
                registered by rescue teams, you&apos;ll be notified automatically.
              </p>
            </div>
          )}

          <div style={{ ...p.infoBox, marginTop: 16 }}>
            <h4 style={{ fontSize: 13, fontWeight: 700, color: '#E2E8F0', margin: '0 0 6px' }}>What happens next?</h4>
            <ul style={{ fontSize: 12, color: '#94A3B8', margin: 0, paddingLeft: 16, lineHeight: 1.8 }}>
              <li>Your report is shared across all active camps</li>
              <li>Face matching runs automatically as new people arrive</li>
              <li>Camp admins review potential matches</li>
              <li>You&apos;ll receive an SMS/call when a match is confirmed</li>
            </ul>
          </div>

          <div style={p.btnRow}>
            <button onClick={() => {
              setStep(1);
              setReport(null);
              setAutoMatch(null);
              setMissingName('');
              setMissingAge('');
              setMissingGender('');
              setRelationship('');
              setLastKnownLocation('');
              setIdentifyingDetails('');
              setPhoneOfMissing('');
              setPhoto(null);
            }} style={p.secondaryBtn}>
              Report Another Person
            </button>
            <button onClick={() => router.push('/')} style={p.primaryBtn}>
              ← Back to Home
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════

const p = {
  page: {
    minHeight: '100vh', background: '#0F172A', fontFamily: 'system-ui, sans-serif',
    maxWidth: 520, margin: '0 auto', paddingBottom: 40,
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '16px 20px', borderBottom: '1px solid #1E293B',
  },
  backBtn: {
    background: 'none', border: 'none', color: '#64748B', fontSize: 14,
    fontWeight: 600, cursor: 'pointer', padding: '4px 0',
  },
  title: { fontSize: 18, fontWeight: 800, color: '#F1F5F9', margin: 0 },
  progress: {
    display: 'flex', gap: 8, justifyContent: 'center', padding: '16px 0',
  },
  progressDot: {
    width: 40, height: 4, borderRadius: 2,
    transition: 'background 0.3s',
  },
  error: {
    margin: '0 20px 12px', padding: '10px 14px', background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, color: '#FCA5A5',
    fontSize: 13,
  },
  section: { padding: '0 20px' },
  sectionTitle: { fontSize: 18, fontWeight: 800, color: '#F1F5F9', margin: '0 0 4px' },
  sectionDesc: { fontSize: 13, color: '#64748B', margin: '0 0 20px' },
  sectionDivider: {
    marginTop: 24,
    marginBottom: 16,
    paddingTop: 20,
    borderTop: '1px solid #334155',
  },
  subsectionTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: '#94A3B8',
    margin: 0,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  label: {
    display: 'block', fontSize: 12, fontWeight: 600, color: '#94A3B8',
    marginBottom: 6, marginTop: 14, textTransform: 'uppercase', letterSpacing: 0.4,
  },
  input: {
    width: '100%', padding: '12px 14px', background: '#1E293B',
    border: '1px solid #334155', borderRadius: 10, color: '#F1F5F9',
    fontSize: 14, outline: 'none', boxSizing: 'border-box',
  },
  phoneRow: {
    display: 'flex', alignItems: 'center', background: '#1E293B',
    border: '1px solid #334155', borderRadius: 10, overflow: 'hidden',
  },
  phonePrefix: {
    padding: '12px 14px', color: '#64748B', fontWeight: 600, fontSize: 14,
    background: '#0F172A', borderRight: '1px solid #334155',
  },
  phoneInput: {
    flex: 1, padding: '12px 14px', background: 'transparent', border: 'none',
    color: '#F1F5F9', fontSize: 14, outline: 'none',
  },
  row: { display: 'flex', gap: 12 },
  halfField: { flex: 1 },
  btnRow: { display: 'flex', gap: 10, marginTop: 20 },
  primaryBtn: {
    flex: 1, padding: 14, background: 'linear-gradient(135deg, #3B82F6, #2563EB)',
    color: 'white', border: 'none', borderRadius: 10, fontSize: 15,
    fontWeight: 700, cursor: 'pointer',
  },
  secondaryBtn: {
    flex: 1, padding: 14, background: '#334155', color: '#E2E8F0',
    border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600,
    cursor: 'pointer',
  },
  // Photo section
  photoSection: {
    marginBottom: 16, textAlign: 'center',
  },
  photoPreview: {
    width: '100%', maxHeight: 300, objectFit: 'cover', borderRadius: 12,
    border: '2px solid #334155',
  },
  removePhotoBtn: {
    position: 'absolute', top: 8, right: 8, width: 32, height: 32,
    borderRadius: '50%', background: 'rgba(239,68,68,0.9)', color: 'white',
    border: 'none', fontSize: 16, cursor: 'pointer', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
  },
  video: {
    width: '100%', borderRadius: 12, border: '2px solid #334155', maxHeight: 300,
  },
  captureBtn: {
    width: '100%', padding: 12, marginTop: 8, background: '#22C55E',
    color: 'white', border: 'none', borderRadius: 10, fontSize: 14,
    fontWeight: 700, cursor: 'pointer',
  },
  openCameraBtn: {
    width: '100%', padding: 20, background: '#1E293B', border: '2px dashed #334155',
    borderRadius: 12, color: '#94A3B8', fontSize: 14, fontWeight: 600,
    cursor: 'pointer',
  },
  photoHint: { fontSize: 11, color: '#475569', margin: '6px 0 0' },
  // Success
  successIcon: {
    width: 72, height: 72, borderRadius: '50%', background: 'rgba(34,197,94,0.15)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto',
  },
  matchCard: {
    padding: 16, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)',
    borderRadius: 12,
  },
  matchHeader: {
    display: 'flex', gap: 12, alignItems: 'center',
  },
  noMatchCard: {
    padding: 16, background: '#1E293B', border: '1px solid #334155', borderRadius: 12,
  },
  infoBox: {
    padding: 14, background: '#1E293B', border: '1px solid #334155', borderRadius: 12,
  },
};
