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

  // 2. Wrap auth check in a stable ref so we don't need it in dependency arrays
  const checkAuthRef = useRef(() => {
    if (!profile?.role) return false;
    if (allowedRole) return profile.role === allowedRole;
    if (minRole) return hasMinRole(profile.role, minRole);
    return false;
  });

  // Keep ref up to date
  useEffect(() => {
    checkAuthRef.current = () => {
      if (!profile?.role) return false;
      if (allowedRole) return profile.role === allowedRole;
      if (minRole) return hasMinRole(profile.role, minRole);
      return false;
    };
  }, [profile, allowedRole, minRole]);

  useEffect(() => {
    if (loading) return;

    if (checkAuthRef.current()) return; // Already authorized

    // Not authorized yet — retry once to handle race conditions.
    if (!retryRef.current) {
      retryRef.current = true;
      const refreshWithTimeout = Promise.race([
        refreshProfile(),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 6000)),
      ]);
      
      refreshWithTimeout
        .then((res) => {
          if (res?.role) {
            const ok = allowedRole ? res.role === allowedRole : (minRole ? hasMinRole(res.role, minRole) : false);
            if (!ok) router.replace(redirectTo);
          } else {
            router.replace(redirectTo);
          }
        })
        .catch(() => router.replace(redirectTo))
        .finally(() => setRetried(true));
      return;
    }

    router.replace(redirectTo);
  }, [loading, router, redirectTo, refreshProfile, allowedRole, minRole]);

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
