/**
 * FILE: distanceCalculator.js
 * PURPOSE: Haversine formula for calculating distance between two GPS coordinates.
 *
 * CONTEXT: Used throughout Sahaay to calculate distance from a victim's current
 *          location to relief camps, to rank camps by proximity, and in the
 *          safety-weighted routing algorithm. All distances are in kilometers.
 *
 * ROLE ACCESS: BOTH
 *
 * EXPORTS:
 *   - haversineDistance: Calculate distance between two lat/lng points in km
 *   - sortByDistance: Sort an array of locations by distance from a point
 *
 * KEY DEPENDENCIES: None
 *
 * TODO:
 *   [x] Implement Haversine formula
 *   [x] Implement sortByDistance helper
 */

const EARTH_RADIUS_KM = 6371;

/**
 * Convert degrees to radians.
 * @param {number} deg - Degrees
 * @returns {number} Radians
 */
function toRadians(deg) {
  return (deg * Math.PI) / 180;
}

/**
 * Calculate the great-circle distance between two points using the Haversine formula.
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lng1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lng2 - Longitude of point 2
 * @returns {number} Distance in kilometers
 */
export function haversineDistance(lat1, lng1, lat2, lng2) {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * Sort an array of objects with lat/lng by distance from a reference point.
 * @param {{ lat: number, lng: number }} origin - Reference point
 * @param {Array<{ lat: number, lng: number }>} locations - Array of locations to sort
 * @returns {Array<{ location: Object, distance: number }>} Sorted by distance ascending
 */
export function sortByDistance(origin, locations) {
  return locations
    .map((loc) => ({
      location: loc,
      distance: haversineDistance(origin.lat, origin.lng, loc.lat, loc.lng),
    }))
    .sort((a, b) => a.distance - b.distance);
}
