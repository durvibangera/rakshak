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
import { supabase } from '@/lib/supabase/client';

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
      // Use Supabase client-side auth so the session persists
      const { data, error: authErr } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authErr) throw authErr;

      // Fetch profile and verify NGO role
      const { data: profile } = await supabase
        .from('users')
        .select('role, name')
        .eq('auth_uid', data.user.id)
        .single();

      if (!profile) {
        // Try by id
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
    <div style={s.page}>
      <div style={s.card}>
        <button onClick={() => router.push('/')} style={s.backLink}>← Back to Rakshak</button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <span style={{ fontSize: 28 }}>🏢</span>
          <h1 style={s.heading}>NGO Login</h1>
        </div>
        <p style={s.subheading}>
          Sign in to your NGO portal to manage assignments, fundraising and kit dispatches
        </p>

        {/* Switch to other login */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <button onClick={() => router.push('/login')} style={s.switchLink}>
            Victim? Login here →
          </button>
          <button onClick={() => router.push('/admin-login')} style={s.switchLink}>
            Admin/Staff? Login here →
          </button>
        </div>

        <form onSubmit={handleLogin} style={s.form}>
          <div>
            <label style={s.label}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={s.input}
            />
          </div>

          {error && <p style={s.error}>{error}</p>}

          <button type="submit" disabled={loading} style={{ ...s.submitBtn, opacity: loading ? 0.6 : 1 }}>
            {loading ? 'Signing in…' : 'Login as NGO Admin'}
          </button>
        </form>

        <div style={{ marginTop: 20, padding: '14px 16px', background: '#0F172A', borderRadius: 10, border: '1px solid #334155' }}>
          <p style={{ fontSize: 12, color: '#64748B', margin: 0, lineHeight: 1.5 }}>
            <strong style={{ color: '#94A3B8' }}>How to get access:</strong> Your organization must be registered by a Super Admin
            in the Rakshak system. Once registered, you&apos;ll receive login credentials via email.
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
  heading: { fontSize: 24, fontWeight: 800, color: '#F1F5F9', margin: 0 },
  subheading: { fontSize: 14, color: '#94A3B8', margin: '0 0 16px' },
  switchLink: {
    flex: 1, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)',
    borderRadius: 8, padding: '8px 10px', color: '#60A5FA', fontSize: 12,
    cursor: 'pointer', textAlign: 'center',
  },
  form: { display: 'flex', flexDirection: 'column', gap: 14 },
  label: { display: 'block', fontSize: 13, fontWeight: 600, color: '#94A3B8', marginBottom: 6 },
  input: {
    width: '100%', padding: '12px 14px', background: '#0F172A', border: '1px solid #334155',
    borderRadius: 10, color: '#E2E8F0', fontSize: 15, outline: 'none', boxSizing: 'border-box',
  },
  submitBtn: {
    width: '100%', padding: 14, background: 'linear-gradient(135deg, #10B981, #059669)',
    color: 'white', border: 'none', borderRadius: 10, fontSize: 16, fontWeight: 700,
    cursor: 'pointer', boxShadow: '0 4px 14px rgba(16,185,129,0.3)',
  },
  error: { color: '#EF4444', fontSize: 13, margin: 0 },
};
