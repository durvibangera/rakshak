'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

const ROLE_OPTIONS = [
  {
    id: 'super_admin',
    label: 'Super Admin',
    desc: 'Nationwide oversight — all camps, all reports',
    icon: '🛡️',
    authType: 'email',
    redirect: '/admin/dashboard',
  },
  {
    id: 'camp_admin',
    label: 'Camp Admin',
    desc: 'Manage your camp — victims, resources, evacuate',
    icon: '🏕️',
    authType: 'email',
    redirect: '/camp/dashboard',
  },
  {
    id: 'operator',
    label: 'Operator',
    desc: 'QR check-in & help find missing people',
    icon: '📋',
    authType: 'campcode',
    redirect: '/operator/dashboard',
  },
];

export default function AdminLoginPage() {
  const router = useRouter();
  const { refreshProfile } = useAuth();
  const [selectedRole, setSelectedRole] = useState(null);

  // Email/password login state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Operator login state
  const [campCode, setCampCode] = useState('');
  const [operatorPhone, setOperatorPhone] = useState('');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleEmailLogin = async (e) => {
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

      // Fetch profile and verify role
      const { data: profile } = await supabase
        .from('users')
        .select('role, assigned_camp_id')
        .eq('auth_uid', data.user.id)
        .single();

      if (!profile) throw new Error('No profile found for this account');

      const role = selectedRole;
      if (profile.role !== role.id) {
        await supabase.auth.signOut();
        throw new Error(`This account is a ${profile.role}, not a ${role.label}`);
      }

      if (role.id === 'camp_admin' && profile.assigned_camp_id) {
        localStorage.setItem('rakshak_camp_id', profile.assigned_camp_id);
      }

      await refreshProfile();
      router.push(role.redirect);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handleOperatorLogin = async (e) => {
    e.preventDefault();
    setError('');
    if (!campCode || !operatorPhone) return setError('Enter camp code and your phone number');

    setLoading(true);
    try {
      // Verify camp code exists
      const res = await fetch(`/api/camps?code=${campCode.trim().toUpperCase()}`);
      const campData = await res.json();

      if (!campData.camp) throw new Error('Invalid camp code');

      const fullPhone = operatorPhone.startsWith('+91')
        ? operatorPhone
        : `+91${operatorPhone.replace(/\D/g, '')}`;

      // Verify this phone is registered as an operator for this camp
      const { data: profile } = await supabase
        .from('users')
        .select('id, role, assigned_camp_id')
        .eq('phone', fullPhone)
        .single();

      if (!profile) throw new Error('Phone not registered. Ask your camp admin to add you.');
      if (profile.role !== 'operator') throw new Error('This phone is not registered as an operator');
      if (profile.assigned_camp_id && profile.assigned_camp_id !== campData.camp.id) {
        throw new Error('You are assigned to a different camp');
      }

      // Store in localStorage for operator session
      localStorage.setItem('rakshak_phone', fullPhone);
      localStorage.setItem('rakshak_camp_id', campData.camp.id);
      localStorage.setItem('rakshak_camp_name', campData.camp.name);

      await refreshProfile();
      router.push('/operator/dashboard');
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div style={s.page}>
      <div style={s.card}>
        <button onClick={() => router.push('/')} style={s.backLink}>← Back to Rakshak</button>

        <h1 style={s.heading}>Admin Login</h1>
        <p style={s.subheading}>Choose your role to continue</p>

        {/* Role selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {ROLE_OPTIONS.map(role => (
            <button
              key={role.id}
              onClick={() => { setSelectedRole(role); setError(''); }}
              style={{
                ...s.roleCard,
                ...(selectedRole?.id === role.id ? s.roleCardActive : {}),
              }}
            >
              <span style={{ fontSize: 22 }}>{role.icon}</span>
              <div style={{ textAlign: 'left', flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#F1F5F9', margin: 0 }}>{role.label}</p>
                <p style={{ fontSize: 12, color: '#94A3B8', margin: '2px 0 0' }}>{role.desc}</p>
              </div>
              {selectedRole?.id === role.id && (
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#3B82F6' }} />
              )}
            </button>
          ))}
        </div>

        {/* Login form based on selected role */}
        {selectedRole && selectedRole.authType === 'email' && (
          <form onSubmit={handleEmailLogin} style={s.form}>
            <div>
              <label style={s.label}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="admin@organization.com" style={s.input} />
            </div>
            <div>
              <label style={s.label}>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" style={s.input} />
            </div>
            {error && <p style={s.error}>{error}</p>}
            <button type="submit" disabled={loading} style={{
              ...s.submitBtn, opacity: loading ? 0.6 : 1,
            }}>
              {loading ? 'Logging in...' : `Login as ${selectedRole.label}`}
            </button>
          </form>
        )}

        {selectedRole && selectedRole.authType === 'campcode' && (
          <form onSubmit={handleOperatorLogin} style={s.form}>
            <div>
              <label style={s.label}>Camp Code</label>
              <input type="text" value={campCode} onChange={e => setCampCode(e.target.value)}
                placeholder="e.g. MH-CAMP-01" style={s.input} maxLength={20} />
              <p style={{ fontSize: 11, color: '#64748B', margin: '4px 0 0' }}>
                Get this from your Camp Admin
              </p>
            </div>
            <div>
              <label style={s.label}>Your Phone Number</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <span style={s.prefix}>+91</span>
                <input type="tel" value={operatorPhone} onChange={e => setOperatorPhone(e.target.value)}
                  placeholder="9999000001" maxLength={10} style={{ ...s.input, flex: 1 }} />
              </div>
            </div>
            {error && <p style={s.error}>{error}</p>}
            <button type="submit" disabled={loading} style={{
              ...s.submitBtn, opacity: loading ? 0.6 : 1,
            }}>
              {loading ? 'Verifying...' : 'Login as Operator'}
            </button>
          </form>
        )}

        {!selectedRole && (
          <p style={{ fontSize: 13, color: '#64748B', textAlign: 'center', margin: 0 }}>
            Select a role above to see the login form
          </p>
        )}
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
  heading: { fontSize: 24, fontWeight: 800, color: '#F1F5F9', margin: '0 0 4px' },
  subheading: { fontSize: 14, color: '#94A3B8', margin: '0 0 20px' },
  roleCard: {
    display: 'flex', gap: 12, alignItems: 'center', padding: '14px 16px',
    background: '#0F172A', border: '1px solid #334155', borderRadius: 12,
    cursor: 'pointer', transition: 'all 0.15s',
  },
  roleCardActive: {
    border: '1px solid #3B82F6', background: 'rgba(59,130,246,0.08)',
    boxShadow: '0 0 0 1px rgba(59,130,246,0.3)',
  },
  form: { display: 'flex', flexDirection: 'column', gap: 14 },
  label: { display: 'block', fontSize: 13, fontWeight: 600, color: '#94A3B8', marginBottom: 6 },
  input: {
    width: '100%', padding: '12px 14px', background: '#0F172A', border: '1px solid #334155',
    borderRadius: 10, color: '#E2E8F0', fontSize: 15, outline: 'none', boxSizing: 'border-box',
  },
  prefix: {
    display: 'flex', alignItems: 'center', padding: '0 14px', background: '#0F172A',
    border: '1px solid #334155', borderRadius: 10, color: '#94A3B8', fontWeight: 600, fontSize: 15,
  },
  submitBtn: {
    width: '100%', padding: 14, background: 'linear-gradient(135deg, #3B82F6, #2563EB)',
    color: 'white', border: 'none', borderRadius: 10, fontSize: 16, fontWeight: 700,
    cursor: 'pointer', boxShadow: '0 4px 14px rgba(59,130,246,0.3)',
  },
  error: { color: '#EF4444', fontSize: 13, margin: 0 },
};
