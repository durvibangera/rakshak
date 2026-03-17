// admin login page
'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';

const FONT = '"DM Sans", "Instrument Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const ROLE_OPTIONS = [
  {
    id: 'super_admin',
    label: 'Super Admin',
    desc: 'Nationwide oversight — all camps, all reports',
    authType: 'email',
    redirect: '/super-admin/dashboard',
    color: '#7C3AED',
    bg: '#F5F3FF',
    border: '#DDD6FE',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
  },
  {
    id: 'camp_admin',
    label: 'Camp Admin',
    desc: 'Manage your camp — victims, resources, evacuations',
    authType: 'email',
    redirect: '/camp/dashboard',
    color: '#1B3676',
    bg: '#EEF2FF',
    border: '#C7D2FE',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1B3676" strokeWidth="2">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    id: 'operator',
    label: 'Operator',
    desc: 'QR check-in & help find missing people',
    authType: 'campcode',
    redirect: '/operator/dashboard',
    color: '#059669',
    bg: '#ECFDF5',
    border: '#A7F3D0',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
        <rect x="3" y="14" width="7" height="7"/>
        <line x1="14" y1="14" x2="14" y2="21"/><line x1="14" y1="14" x2="21" y2="14"/>
        <line x1="21" y1="17" x2="21" y2="21"/><line x1="17" y1="21" x2="21" y2="21"/>
      </svg>
    ),
  },
];

