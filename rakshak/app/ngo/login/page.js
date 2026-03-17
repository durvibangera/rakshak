/**
 * FILE: page.js (NGO Admin Login)
 * PURPOSE: Email/password login for NGO administrators.
 *
 * FLOW: Enter email + password → POST /api/auth/ngo → Verified as NGO admin → Redirect to /ngo/portal
 *
 * ROLE ACCESS: Public (unauthenticated)
 */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

const FONT = '"DM Sans", "Instrument Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export default function NGOLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    if (!email || !password) return setError('Enter email and password');

    setLoading(true);
    try {
      const { data, error: authErr } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authErr) throw authErr;

      const { data: profile } = await supabase
        .from('users')
        .select('role, name')
        .eq('auth_uid', data.user.id)
        .single();

      if (!profile) {
        const { data: byId } = await supabase
          .from('users')
          .select('role, name')
          .eq('id', data.user.id)
          .single();

        if (!byId) {
          await supabase.auth.signOut();
          throw new Error('No profile found. Contact your Super Admin.');
        }
        if (byId.role !== 'ngo_admin') {
          await supabase.auth.signOut();
          throw new Error(`This account is registered as "${byId.role}", not an NGO admin.`);
        }
      } else if (profile.role !== 'ngo_admin') {
        await supabase.auth.signOut();
        throw new Error(`This account is registered as "${profile.role}", not an NGO admin.`);
      }

      router.push('/ngo/portal');
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F1F5F9', fontFamily: FONT, color: '#111827' }}>

      {/* Nav */}
      <header style={s.nav}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center' }}>
          <img src="/logo-light.png" alt="Sahaay" style={{ height: 52, width: 'auto', objectFit: 'contain' }} />
        </Link>
        <Link href="/" style={s.backBtn}>← Back to Home</Link>
      </header>

      {/* Centered card */}
      <div style={s.body}>
        <div style={s.card}>

          {/* Header */}
          <div style={s.cardTop}>
            <div style={s.iconWrap}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1B3676" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 00-3-3.87"/>
                <path d="M16 3.13a4 4 0 010 7.75"/>
              </svg>
            </div>
            <div>
              <p style={s.eyebrow}>NGO Portal</p>
              <h1 style={s.heading}>NGO Admin Login</h1>
            </div>
          </div>

          <p style={s.subheading}>
            Sign in to manage assignments, fundraising and kit dispatches
          </p>

          {/* Switch links */}
          <div style={s.switchRow}>
            <button onClick={() => router.push('/login')} style={s.switchBtn}>
              Victim login →
            </button>
            <button onClick={() => router.push('/admin-login')} style={s.switchBtn}>
              Admin / Staff →
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} style={s.form}>
            <div>
              <label style={s.label}>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="ngo-admin@organization.com"
                style={s.input}
                autoFocus
              />
            </div>
            <div>
              <label style={s.label}>Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                style={s.input}
              />
            </div>

            {error && (
              <div style={s.errorBox}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} style={{ ...s.submitBtn, opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Signing in…' : 'Login as NGO Admin'}
            </button>
          </form>

          {/* Info box */}
          <div style={s.infoBox}>
            <p style={{ fontSize: 13, color: '#6B7280', margin: 0, lineHeight: 1.6 }}>
              <strong style={{ color: '#374151' }}>How to get access:</strong> Your organization must be registered by a Super Admin
              in the Sahaay system. Once registered, you&apos;ll receive login credentials via email.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

const s = {
  nav: {
    background: 'white', borderBottom: '1px solid #E2E8F0', padding: '0 40px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    height: 72, position: 'sticky', top: 0, zIndex: 200,
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  },
  backBtn: {
    fontSize: 13.5, fontWeight: 600, color: '#374151', background: 'white',
    border: '1px solid #D1D5DB', padding: '7px 16px', borderRadius: 7, textDecoration: 'none',
  },
  body: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    minHeight: 'calc(100vh - 72px)', padding: '32px 20px',
  },
  card: {
    width: '100%', maxWidth: 440, background: 'white',
    border: '1px solid #E2E8F0', borderRadius: 16,
    boxShadow: '0 4px 24px rgba(0,0,0,0.07)', padding: '32px 28px',
  },
  cardTop: { display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 },
  iconWrap: {
    width: 52, height: 52, borderRadius: 13, background: '#EEF2FF',
    border: '1px solid #C7D2FE', display: 'flex', alignItems: 'center',
    justifyContent: 'center', flexShrink: 0,
  },
  eyebrow: { fontSize: 11, fontWeight: 700, color: '#1B3676', textTransform: 'uppercase', letterSpacing: '0.8px', margin: '0 0 3px' },
  heading: { fontSize: 22, fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.3px' },
  subheading: { fontSize: 13.5, color: '#6B7280', margin: '0 0 20px', lineHeight: 1.5 },
  switchRow: { display: 'flex', gap: 8, marginBottom: 24 },
  switchBtn: {
    flex: 1, background: '#F8FAFC', border: '1px solid #E2E8F0',
    borderRadius: 8, padding: '8px 10px', color: '#374151', fontSize: 12.5,
    fontWeight: 600, cursor: 'pointer', textAlign: 'center', fontFamily: FONT,
  },
  form: { display: 'flex', flexDirection: 'column', gap: 16 },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.4px' },
  input: {
    width: '100%', padding: '11px 14px', background: 'white',
    border: '1px solid #D1D5DB', borderRadius: 8, color: '#111827',
    fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: FONT,
  },
  errorBox: {
    display: 'flex', alignItems: 'center', gap: 7, padding: '9px 12px',
    background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8,
    color: '#DC2626', fontSize: 13,
  },
  submitBtn: {
    width: '100%', padding: '13px', background: '#1B3676',
    color: 'white', border: 'none', borderRadius: 8, fontSize: 15,
    fontWeight: 700, cursor: 'pointer', fontFamily: FONT,
    boxShadow: '0 2px 8px rgba(27,54,118,0.25)',
  },
  infoBox: {
    marginTop: 20, padding: '14px 16px', background: '#F8FAFC',
    border: '1px solid #E2E8F0', borderRadius: 10,
  },
};
