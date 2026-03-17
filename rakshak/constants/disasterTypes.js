/**
 * FILE: disasterTypes.js
 * PURPOSE: Define disaster type and severity constants used across alerts and predictions.
 *
 * CONTEXT: India faces multiple disaster types — floods, cyclones, earthquakes, landslides.
 *          These constants classify alerts, drive prediction models, and determine
 *          the appropriate emergency response in the Sahaay platform.
 *
 * ROLE ACCESS: BOTH
 *
 * EXPORTS:
 *   - DISASTER_TYPES: Enum of all supported disaster types
 *   - SEVERITY_LEVELS: Enum of alert severity levels
 *   - DISASTER_LABELS: Human-readable labels + emoji for each type
 *
 * KEY DEPENDENCIES: None
 *
 * TODO:
 *   [x] Define disaster types and severity levels
 */

/** @enum {string} */
export const DISASTER_TYPES = {
  FLOOD: 'FLOOD',
  CYCLONE: 'CYCLONE',
  EARTHQUAKE: 'EARTHQUAKE',
  LANDSLIDE: 'LANDSLIDE',
  TSUNAMI: 'TSUNAMI',
  ROAD_BLOCK: 'ROAD_BLOCK',
  FIRE: 'FIRE',
};

/** @enum {string} */
export const SEVERITY_LEVELS = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
};

/** @type {Record<string, { label: string, emoji: string }>} */
export const DISASTER_LABELS = {
  [DISASTER_TYPES.FLOOD]: { label: 'Flood', emoji: '🌊' },
  [DISASTER_TYPES.CYCLONE]: { label: 'Cyclone', emoji: '🌀' },
  [DISASTER_TYPES.EARTHQUAKE]: { label: 'Earthquake', emoji: '🔴' },
  [DISASTER_TYPES.LANDSLIDE]: { label: 'Landslide', emoji: '⛰️' },
  [DISASTER_TYPES.TSUNAMI]: { label: 'Tsunami', emoji: '🌊' },
  [DISASTER_TYPES.ROAD_BLOCK]: { label: 'Road Blocked', emoji: '🚧' },
  [DISASTER_TYPES.FIRE]: { label: 'Fire', emoji: '🔥' },
};

/** @type {Record<string, string>} */
export const SEVERITY_COLORS = {
  [SEVERITY_LEVELS.LOW]: '#16A34A',
  [SEVERITY_LEVELS.MEDIUM]: '#EA580C',
  [SEVERITY_LEVELS.HIGH]: '#DC2626',
  [SEVERITY_LEVELS.CRITICAL]: '#7F1D1D',
};