export default function AdminLoginPage() {
  const router = useRouter();
  const { refreshProfile } = useAuth();
  const [selectedRole, setSelectedRole] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [campCode, setCampCode] = useState('');
  const [operatorPhone, setOperatorPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setError('');
    if (!email || !password) return setError('Enter email and password');
    setLoading(true);

    const doEmailLogin = async () => {
      const { data, error: authErr } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (authErr) throw authErr;
      if (selectedRole.id === 'camp_admin') {
        // Fetch camp assignment in background, don't block login
        supabase.from('users').select('assigned_camp_id').eq('auth_uid', data.user.id).maybeSingle()
          .then(({ data: profile }) => {
            if (profile?.assigned_camp_id) localStorage.setItem('sahaay_camp_id', profile.assigned_camp_id);
          });
      }
      router.push(selectedRole.redirect);
    };

    try {
      await doEmailLogin();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };


  const handleOperatorLogin = async (e) => {
    e.preventDefault();
    setError('');
    if (!campCode || !operatorPhone) return setError('Enter camp code and your phone number');
    setLoading(true);
    try {
      // Only validate camp code via local API — skip Supabase user lookup entirely
      const controller = new AbortController();
      const fetchTimer = setTimeout(() => controller.abort(), 8000);
      let res;
      try {
        res = await fetch(`/api/camps?code=${campCode.trim().toUpperCase()}`, { signal: controller.signal });
      } catch (fetchErr) {
        throw new Error('Could not reach server. Check your connection.');
      } finally {
        clearTimeout(fetchTimer);
      }

      const campData = await res.json();
      if (!campData.camp) throw new Error('Invalid camp code');

      const fullPhone = operatorPhone.startsWith('+91') ? operatorPhone : `+91${operatorPhone.replace(/\D/g, '')}`;
      // Store credentials and navigate — RoleGate will verify role from AuthContext
      localStorage.setItem('sahaay_phone', fullPhone);
      localStorage.setItem('sahaay_camp_id', campData.camp.id);
      localStorage.setItem('sahaay_camp_name', campData.camp.name);
      router.push('/operator/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const role = selectedRole;

  return (
    <div style={s.page}>
      <div style={s.bgPattern} />

      {/* Top bar */}
      <div style={s.topBar}>
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
              <img src="/logo-light.png" alt="Sahaay" style={{ height: 68, width: 'auto', objectFit: 'contain' }} />
            </div>
            <div>
              <p style={s.eyebrow}>Staff & Admin Portal</p>
              <h1 style={s.heading}>Admin Login</h1>
            </div>
          </div>
          <p style={s.subheading}>Select your role to see the appropriate login form.</p>

          {/* Role selector */}
          <div style={s.roleList}>
            {ROLE_OPTIONS.map(r => {
              const isSelected = selectedRole?.id === r.id;
              return (
                <button
                  key={r.id}
                  onClick={() => { setSelectedRole(r); setError(''); }}
                  style={{
                    ...s.roleCard,
                    ...(isSelected ? { ...s.roleCardActive, borderColor: r.border, background: r.bg } : {}),
                  }}
                >
                  <div style={{ ...s.roleIconWrap, background: isSelected ? r.bg : '#F8FAFC', border: `1px solid ${isSelected ? r.border : '#E2E8F0'}` }}>
                    {r.icon}
                  </div>
                  <div style={s.roleText}>
                    <p style={{ ...s.roleLabel, color: isSelected ? r.color : '#111827' }}>{r.label}</p>
                    <p style={s.roleDesc}>{r.desc}</p>
                  </div>
                  <div style={{ ...s.roleRadio, ...(isSelected ? { ...s.roleRadioActive, background: r.color, borderColor: r.color } : {}) }}>
                    {isSelected && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Divider */}
          {selectedRole && (
            <div style={s.divider}>
              <div style={s.dividerLine} />
              <span style={s.dividerLabel}>
                {role.label} Login
              </span>
              <div style={s.dividerLine} />
            </div>
          )}

          {/* Email/password form */}
          {selectedRole?.authType === 'email' && (
            <form onSubmit={handleEmailLogin} style={s.form}>
              <div>
                <div style={s.labelRow}>
                  <label style={s.label}>Email Address</label>
                </div>
                <div style={s.inputWrap}>
                  <div style={s.inputIconLeft}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                      <polyline points="22,6 12,13 2,6"/>
                    </svg>
                  </div>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@organisation.com" style={s.inputWithIcon} autoComplete="email" />
                </div>
              </div>

              <div>
                <div style={s.labelRow}>
                  <label style={s.label}>Password</label>
                </div>
                <div style={s.inputWrap}>
                  <div style={s.inputIconLeft}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                      <path d="M7 11V7a5 5 0 0110 0v4"/>
                    </svg>
                  </div>
                  <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={s.inputWithIconBoth} />
                  <button type="button" onClick={() => setShowPassword(v => !v)} style={s.inputIconRight}>
                    {showPassword ? (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    ) : (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    )}
                  </button>
                </div>
              </div>

              {error && <ErrorBox message={error} />}

              <button type="submit" disabled={loading} style={{ ...s.submitBtn, background: role.color, opacity: loading ? 0.7 : 1 }}>
                {loading ? <><span style={s.spinner} /> Logging in…</> : <>Login as {role.label} <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg></>}
              </button>
            </form>
          )}

          {/* Camp code / operator form */}
          {selectedRole?.authType === 'campcode' && (
            <form onSubmit={handleOperatorLogin} style={s.form}>
              <div>
                <div style={s.labelRow}>
                  <label style={s.label}>Camp Code</label>
                  <span style={s.labelHint}>Get this from your Camp Admin</span>
                </div>
                <div style={s.inputWrap}>
                  <div style={s.inputIconLeft}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
                      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
                    </svg>
                  </div>
                  <input type="text" value={campCode} onChange={e => setCampCode(e.target.value.toUpperCase())} placeholder="e.g. MH-CAMP-01" maxLength={20} style={s.inputWithIcon} />
                </div>
              </div>

              <div>
                <div style={s.labelRow}>
                  <label style={s.label}>Your Phone Number</label>
                </div>
                <div style={s.phoneRow}>
                  <div style={s.phonePrefix}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2A19.79 19.79 0 013.07 8.81 2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
                    <span style={s.phonePrefixText}>+91</span>
                  </div>
                  <input type="tel" value={operatorPhone} onChange={e => setOperatorPhone(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))} placeholder="9876543210" maxLength={10} style={s.phoneInput} />
                  {operatorPhone.replace(/\D/g, '').length === 10 && (
                    <div style={s.phoneCheck}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                  )}
                </div>
              </div>

              {error && <ErrorBox message={error} />}

              <button type="submit" disabled={loading} style={{ ...s.submitBtn, background: role.color, opacity: loading ? 0.7 : 1 }}>
                {loading ? <><span style={s.spinner} /> Verifying…</> : <>Login as Operator <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg></>}
              </button>
            </form>
          )}

          {!selectedRole && (
            <div style={s.noRoleHint}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              Select a role above to see the login form
            </div>
          )}

          {/* Footer */}
          <div style={s.footer}>
            <div style={s.footerDivider} />
            <p style={s.footerText}>
              Not a staff member?{' '}
              <Link href="/login" style={s.footerLink}>Civilian login →</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ErrorBox({ message }) {
  return (
    <div style={sc.errorBox}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.5">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      {message}
    </div>
  );
}

const s = {
  page: { minHeight: '100vh', background: '#F1F5F9', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', fontFamily: FONT, position: 'relative' },
  bgPattern: { position: 'fixed', inset: 0, backgroundImage: 'radial-gradient(#CBD5E1 1px, transparent 1px)', backgroundSize: '28px 28px', opacity: 0.45, pointerEvents: 'none', zIndex: 0 },

  topBar: { width: '100%', maxWidth: 460, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, position: 'relative', zIndex: 1 },
  topBarBrand: { display: 'flex', alignItems: 'center', gap: 7 },
  topBarName: { fontSize: 16, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.3px' },
  topBarBack: { display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: '#6B7280', textDecoration: 'none' },

  card: { width: '100%', maxWidth: 460, background: 'white', border: '1px solid #E2E8F0', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.07)', overflow: 'hidden', position: 'relative', zIndex: 1 },
  cardStripe: { height: 4, background: 'linear-gradient(90deg, #152C62, #1B3676, #4169C4)' },
  cardBody: { padding: '24px 28px 28px' },

  cardHeader: { display: 'flex', alignItems: 'center', gap: 18, marginBottom: 10 },
  logoWrap: { width: 80, height: 80, borderRadius: 16, background: 'linear-gradient(135deg, #EEF2FF 0%, #E8EEFF 100%)', border: '1.5px solid #C7D2FE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 8px rgba(27,54,118,0.08)' },
  eyebrow: { fontSize: 11, fontWeight: 600, color: '#1B3676', textTransform: 'uppercase', letterSpacing: '0.8px', margin: '0 0 3px' },
  heading: { fontSize: 22, fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.5px' },
  subheading: { fontSize: 13.5, color: '#6B7280', lineHeight: 1.6, margin: '0 0 20px' },

  roleList: { display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 4 },
  roleCard: { display: 'flex', gap: 12, alignItems: 'center', padding: '13px 14px', background: 'white', border: '1px solid #E2E8F0', borderRadius: 11, cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left', fontFamily: FONT, width: '100%' },
  roleCardActive: { boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  roleIconWrap: { width: 40, height: 40, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' },
  roleText: { flex: 1 },
  roleLabel: { fontSize: 14, fontWeight: 700, margin: '0 0 2px', transition: 'color 0.15s' },
  roleDesc: { fontSize: 12.5, color: '#6B7280', margin: 0 },
  roleRadio: { width: 20, height: 20, borderRadius: '50%', border: '2px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' },
  roleRadioActive: { border: '2px solid transparent' },

  divider: { display: 'flex', alignItems: 'center', gap: 10, margin: '20px 0' },
  dividerLine: { flex: 1, height: 1, background: '#E2E8F0' },
  dividerLabel: { fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.7px', whiteSpace: 'nowrap' },

  form: { display: 'flex', flexDirection: 'column', gap: 14 },
  labelRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 },
  label: { fontSize: 13, fontWeight: 600, color: '#374151' },
  labelHint: { fontSize: 11.5, color: '#9CA3AF' },

  inputWrap: { display: 'flex', alignItems: 'center', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden' },
  inputIconLeft: { padding: '0 12px', display: 'flex', alignItems: 'center', flexShrink: 0 },
  inputWithIcon: { flex: 1, padding: '12px 13px 12px 0', background: 'transparent', border: 'none', color: '#0F172A', fontSize: 14.5, outline: 'none', fontFamily: FONT },
  inputWithIconBoth: { flex: 1, padding: '12px 0', background: 'transparent', border: 'none', color: '#0F172A', fontSize: 14.5, outline: 'none', fontFamily: FONT },
  inputIconRight: { padding: '0 13px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' },

  phoneRow: { display: 'flex', alignItems: 'center', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden' },
  phonePrefix: { display: 'flex', alignItems: 'center', gap: 5, padding: '12px 12px', borderRight: '1px solid #E2E8F0', background: '#F1F5F9', flexShrink: 0 },
  phonePrefixText: { fontSize: 14, fontWeight: 700, color: '#475569' },
  phoneInput: { flex: 1, padding: '12px 13px', background: 'transparent', border: 'none', color: '#0F172A', fontSize: 15, outline: 'none', fontFamily: FONT },
  phoneCheck: { paddingRight: 12, display: 'flex', alignItems: 'center' },

  submitBtn: { width: '100%', padding: '13px', color: 'white', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: FONT, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, transition: 'opacity 0.15s', boxShadow: '0 2px 10px rgba(0,0,0,0.15)' },
  spinner: { width: 17, height: 17, border: '2.5px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block', flexShrink: 0 },

  noRoleHint: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontSize: 13.5, color: '#9CA3AF', padding: '16px 0', textAlign: 'center' },

  footer: { marginTop: 22 },
  footerDivider: { height: 1, background: '#F1F5F9', marginBottom: 16 },
  footerText: { fontSize: 13.5, color: '#6B7280', margin: 0, textAlign: 'center' },
  footerLink: { color: '#1B3676', fontWeight: 700, textDecoration: 'none' },
};

const sc = {
  errorBox: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 13px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 9, color: '#DC2626', fontSize: 13.5 },
};
