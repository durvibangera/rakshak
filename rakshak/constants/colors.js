/**
 * FILE: colors.js
 * PURPOSE: Design system color tokens for the entire Sahaay platform.
 *
 * CONTEXT: Sahaay uses a dark-mode-first design to save battery on victims'
 *          low-end Android phones. These color tokens are used across all
 *          components and pages. Status colors (red/orange/green) are critical
 *          for conveying camp safety and alert severity at a glance.
 *
 * ROLE ACCESS: BOTH
 *
 * EXPORTS:
 *   - COLORS: Main design system color tokens
 *   - CAMP_STATUS_COLORS: Colors mapped to camp status values
 *
 * KEY DEPENDENCIES: None
 *
 * TODO:
 *   [x] Define color tokens
 */

/** @type {Record<string, string>} */
export const COLORS = {
  // Status colors
  EMERGENCY_RED: '#DC2626',
  WARNING_ORANGE: '#EA580C',
  SAFE_GREEN: '#16A34A',

  // Brand
  PRIMARY_BLUE: '#1D4ED8',

  // Surfaces (dark mode first)
  BACKGROUND: '#0F172A',
  SURFACE: '#1E293B',
  SURFACE_HOVER: '#334155',

  // Text
  TEXT_PRIMARY: '#F8FAFC',
  TEXT_SECONDARY: '#94A3B8',
  TEXT_MUTED: '#64748B',

  // Borders
  BORDER: '#334155',
  BORDER_LIGHT: '#475569',
};

/** @type {Record<string, string>} */
export const CAMP_STATUS_COLORS = {
  OPEN: COLORS.SAFE_GREEN,
  NEARLY_FULL: COLORS.WARNING_ORANGE,
  FULL: COLORS.EMERGENCY_RED,
  CLOSED: COLORS.TEXT_MUTED,
};
