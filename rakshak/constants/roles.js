/**
 * FILE: roles.js
 * PURPOSE: Define user role constants and permission hierarchy for the entire application.
 *
 * CONTEXT: Sahaay has 4 distinct roles with tiered access control:
 *   - SUPER_ADMIN: National/state-level, full visibility, reviews matches, audit logs
 *   - CAMP_ADMIN: Manages one camp, full camp access, approves alerts, manages resources
 *   - OPERATOR: Camp volunteer, check-in only (via phone/QR/face/unidentified)
 *   - VERIFIED_USER: Registered victim, can file missing reports, update own status
 *
 * ROLE ACCESS: BOTH
 *
 * EXPORTS:
 *   - ROLES: Object with all 4 role string constants
 *   - ROLE_LABELS: Human-readable labels for each role
 *   - ROLE_HIERARCHY: Numeric level for comparison (higher = more access)
 *   - hasMinRole: Helper to check if a user role meets a minimum level
 *
 * KEY DEPENDENCIES: None
 */

/** @enum {string} */
export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  CAMP_ADMIN: 'camp_admin',
  NGO_ADMIN: 'ngo_admin',
  OPERATOR: 'operator',
  VERIFIED_USER: 'verified_user',
};

/** @type {Record<string, string>} */
export const ROLE_LABELS = {
  [ROLES.SUPER_ADMIN]: 'Super Admin',
  [ROLES.CAMP_ADMIN]: 'Camp Admin',
  [ROLES.NGO_ADMIN]: 'NGO Admin',
  [ROLES.OPERATOR]: 'Camp Operator',
  [ROLES.VERIFIED_USER]: 'Verified User',
};

/**
 * Numeric hierarchy — higher number = more access.
 * Used for "at least this role" checks.
 * @type {Record<string, number>}
 */
export const ROLE_HIERARCHY = {
  [ROLES.VERIFIED_USER]: 1,
  [ROLES.OPERATOR]: 2,
  [ROLES.NGO_ADMIN]: 3,
  [ROLES.CAMP_ADMIN]: 3,
  [ROLES.SUPER_ADMIN]: 4,
};

/**
 * Check if userRole meets or exceeds the minimum required role.
 * @param {string} userRole - The user's current role
 * @param {string} minRole - The minimum required role
 * @returns {boolean}
 */
export function hasMinRole(userRole, minRole) {
  return (ROLE_HIERARCHY[userRole] || 0) >= (ROLE_HIERARCHY[minRole] || 0);
}

/**
 * Check if a role string is valid.
 * @param {string} role
 * @returns {boolean}
 */
export function isValidRole(role) {
  return Object.values(ROLES).includes(role);
}
