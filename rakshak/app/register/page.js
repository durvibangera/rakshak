'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useLocationTracker } from '@/hooks/useLocationTracker';
import { nanoid } from 'nanoid';
import CameraCapture from '@/components/common/CameraCapture';
import { QRCodeSVG } from 'qrcode.react';

const STATES = [
  'Maharashtra', 'Gujarat', 'Karnataka', 'Tamil Nadu', 'Kerala',
  'Andhra Pradesh', 'Telangana', 'West Bengal', 'Rajasthan', 'Uttar Pradesh',
  'Madhya Pradesh', 'Bihar', 'Odisha', 'Assam', 'Himachal Pradesh',
  'Uttarakhand', 'Goa', 'Punjab', 'Haryana', 'Jharkhand',
];

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const RELATIONSHIPS = ['Child', 'Spouse', 'Parent', 'Sibling', 'Other'];

const EMPTY_DEPENDENT = {
  name: '', age: '', gender: '', relationship: 'Child',
  height_cm: '', identifying_marks: '', blood_group: '',
  medical_conditions: '', photo: null, showCamera: false,
};

export default function RegisterPage() {
  // — Main user fields —
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
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

  // — Dependents —
  const [dependents, setDependents] = useState([]);
  const [showDependents, setShowDependents] = useState(false);

  // — UI state —
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [registeredPhone, setRegisteredPhone] = useState('');
  const [userId, setUserId] = useState('');
  const [step, setStep] = useState(1); // 1=basic, 2=medical+dependents, 3=consent

  const detectLocation = () => {
    if (!navigator.geolocation) { setLocationStatus('GPS not available'); return; }
    setLocationStatus('Detecting...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setLocationStatus(`${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`);
      },
      () => setLocationStatus('Location access denied'),
      { timeout: 5000, maximumAge: 60000 }
    );
  };

  const addDependent = () => {
    setDependents(prev => [...prev, { ...EMPTY_DEPENDENT }]);
    setShowDependents(true);
  };

  const updateDependent = (index, field, value) => {
    setDependents(prev => prev.map((d, i) => i === index ? { ...d, [field]: value } : d));
  };

  const removeDependent = (index) => {
    setDependents(prev => prev.filter((_, i) => i !== index));
  };

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

      // Compress selfie
      const compressedSelfie = await compressImg(selfie, 480, 0.7);

      // Upload selfie
      let selfie_url = null;
      const base64Data = compressedSelfie.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
      const fileName = `selfies/${fullPhone.replace('+', '')}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('rakshak')
        .upload(fileName, buffer, { contentType: 'image/jpeg', upsert: true });

      if (!uploadError) {
        const { data: urlData } = supabase.storage.from('rakshak').getPublicUrl(fileName);
        selfie_url = urlData?.publicUrl;
      }

      // Extract face embedding via server-side Python face service
      let face_encoding = null;
      try {
        const embRes = await fetch('/api/face-embedding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_base64: compressedSelfie }),
        });
        const embData = await embRes.json();
        if (embData.success) {
          face_encoding = embData.embedding;
        }
      } catch (embErr) {
        console.warn('Face embedding extraction failed, proceeding without:', embErr.message);
      }

      const { data, error: dbError } = await supabase.from('users').upsert({
        name: name.trim(),
        phone: fullPhone,
        address: address.trim() || null,
        state,
        lat, lng,
        selfie_url,
        face_encoding,
        blood_group: bloodGroup || null,
        medical_conditions: medicalConditions.trim() || null,
        current_medications: currentMedications.trim() || null,
        disability_status: disabilityStatus.trim() || null,
        emergency_contact_name: emergencyContactName.trim() || null,
        emergency_contact_phone: emergencyContactPhone.trim() || null,
        registration_type: 'self',
        qr_code_id: generatedQrId,
        role: 'verified_user',
        consent_given: true,
        consent_timestamp: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'phone' }).select().single();

      if (dbError) throw dbError;

      // Register dependents
      if (dependents.length > 0 && data?.id) {
        for (const dep of dependents) {
          if (!dep.name?.trim()) continue;
          let depPhoto = null;
          if (dep.photo) {
            depPhoto = await compressImg(dep.photo, 320, 0.6);
          }
          try {
            await fetch('/api/dependents', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                parent_user_id: data.id,
                name: dep.name.trim(),
                relationship: dep.relationship || 'Other',
                age: dep.age ? parseInt(dep.age) : null,
                gender: dep.gender || null,
                height_cm: dep.height_cm ? parseInt(dep.height_cm) : null,
                identifying_marks: dep.identifying_marks || null,
                blood_group: dep.blood_group || null,
                medical_conditions: dep.medical_conditions || null,
                photo_base64: depPhoto || null,
              }),
            });
          } catch (depErr) {
            console.error('Dependent registration error:', depErr);
          }
        }
      }

      localStorage.setItem('rakshak_phone', fullPhone);
      setRegisteredPhone(fullPhone);
      setUserId(data?.id || '');
      setSuccess(true);
    } catch (err) {
      console.error('Registration error:', err);
      setError(err.message || 'Registration failed');
    }
    setLoading(false);
  };

  const savedPhone = typeof window !== 'undefined' ? localStorage.getItem('rakshak_phone') : null;
  useLocationTracker(success ? registeredPhone : savedPhone);

  // ═══════════════════════════════════════════════
  // SUCCESS SCREEN — Phone-based QR card
  // ═══════════════════════════════════════════════
  if (success) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={{ textAlign: 'center' }}>
            <div style={styles.successIcon}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 8px', color: '#F1F5F9' }}>Registered Successfully!</h2>
            <p style={{ color: '#94A3B8', fontSize: 14, margin: '0 0 4px' }}>
              You will receive voice call alerts for disasters in your area.
            </p>
            {dependents.filter(d => d.name?.trim()).length > 0 && (
              <p style={{ color: '#86EFAC', fontSize: 13, margin: '0 0 4px' }}>
                {dependents.filter(d => d.name?.trim()).length} dependent(s) registered
              </p>
            )}

            <div style={styles.qrSection}>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 4px' }}>
                Your Emergency QR Identity
              </p>
              <p style={{ fontSize: 11, color: '#94A3B8', margin: '0 0 12px' }}>
                Screenshot this — it works even without internet
              </p>
              <div style={styles.qrBox}>
                <QRCodeSVG
                  value={JSON.stringify({ phone: registeredPhone })}
                  size={180}
                  bgColor="#FFFFFF"
                  fgColor="#0F172A"
                  level="M"
                />
              </div>
              <p style={{ fontSize: 15, fontWeight: 700, color: '#F1F5F9', margin: '12px 0 0' }}>
                {registeredPhone}
              </p>
              <p style={{ fontSize: 12, color: '#94A3B8', margin: '4px 0 0' }}>
                Show this QR at any relief camp for instant check-in
              </p>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <a href="/flood-prediction" style={styles.primaryLink}>View Disaster Map</a>
              <a href="/" style={styles.secondaryLink}>Back to Home</a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════
  // REGISTRATION FORM — Multi-step
  // ═══════════════════════════════════════════════
  return (
    <div style={styles.page}>
      <div style={{ ...styles.card, maxWidth: 480 }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={styles.logo}>R</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: '10px 0 0', color: '#F1F5F9' }}>Rakshak</h1>
          <p style={{ color: '#94A3B8', fontSize: 13, margin: '4px 0 0' }}>
            Pre-register for disaster alerts and family safety
          </p>
        </div>

        {/* Step indicator */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
          {[1, 2, 3].map(s => (
            <div key={s} style={{
              flex: 1, height: 4, borderRadius: 2,
              background: s <= step ? '#3B82F6' : '#334155',
              transition: 'background 0.2s',
            }} />
          ))}
        </div>

        <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* ═══ STEP 1: Basic Info ═══ */}
          {step === 1 && (
            <>
              {/* Selfie */}
              <div>
                <label style={styles.label}>Selfie Photo <span style={{ color: '#EF4444' }}>*</span></label>
                {selfie ? (
                  <div style={styles.selfiePreview}>
                    <img src={selfie} alt="Selfie" style={styles.selfieImg} />
                    <button type="button" onClick={() => { setSelfie(null); setShowCamera(false); }} style={styles.removeSelfie}>Retake</button>
                  </div>
                ) : showCamera ? (
                  <CameraCapture onCapture={(data) => { setSelfie(data); setShowCamera(false); }} onClose={() => setShowCamera(false)} facingMode="user" label="Take Selfie" />
                ) : (
                  <button type="button" onClick={() => setShowCamera(true)} style={styles.cameraBtn}>Open Camera for Selfie</button>
                )}
              </div>

              <div>
                <label style={styles.label}>Full Name <span style={{ color: '#EF4444' }}>*</span></label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" style={styles.input} />
              </div>

              <div>
                <label style={styles.label}>Phone Number <span style={{ color: '#EF4444' }}>*</span></label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <span style={styles.prefix}>+91</span>
                  <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="9999000001" maxLength={10} style={{ ...styles.input, flex: 1 }} />
                </div>
                <p style={{ fontSize: 11, color: '#64748B', margin: '4px 0 0' }}>
                  This becomes your unique ID — your QR card will encode this number
                </p>
              </div>

              <div>
                <label style={styles.label}>Home Address</label>
                <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Your home address" style={styles.input} />
              </div>

              <div>
                <label style={styles.label}>State <span style={{ color: '#EF4444' }}>*</span></label>
                <select value={state} onChange={(e) => setState(e.target.value)} style={styles.input}>
                  {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div>
                <label style={styles.label}>GPS Location</label>
                <button type="button" onClick={detectLocation} style={styles.locationBtn}>
                  {locationStatus || 'Detect My Location'}
                </button>
              </div>

              <button type="button" onClick={() => {
                if (!name.trim()) return setError('Enter your name');
                if (!phone.trim() || phone.replace(/\D/g, '').length < 10) return setError('Enter valid phone number');
                if (!selfie) return setError('Take a selfie first');
                setError('');
                setStep(2);
              }} style={styles.submitBtn}>Next — Medical & Family</button>
            </>
          )}

          {/* ═══ STEP 2: Medical + Dependents ═══ */}
          {step === 2 && (
            <>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <label style={styles.label}>Blood Group</label>
                  <select value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)} style={styles.input}>
                    <option value="">Select</option>
                    {BLOOD_GROUPS.map(bg => <option key={bg} value={bg}>{bg}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={styles.label}>Disability</label>
                  <input type="text" value={disabilityStatus} onChange={(e) => setDisabilityStatus(e.target.value)} placeholder="None / details" style={styles.input} />
                </div>
              </div>

              <div>
                <label style={styles.label}>Medical Conditions</label>
                <input type="text" value={medicalConditions} onChange={(e) => setMedicalConditions(e.target.value)} placeholder="e.g. Diabetes, Heart condition" style={styles.input} />
              </div>

              <div>
                <label style={styles.label}>Current Medications</label>
                <input type="text" value={currentMedications} onChange={(e) => setCurrentMedications(e.target.value)} placeholder="e.g. Metformin, Insulin" style={styles.input} />
              </div>

              <div style={{ padding: '12px 14px', background: '#0F172A', borderRadius: 10, border: '1px solid #334155' }}>
                <label style={{ ...styles.label, marginBottom: 4 }}>Emergency Contact (outside affected area)</label>
                <p style={{ fontSize: 11, color: '#64748B', margin: '0 0 8px' }}>Someone who can be reached if local contacts are down</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input type="text" value={emergencyContactName} onChange={(e) => setEmergencyContactName(e.target.value)} placeholder="Name" style={{ ...styles.input, flex: 1 }} />
                  <input type="tel" value={emergencyContactPhone} onChange={(e) => setEmergencyContactPhone(e.target.value)} placeholder="Phone" style={{ ...styles.input, flex: 1 }} />
                </div>
              </div>

              {/* Dependents section */}
              <div style={{ padding: '14px', background: '#0F172A', borderRadius: 10, border: '1px solid #334155' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: dependents.length ? 12 : 0 }}>
                  <div>
                    <label style={{ ...styles.label, marginBottom: 2 }}>Family Members / Dependents</label>
                    <p style={{ fontSize: 11, color: '#64748B', margin: 0 }}>Children, elderly, spouse — anyone who may need to be found</p>
                  </div>
                  <button type="button" onClick={addDependent} style={styles.addBtn}>+ Add</button>
                </div>

                {dependents.map((dep, idx) => (
                  <div key={idx} style={{ padding: 12, background: '#1E293B', borderRadius: 8, marginBottom: 8, border: '1px solid #334155' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8' }}>Dependent {idx + 1}</span>
                      <button type="button" onClick={() => removeDependent(idx)} style={{ background: 'none', border: 'none', color: '#EF4444', fontSize: 12, cursor: 'pointer' }}>Remove</button>
                    </div>

                    {/* Dependent photo */}
                    {dep.photo ? (
                      <div style={{ ...styles.selfiePreview, marginBottom: 8, maxHeight: 120 }}>
                        <img src={dep.photo} alt="" style={{ ...styles.selfieImg, maxHeight: 120 }} />
                        <button type="button" onClick={() => updateDependent(idx, 'photo', null)} style={styles.removeSelfie}>Retake</button>
                      </div>
                    ) : dep.showCamera ? (
                      <div style={{ marginBottom: 8 }}>
                        <CameraCapture
                          onCapture={(data) => { updateDependent(idx, 'photo', data); updateDependent(idx, 'showCamera', false); }}
                          onClose={() => updateDependent(idx, 'showCamera', false)}
                          facingMode="environment"
                          label="Take Photo"
                        />
                      </div>
                    ) : (
                      <button type="button" onClick={() => updateDependent(idx, 'showCamera', true)}
                        style={{ ...styles.cameraBtn, padding: 10, fontSize: 12, marginBottom: 8 }}>
                        Take Photo of Dependent
                      </button>
                    )}

                    <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                      <input type="text" value={dep.name} onChange={e => updateDependent(idx, 'name', e.target.value)}
                        placeholder="Full name *" style={{ ...styles.input, fontSize: 13, padding: '8px 10px', flex: 2 }} />
                      <select value={dep.relationship} onChange={e => updateDependent(idx, 'relationship', e.target.value)}
                        style={{ ...styles.input, fontSize: 13, padding: '8px 10px', flex: 1 }}>
                        {RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                      <input type="number" value={dep.age} onChange={e => updateDependent(idx, 'age', e.target.value)}
                        placeholder="Age" style={{ ...styles.input, fontSize: 13, padding: '8px 10px', flex: 1 }} />
                      <select value={dep.gender} onChange={e => updateDependent(idx, 'gender', e.target.value)}
                        style={{ ...styles.input, fontSize: 13, padding: '8px 10px', flex: 1 }}>
                        <option value="">Gender</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                      <input type="number" value={dep.height_cm} onChange={e => updateDependent(idx, 'height_cm', e.target.value)}
                        placeholder="Height cm" style={{ ...styles.input, fontSize: 13, padding: '8px 10px', flex: 1 }} />
                    </div>
                    <input type="text" value={dep.identifying_marks} onChange={e => updateDependent(idx, 'identifying_marks', e.target.value)}
                      placeholder="Identifying marks (birthmarks, scars, etc.)" style={{ ...styles.input, fontSize: 13, padding: '8px 10px', marginBottom: 6 }} />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <select value={dep.blood_group} onChange={e => updateDependent(idx, 'blood_group', e.target.value)}
                        style={{ ...styles.input, fontSize: 13, padding: '8px 10px', flex: 1 }}>
                        <option value="">Blood</option>
                        {BLOOD_GROUPS.map(bg => <option key={bg} value={bg}>{bg}</option>)}
                      </select>
                      <input type="text" value={dep.medical_conditions} onChange={e => updateDependent(idx, 'medical_conditions', e.target.value)}
                        placeholder="Medical conditions" style={{ ...styles.input, fontSize: 13, padding: '8px 10px', flex: 2 }} />
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={() => setStep(1)} style={styles.backBtn}>Back</button>
                <button type="button" onClick={() => { setError(''); setStep(3); }} style={{ ...styles.submitBtn, flex: 1 }}>Next — Confirm</button>
              </div>
            </>
          )}

          {/* ═══ STEP 3: Consent & Submit ═══ */}
          {step === 3 && (
            <>
              {/* Summary */}
              <div style={{ padding: 14, background: '#0F172A', borderRadius: 10, border: '1px solid #334155' }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#94A3B8', margin: '0 0 8px' }}>Registration Summary</p>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
                  {selfie && <img src={selfie} alt="" style={{ width: 48, height: 48, borderRadius: 10, objectFit: 'cover' }} />}
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 700, color: '#F1F5F9', margin: 0 }}>{name}</p>
                    <p style={{ fontSize: 12, color: '#94A3B8', margin: '2px 0 0' }}>+91{phone} • {state}</p>
                  </div>
                </div>
                {bloodGroup && <p style={{ fontSize: 12, color: '#64748B', margin: '2px 0' }}>Blood: {bloodGroup}</p>}
                {medicalConditions && <p style={{ fontSize: 12, color: '#64748B', margin: '2px 0' }}>Medical: {medicalConditions}</p>}
                {emergencyContactName && <p style={{ fontSize: 12, color: '#64748B', margin: '2px 0' }}>Emergency: {emergencyContactName} ({emergencyContactPhone})</p>}
                {dependents.filter(d => d.name?.trim()).length > 0 && (
                  <p style={{ fontSize: 12, color: '#86EFAC', margin: '4px 0 0' }}>
                    {dependents.filter(d => d.name?.trim()).length} dependent(s): {dependents.filter(d => d.name?.trim()).map(d => d.name).join(', ')}
                  </p>
                )}
              </div>

              {/* Consent */}
              <div style={{ padding: 14, background: '#0F172A', borderRadius: 10, border: consent ? '1px solid rgba(34,197,94,0.3)' : '1px solid #334155' }}>
                <label style={{ display: 'flex', gap: 10, cursor: 'pointer', alignItems: 'flex-start' }}>
                  <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)}
                    style={{ marginTop: 3, accentColor: '#3B82F6', width: 18, height: 18 }} />
                  <span style={{ fontSize: 13, color: '#E2E8F0', lineHeight: 1.5 }}>
                    I consent to my photo, phone number, and personal details being stored and used for
                    <strong> disaster rescue and family reunification</strong> purposes. My photo may be matched
                    against missing person reports to help locate me or my dependents during emergencies.
                  </span>
                </label>
              </div>

              {error && <p style={{ color: '#EF4444', fontSize: 13, margin: 0 }}>{error}</p>}

              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={() => setStep(2)} style={styles.backBtn}>Back</button>
                <button type="submit" disabled={loading || !consent} style={{
                  ...styles.submitBtn, flex: 1,
                  opacity: (loading || !consent) ? 0.5 : 1,
                  cursor: (loading || !consent) ? 'not-allowed' : 'pointer',
                }}>
                  {loading ? 'Registering...' : 'Register & Get QR Card'}
                </button>
              </div>
            </>
          )}

          {error && step !== 3 && <p style={{ color: '#EF4444', fontSize: 13, margin: 0 }}>{error}</p>}
        </form>

        <div style={{ textAlign: 'center', marginTop: 14 }}>
          <a href="/" style={{ fontSize: 13, color: '#64748B', textDecoration: 'none' }}>
            ← Back to Home
          </a>
        </div>
      </div>
    </div>
  );
}

function compressImg(base64, maxWidth = 480, quality = 0.7) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, maxWidth / img.width);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(base64);
    img.src = base64;
  });
}

const styles = {
  page: {
    minHeight: '100vh', background: '#0F172A', display: 'flex', alignItems: 'center',
    justifyContent: 'center', padding: 24, fontFamily: 'system-ui, sans-serif',
  },
  card: {
    width: '100%', maxWidth: 440, background: '#1E293B', border: '1px solid #334155',
    borderRadius: 16, padding: 28, color: '#E2E8F0',
  },
  logo: {
    width: 44, height: 44, borderRadius: 12, display: 'inline-flex', alignItems: 'center',
    justifyContent: 'center', fontWeight: 800, fontSize: 20, color: 'white',
    background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)',
  },
  label: { display: 'block', fontSize: 13, fontWeight: 600, color: '#94A3B8', marginBottom: 6 },
  input: {
    width: '100%', padding: '12px 14px', background: '#0F172A', border: '1px solid #334155',
    borderRadius: 10, color: '#E2E8F0', fontSize: 15, outline: 'none', boxSizing: 'border-box',
  },
  prefix: {
    display: 'flex', alignItems: 'center', padding: '0 14px', background: '#0F172A',
    border: '1px solid #334155', borderRadius: 10, color: '#94A3B8', fontWeight: 600, fontSize: 15,
  },
  locationBtn: {
    width: '100%', padding: 12, background: '#0F172A', border: '1px dashed #334155',
    borderRadius: 10, color: '#94A3B8', fontSize: 14, cursor: 'pointer', textAlign: 'center',
  },
  cameraBtn: {
    width: '100%', padding: 14, background: '#0F172A', border: '2px dashed #334155',
    borderRadius: 12, color: '#94A3B8', fontSize: 14, cursor: 'pointer', textAlign: 'center',
  },
  selfiePreview: { position: 'relative', borderRadius: 12, overflow: 'hidden' },
  selfieImg: { width: '100%', maxHeight: 200, objectFit: 'cover', display: 'block', borderRadius: 12 },
  removeSelfie: {
    position: 'absolute', top: 8, right: 8, padding: '6px 12px', background: 'rgba(0,0,0,0.7)',
    border: 'none', borderRadius: 8, color: 'white', fontSize: 12, cursor: 'pointer',
  },
  submitBtn: {
    width: '100%', padding: 14, background: 'linear-gradient(135deg, #3B82F6, #2563EB)',
    color: 'white', border: 'none', borderRadius: 10, fontSize: 16, fontWeight: 700, cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(59,130,246,0.3)',
  },
  backBtn: {
    padding: '14px 20px', background: '#334155', color: '#E2E8F0', border: 'none',
    borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
  addBtn: {
    padding: '6px 14px', background: 'rgba(59,130,246,0.15)', color: '#93C5FD',
    border: '1px solid rgba(59,130,246,0.3)', borderRadius: 8, fontSize: 13,
    fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
  },
  successIcon: {
    width: 64, height: 64, borderRadius: '50%', background: 'rgba(34,197,94,0.15)',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  qrSection: {
    padding: 20, background: '#0F172A', borderRadius: 12, border: '1px solid #334155', marginTop: 8,
  },
  qrBox: {
    display: 'inline-block', padding: 16, background: 'white', borderRadius: 12,
  },
  primaryLink: {
    flex: 1, display: 'inline-block', padding: '12px 20px', textAlign: 'center',
    background: 'linear-gradient(135deg, #3B82F6, #2563EB)', color: 'white',
    borderRadius: 10, fontWeight: 600, textDecoration: 'none', fontSize: 14,
  },
  secondaryLink: {
    flex: 1, display: 'inline-block', padding: '12px 20px', textAlign: 'center',
    background: '#334155', color: '#E2E8F0', borderRadius: 10, fontWeight: 600,
    textDecoration: 'none', fontSize: 14,
  },
};
