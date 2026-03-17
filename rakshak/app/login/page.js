'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const FONT = '"DM Sans", "Instrument Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    const digits = phone.replace(/\D/g, '');
    if (digits.length !== 10) return setError('Enter a valid 10-digit phone number');

    const fullPhone = `+91${digits}`;
    setLoading(true);
    try {
      const res = await fetch('/api/auth/phone-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: fullPhone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      localStorage.setItem('sahaay_phone', fullPhone);
      localStorage.setItem('sahaay_user', JSON.stringify(data.user));
      if (data.camp) localStorage.setItem('sahaay_camp', JSON.stringify(data.camp));
      router.push('/user/dashboard');
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div style={s.page}>

      {/* Subtle background rings */}
      <div style={s.bgPattern} aria-hidden="true">
        {[...Array(5)].map((_, i) => (
          <div key={i} style={{ ...s.bgRing, width: 180 + i * 130, height: 180 + i * 130 }} />
        ))}
      </div>

      {/* Top bar */}
      <header style={s.topBar}>
        <button onClick={() => router.push('/')} style={s.backBtn}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Back to Sahaay
        </button>

      </header>

      {/* Card */}
      <div style={s.card}>
        <div style={s.cardStripe} />

        <div style={s.cardBody}>

          {/* Header */}
          <div style={s.header}>
            <div style={s.logoWrap}>
              <img src="/logo-light.png" alt="Sahaay" style={{ height: 72, width: 'auto', objectFit: 'contain' }} />
            </div>
            <div>
              <p style={s.eyebrow}>Civilian Access</p>
              <h1 style={s.title}>Sign In</h1>
              <p style={s.subtitle}>Use the phone number from your registration</p>
            </div>
          </div>

          {/* Admin switch banner */}
          <button onClick={() => router.push('/admin-login')} style={s.switchBanner}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 00-3-3.87"/>
              <path d="M16 3.13a4 4 0 010 7.75"/>
            </svg>
            Admin or Camp Staff? Login here
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginLeft: 'auto' }}>
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>

          {/* Form */}
          <form onSubmit={handleLogin} style={s.form}>
            <div>
              <label style={s.label}>Phone Number</label>
              <div style={{ ...s.inputRow, ...(error ? s.inputRowError : {}) }}>
                <div style={s.prefix}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
                    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 8.81a19.79 19.79 0 01-3.07-8.7A2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
                  </svg>
                  <span style={s.prefixText}>+91</span>
                </div>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => {
                    setError('');
                    setPhone(e.target.value.replace(/[^0-9]/g, '').slice(0, 10));
                  }}
                  placeholder="98765 43210"
                  maxLength={10}
                  style={s.input}
                  autoFocus
                />
                {phone.length === 10 && !error && (
                  <div style={s.inputTick}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </div>
                )}
              </div>
              <p style={s.inputHint}>10-digit mobile number registered with Sahaay</p>
            </div>

            {error && (
              <div style={s.errorBox}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} style={{ ...s.submitBtn, opacity: loading ? 0.75 : 1 }}>
              {loading ? (
                <>
                  <span style={s.spinner} />
                  Verifying…
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4"/>
                    <polyline points="10 17 15 12 10 7"/>
                    <line x1="15" y1="12" x2="3" y2="12"/>
                  </svg>
                  Sign In to Dashboard
                </>
              )}
            </button>
          </form>

          {/* Divider + Register */}
          <div style={s.divider}>
            <div style={s.dividerLine}/>
            <span style={s.dividerLabel}>New to Sahaay?</span>
            <div style={s.dividerLine}/>
          </div>

          <button onClick={() => router.push('/register')} style={s.registerBtn}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <line x1="19" y1="8" x2="19" y2="14"/>
              <line x1="22" y1="11" x2="16" y2="11"/>
            </svg>
            Create a new account →
          </button>
        </div>

        {/* Card footer */}
        <div style={s.cardFooter}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0110 0v4"/>
          </svg>
          Protected under India's Disaster Management Act, 2005
        </div>
      </div>

      {/* Helpline */}
      <div style={s.helpline}>
        Need help? National helpline:&nbsp;
        <a href="tel:1078" style={s.helplineNum}>1078</a>
        &nbsp;· Available 24×7
      </div>

    </div>
  );
}

