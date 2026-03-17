/**
 * FILE: AuthContext.js
 * PURPOSE: React context provider for user authentication state and role.
 *
 * CONTEXT: Wraps the entire app to provide the current user object, their role
 *          (super_admin/camp_admin/operator/verified_user), and auth state.
 *          Supports two auth modes:
 *            1. Supabase Auth session (OTP / email-password) — persistent, real
 *            2. localStorage fallback (phone/campId) — for operator-assisted flows
 *          Subscribes to Supabase auth state changes and fetches profile from users table.
 *
 * ROLE ACCESS: BOTH
 *
 * EXPORTS:
 *   - AuthProvider: Context provider component
 *   - useAuth: Hook to consume auth context
 */

'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { ROLES, isValidRole } from '@/constants/roles';

/** @type {React.Context} */
const AuthContext = createContext({
  user: null,        // Supabase Auth user object
  profile: null,     // Row from users table (name, role, phone, etc.)
  role: null,        // Shortcut to profile.role
  campId: null,      // Assigned or localStorage camp ID
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

/**
 * Fetch user profile from users table by auth UID or phone.
 * @param {string|null} authUid - Supabase Auth UID
 * @param {string|null} phone - Fallback phone from localStorage
 * @returns {Promise<Object|null>}
 */
async function fetchProfile(authUid, phone) {
  if (!authUid && !phone) return null;

  // Try by auth_uid first (linked accounts)
  if (authUid) {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('auth_uid', authUid)
      .single();
    if (data) return data;

    // Fallback: try matching by Supabase Auth user ID as users.id
    const { data: byId } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUid)
      .single();
    if (byId) return byId;
  }

  // Fallback: try by phone
  if (phone) {
    const formattedPhone = phone.startsWith('+91') ? phone : `+91${phone.replace(/\D/g, '')}`;
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('phone', formattedPhone)
      .single();
    if (data) return data;
  }

  return null;
}

/**
 * Auth context provider — wraps the app to provide auth state.
 * @param {{ children: React.ReactNode }} props
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [role, setRole] = useState(null);
  const [campId, setCampId] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load profile from Supabase Auth session or localStorage fallback
  const loadProfile = useCallback(async (authUser) => {
    try {
      const lsPhone = typeof window !== 'undefined' ? localStorage.getItem('sahaay_phone') : null;
      const lsCampId = typeof window !== 'undefined' ? localStorage.getItem('sahaay_camp_id') : null;

      const prof = await fetchProfile(authUser?.id || null, lsPhone);

      if (prof) {
        setProfile(prof);
        const newRole = isValidRole(prof.role) ? prof.role : ROLES.VERIFIED_USER;
        setRole(newRole);
        setCampId(prof.assigned_camp_id || lsCampId || null);
        return { profile: prof, role: newRole };
      } else {
        // No profile found — user might be new or localStorage-only
        setProfile(null);
        setRole(null);
        setCampId(lsCampId || null);
        return { profile: null, role: null };
      }
    } catch (err) {
      console.error('[AuthContext] Failed to load profile:', err);
      setProfile(null);
      setRole(null);
      return { profile: null, role: null };
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    // 1. Get initial session
    const initSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;

        if (session?.user) {
          setUser(session.user);
          await loadProfile(session.user);
        } else {
          // No Supabase session — try localStorage fallback
          setUser(null);
          await loadProfile(null);
        }
      } catch (err) {
        console.error('[AuthContext] Session init error:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initSession();

    // 2. Subscribe to auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user);
          await loadProfile(session.user);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setProfile(null);
          setRole(null);
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          setUser(session.user);
          // Profile doesn't change on token refresh, skip re-fetch
        }

        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, [loadProfile]);

  /**
   * Force-refresh profile from DB (e.g., after role change or registration).
   * Reads the current Supabase session directly to avoid stale closure issues.
   */
  const refreshProfile = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        return await loadProfile(session.user);
      }
    } catch (err) {
      console.warn('[AuthContext] getSession failed in refreshProfile:', err);
    }
    // Fallback to current state / localStorage
    return await loadProfile(user);
  }, [user, loadProfile]);

  /**
   * Sign out — clear Supabase session and localStorage.
   */
  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch {}
    setUser(null);
    setProfile(null);
    setRole(null);
    setCampId(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('sahaay_phone');
      localStorage.removeItem('sahaay_camp_id');
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, role, campId, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access auth context.
 * @returns {{ user: Object|null, profile: Object|null, role: string|null, campId: string|null, loading: boolean, signOut: Function, refreshProfile: Function }}
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
