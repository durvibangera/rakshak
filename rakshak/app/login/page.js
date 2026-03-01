/**
 * FILE: page.js (User Login)
 * PURPOSE: Phone-based login for registered users.
 *          Looks up user by phone number — no OTP needed.
 *
 * FLOW: Enter phone → POST /api/auth/phone-login → Dashboard
 *
 * ROLE ACCESS: Public (unauthenticated)
 */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

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

      // Store session info for AuthContext
      localStorage.setItem('rakshak_phone', fullPhone);
      localStorage.setItem('rakshak_user', JSON.stringify(data.user));
      if (data.camp) {
        localStorage.setItem('rakshak_camp', JSON.stringify(data.camp));
      }

      router.push('/user/dashboard');
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div style={s.page}>
      <div style={s.card}>
        <button onClick={() => router.push('/')} style={s.backLink}>← Back to Rakshak</button>

        <div style={s.headerRow}>
          <div style={s.logoBadge}>R</div>
          <div>
            <h1 style={s.heading}>User Login</h1>
            <p style={s.subheading}>Login with your registered phone number</p>
          </div>
        </div>

        {/* Admin login link */}
        <button
          onClick={() => router.push('/admin-login')}
          style={s.switchLink}
        >
          Admin or Camp Staff? Login here →
        </button>

        <form onSubmit={handleLogin} style={s.form}>
          <div>
            <label style={s.label}>Phone Number</label>
            <div style={s.inputRow}>
              <span style={s.prefix}>+91</span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
                placeholder="9876543210"
                maxLength={10}
                style={s.input}
                autoFocus
              />
            </div>
            <p style={s.inputHint}>
              The number you used during registration
            </p>
          </div>

          {error && (
            <div style={s.errorBox}>
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <button type="submit" disabled={loading} style={{ ...s.submitBtn, opacity: loading ? 0.6 : 1 }}>
            {loading ? (
              <span style={s.loadingRow}>
                <span style={s.spinner} />
                Verifying...
              </span>
            ) : 'Login'}
          </button>
        </form>

        {/* Register link */}
        <div style={s.footer}>
          <p style={s.footerText}>
            Not registered yet?{' '}
            <button onClick={() => router.push('/register')} style={s.linkBtn}>
              Register now →
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

const s = {
  page: {
    minHeight: '100vh', background: '#0F172A', display: 'flex', alignItems: 'center',
    justifyContent: 'center', padding: 24, fontFamily: 'system-ui, sans-serif',
  },
  card: {
    width: '100%', maxWidth: 440, background: '#1E293B', border: '1px solid #334155',
    borderRadius: 16, padding: 28, color: '#E2E8F0',
  },
  backLink: {
    background: 'none', border: 'none', color: '#64748B', fontSize: 13,
    cursor: 'pointer', padding: 0, marginBottom: 16, display: 'block',
  },
  headerRow: {
    display: 'flex', gap: 14, alignItems: 'center', marginBottom: 16,
  },
  logoBadge: {
    width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontWeight: 800, fontSize: 20, color: 'white',
    background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)', flexShrink: 0,
  },
  heading: { fontSize: 22, fontWeight: 800, color: '#F1F5F9', margin: '0 0 2px' },
  subheading: { fontSize: 13, color: '#94A3B8', margin: 0 },
  switchLink: {
    background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)',
    borderRadius: 8, padding: '8px 14px', color: '#60A5FA', fontSize: 13,
    cursor: 'pointer', width: '100%', textAlign: 'center', marginBottom: 20,
  },
  form: { display: 'flex', flexDirection: 'column', gap: 16 },
  label: { display: 'block', fontSize: 13, fontWeight: 600, color: '#94A3B8', marginBottom: 6 },
  inputRow: {
    display: 'flex', alignItems: 'center', background: '#0F172A', borderRadius: 10,
    border: '1px solid #334155', overflow: 'hidden',
  },
  prefix: {
    padding: '13px 12px 13px 14px', color: '#64748B', fontWeight: 600, fontSize: 15,
    borderRight: '1px solid #334155', background: 'rgba(51,65,85,0.3)',
  },
  input: {
    flex: 1, padding: '13px 14px', background: 'transparent', border: 'none',
    color: '#F1F5F9', fontSize: 16, outline: 'none',
  },
  inputHint: { fontSize: 11, color: '#64748B', margin: '6px 0 0' },
  errorBox: {
    display: 'flex', gap: 8, alignItems: 'center', padding: '10px 14px',
    background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
    borderRadius: 10, color: '#FCA5A5', fontSize: 13,
  },
  submitBtn: {
    width: '100%', padding: 14, background: 'linear-gradient(135deg, #3B82F6, #2563EB)',
    color: 'white', border: 'none', borderRadius: 10, fontSize: 16, fontWeight: 700,
    cursor: 'pointer', boxShadow: '0 4px 14px rgba(59,130,246,0.3)',
  },
  loadingRow: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
  spinner: {
    width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.6s linear infinite',
  },
  footer: {
    marginTop: 24, paddingTop: 16, borderTop: '1px solid #334155', textAlign: 'center',
  },
  footerText: { fontSize: 13, color: '#64748B', margin: 0 },
  linkBtn: {
    background: 'none', border: 'none', color: '#3B82F6', fontSize: 13,
    cursor: 'pointer', padding: 0, fontWeight: 600,
  },
};