const s = {
  page: {
    minHeight: '100vh',
    background: '#F1F5F9',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 16px',
    fontFamily: FONT,
    position: 'relative',
    overflow: 'hidden',
  },

  bgPattern: {
    position: 'fixed', top: '50%', left: '50%',
    pointerEvents: 'none', zIndex: 0,
  },
  bgRing: {
    position: 'absolute',
    borderRadius: '50%',
    border: '1px solid #1B3676',
    opacity: 0.04,
    transform: 'translate(-50%, -50%)',
  },

  topBar: {
    width: '100%', maxWidth: 460,
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 18, position: 'relative', zIndex: 1,
  },
  backBtn: {
    display: 'flex', alignItems: 'center', gap: 5,
    background: 'none', border: 'none',
    fontSize: 13, fontWeight: 500, color: '#6B7280',
    cursor: 'pointer', padding: 0, fontFamily: FONT,
  },
  topLogo: { display: 'flex', alignItems: 'center', gap: 7 },
  topLogoText: { fontSize: 15, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.3px' },

  card: {
    width: '100%', maxWidth: 460,
    background: 'white',
    border: '1px solid #E2E8F0',
    borderRadius: 16,
    boxShadow: '0 4px 24px rgba(0,0,0,0.07)',
    overflow: 'hidden',
    position: 'relative', zIndex: 1,
  },
  cardStripe: {
    height: 4,
    background: 'linear-gradient(90deg, #1B3676, #2A5298, #4169C4)',
  },
  cardBody: { padding: '28px 28px 24px' },

  logoWrap: {
    width: 84, height: 84, borderRadius: 18,
    background: 'linear-gradient(135deg, #EEF2FF 0%, #E8EEFF 100%)',
    border: '1.5px solid #C7D2FE',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
    boxShadow: '0 2px 8px rgba(27,54,118,0.08)',
  },
  header: { display: 'flex', gap: 18, alignItems: 'center', marginBottom: 22 },
  eyebrow: { fontSize: 11, fontWeight: 600, color: '#1B3676', textTransform: 'uppercase', letterSpacing: '0.8px', margin: '0 0 4px' },
  title: { fontSize: 22, fontWeight: 800, color: '#0F172A', margin: '0 0 4px', letterSpacing: '-0.4px' },
  subtitle: { fontSize: 13, color: '#6B7280', margin: 0 },

  switchBanner: {
    width: '100%', display: 'flex', alignItems: 'center', gap: 8,
    padding: '10px 14px', marginBottom: 22,
    background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: 9,
    fontSize: 13, fontWeight: 500, color: '#152C62',
    cursor: 'pointer', fontFamily: FONT,
  },

  form: { display: 'flex', flexDirection: 'column', gap: 16 },
  label: { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 7 },

  inputRow: {
    display: 'flex', alignItems: 'center',
    background: '#F8FAFC', border: '1.5px solid #E2E8F0',
    borderRadius: 10, overflow: 'hidden',
  },
  inputRowError: { borderColor: '#FECACA', background: '#FFF5F5' },
  prefix: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '0 12px 0 14px', height: 48,
    borderRight: '1.5px solid #E2E8F0',
    background: '#F1F5F9', flexShrink: 0,
  },
  prefixText: { fontSize: 14, fontWeight: 700, color: '#374151' },
  input: {
    flex: 1, padding: '0 14px', height: 48,
    background: 'transparent', border: 'none', outline: 'none',
    fontSize: 16, fontWeight: 500, color: '#0F172A',
    fontFamily: FONT, letterSpacing: '0.5px',
  },
  inputTick: { padding: '0 12px', display: 'flex', alignItems: 'center' },
  inputHint: { fontSize: 12, color: '#9CA3AF', margin: '6px 0 0' },

  errorBox: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '10px 14px',
    background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 9,
    fontSize: 13, color: '#DC2626', fontWeight: 500,
  },

  submitBtn: {
    width: '100%', height: 48,
    background: '#1B3676', color: 'white', border: 'none',
    borderRadius: 10, fontSize: 15, fontWeight: 700,
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    boxShadow: '0 2px 10px rgba(37,99,235,0.25)',
    fontFamily: FONT, transition: 'opacity 0.15s',
  },
  spinner: {
    width: 17, height: 17,
    border: '2.5px solid rgba(255,255,255,0.3)',
    borderTopColor: 'white', borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
    display: 'inline-block', flexShrink: 0,
  },

  divider: { display: 'flex', alignItems: 'center', gap: 10, margin: '22px 0 14px' },
  dividerLine: { flex: 1, height: 1, background: '#F1F5F9' },
  dividerLabel: { fontSize: 12, color: '#9CA3AF', whiteSpace: 'nowrap', fontWeight: 500 },

  registerBtn: {
    width: '100%', height: 44,
    background: 'white', border: '1.5px solid #E2E8F0', borderRadius: 10,
    fontSize: 14, fontWeight: 600, color: '#374151',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
    fontFamily: FONT,
  },

  cardFooter: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: '11px 28px',
    background: '#F8FAFC', borderTop: '1px solid #F1F5F9',
    fontSize: 11.5, color: '#9CA3AF',
  },

  helpline: {
    display: 'flex', alignItems: 'center',
    marginTop: 18, fontSize: 12.5, color: '#6B7280',
    position: 'relative', zIndex: 1,
  },
  helplineNum: { fontWeight: 700, color: '#1B3676', textDecoration: 'none' },
};
