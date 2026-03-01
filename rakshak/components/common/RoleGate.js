'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { hasMinRole } from '@/constants/roles';

export default function RoleGate({ allowedRole, minRole, redirectTo = '/', children }) {
  const { profile, loading, refreshProfile } = useAuth();
  const router = useRouter();
  const [retried, setRetried] = useState(false);
  const retryRef = useRef(false);

  const isAuthorized = () => {
    if (!profile?.role) return false;
    if (allowedRole) return profile.role === allowedRole;
    if (minRole) return hasMinRole(profile.role, minRole);
    return false;
  };

  useEffect(() => {
    if (loading) return;

    if (isAuthorized()) return;

    // Not authorized yet — retry once to handle race conditions.
    // This covers both:
    //   - Operator flow: localStorage creds set right before navigation
    //   - Email login flow: Supabase session exists but profile hasn't loaded yet
    if (!retryRef.current) {
      retryRef.current = true;
      refreshProfile().then(() => setRetried(true));
      return;
    }

    router.replace(redirectTo);
  }, [loading, profile, retried]);

  if (loading || (!isAuthorized() && !retried)) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0F172A', display: 'flex',
        alignItems: 'center', justifyContent: 'center', color: '#94A3B8',
        fontFamily: 'system-ui, sans-serif',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 40, height: 40, border: '3px solid #334155',
            borderTopColor: '#3B82F6', borderRadius: '50%',
            animation: 'spin 0.8s linear infinite', margin: '0 auto 12px',
          }} />
          <p style={{ fontSize: 14, margin: 0 }}>Checking access...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (!isAuthorized()) return null;

  return children;
}
