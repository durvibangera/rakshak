/**
 * FILE: roleGuard.js
 * PURPOSE: Server-side role checking middleware for API routes.
 *
 * CONTEXT: Sahaay has 4-tier role-based access control:
 *   - super_admin: Full access, reviews matches, audit logs
 *   - camp_admin: Manages one camp, full camp operations
 *   - operator: Camp volunteer, check-in only
 *   - verified_user: Registered victim, can file missing reports
 *
 *   This guard is called at the top of protected API routes.
 *   It extracts the user from the request (Bearer token or X-User-Phone),
 *   verifies their role, and returns structured result.
 *
 * EXPORTS:
 *   - checkRole: Verify user has exact role
 *   - requireMinRole: Verify user meets minimum role hierarchy
 *   - requireSuperAdmin: Shorthand for super_admin
 *   - requireCampAdmin: Shorthand for camp_admin or above
 *   - requireOperator: Shorthand for operator or above
 *   - requireAuth: Any authenticated user
 *   - logAudit: Write to audit_logs table
 *
 * KEY DEPENDENCIES:
 *   - lib/supabase/server.js
 *   - constants/roles.js
 */

import { createServerSupabase, getUserFromRequest } from '@/lib/supabase/server';
import { ROLES, ROLE_HIERARCHY, hasMinRole, isValidRole } from '@/constants/roles';

/**
 * @typedef {Object} AuthResult
 * @property {boolean} authorized
 * @property {Object|null} user - Supabase Auth user
 * @property {Object|null} profile - users table row (includes role, camp assignments, etc.)
 * @property {string|null} error
 */

/**
 * Check if the current request user has the required role (exact match).
 * @param {Request} request - Next.js API request object
 * @param {string} requiredRole - The role to check for (from ROLES constant)
 * @returns {Promise<AuthResult>}
 */
export async function checkRole(request, requiredRole) {
  const { user, profile, error } = await getUserFromRequest(request);

  if (error || !profile) {
    await logAudit(null, null, 'access_denied', null, null, {
      required_role: requiredRole,
      reason: error || 'no_profile',
    });
    return {
      authorized: false,
      user: null,
      profile: null,
      error: error || 'Authentication required',
    };
  }

  if (profile.role !== requiredRole) {
    await logAudit(profile.id, profile.role, 'access_denied', null, null, {
      required_role: requiredRole,
      user_role: profile.role,
    });
    return {
      authorized: false,
      user,
      profile,
      error: `Requires ${requiredRole} role. Your role: ${profile.role}`,
    };
  }

  return { authorized: true, user, profile, error: null };
}

/**
 * Check if the current request user meets a minimum role level.
 * Uses ROLE_HIERARCHY for comparison (super_admin > camp_admin > operator > verified_user).
 * @param {Request} request - Next.js API request object
 * @param {string} minRole - The minimum role required
 * @returns {Promise<AuthResult>}
 */
export async function requireMinRole(request, minRole) {
  const { user, profile, error } = await getUserFromRequest(request);

  if (error || !profile) {
    await logAudit(null, null, 'access_denied', null, null, {
      min_role: minRole,
      reason: error || 'no_profile',
    });
    return {
      authorized: false,
      user: null,
      profile: null,
      error: error || 'Authentication required',
    };
  }

  if (!hasMinRole(profile.role, minRole)) {
    await logAudit(profile.id, profile.role, 'access_denied', null, null, {
      min_role: minRole,
      user_role: profile.role,
    });
    return {
      authorized: false,
      user,
      profile,
      error: `Requires at least ${minRole} access. Your role: ${profile.role}`,
    };
  }

  return { authorized: true, user, profile, error: null };
}

/**
 * Require super_admin role.
 * @param {Request} request
 * @returns {Promise<AuthResult>}
 */
export async function requireSuperAdmin(request) {
  return checkRole(request, ROLES.SUPER_ADMIN);
}

/**
 * Require camp_admin or above (camp_admin, super_admin).
 * @param {Request} request
 * @returns {Promise<AuthResult>}
 */
export async function requireCampAdmin(request) {
  return requireMinRole(request, ROLES.CAMP_ADMIN);
}

/**
 * Require operator or above (operator, camp_admin, super_admin).
 * @param {Request} request
 * @returns {Promise<AuthResult>}
 */
export async function requireOperator(request) {
  return requireMinRole(request, ROLES.OPERATOR);
}

/**
 * Require any authenticated user with a valid profile.
 * @param {Request} request
 * @returns {Promise<AuthResult>}
 */
export async function requireAuth(request) {
  const { user, profile, error } = await getUserFromRequest(request);

  if (error || !profile) {
    return {
      authorized: false,
      user: null,
      profile: null,
      error: error || 'Authentication required',
    };
  }

  return { authorized: true, user, profile, error: null };
}

/**
 * Require that the user is linked to a specific camp (for camp-scoped operations).
 * Camp admins/operators must be assigned to the camp, super_admin bypasses.
 * @param {Request} request
 * @param {string} campId - The camp ID to check
 * @returns {Promise<AuthResult>}
 */
export async function requireCampAccess(request, campId) {
  const result = await requireMinRole(request, ROLES.OPERATOR);
  if (!result.authorized) return result;

  // Super admin has access to all camps
  if (result.profile.role === ROLES.SUPER_ADMIN) {
    return result;
  }

  // Camp admin/operator must be assigned to this camp
  if (result.profile.assigned_camp_id !== campId) {
    await logAudit(result.profile.id, result.profile.role, 'access_denied', 'camp', campId, {
      reason: 'wrong_camp',
      assigned_camp: result.profile.assigned_camp_id,
    });
    return {
      ...result,
      authorized: false,
      error: 'You are not assigned to this camp',
    };
  }

  return result;
}

/**
 * Write an audit log entry.
 * Non-blocking — failures are logged to console but don't throw.
 * @param {string|null} userId
 * @param {string|null} userRole
 * @param {string} action
 * @param {string|null} targetType
 * @param {string|null} targetId
 * @param {Object} metadata
 */
export async function logAudit(userId, userRole, action, targetType, targetId, metadata = {}) {
  try {
    const supabase = createServerSupabase();
    await supabase.from('audit_logs').insert({
      user_id: userId || undefined,
      user_role: userRole || undefined,
      action,
      target_type: targetType || undefined,
      target_id: targetId || undefined,
      metadata,
    });
  } catch (err) {
    console.error('[Audit] Failed to log:', action, err.message);
  }
}

/**
 * Helper: Return a 403 NextResponse for unauthorized requests.
 * @param {string} error
 * @returns {Response}
 */
export function forbiddenResponse(error) {
  const { NextResponse } = require('next/server');
  return NextResponse.json({ error: error || 'Forbidden' }, { status: 403 });
}

/**
 * Helper: Return a 401 NextResponse for unauthenticated requests.
 * @param {string} error
 * @returns {Response}
 */
export function unauthorizedResponse(error) {
  const { NextResponse } = require('next/server');
  return NextResponse.json({ error: error || 'Authentication required' }, { status: 401 });
}
