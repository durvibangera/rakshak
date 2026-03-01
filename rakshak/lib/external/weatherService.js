/**
 * FILE: weatherService.js
 * PURPOSE: Multi-disaster prediction engine using free APIs.
 *
 * DISASTER TYPES:
 *   🌊 Flood     → Open-Meteo (rainfall + humidity)
 *   🏔️ Earthquake → USGS real-time seismic API
 *   ⛰️ Landslide  → Open-Meteo (heavy rain + slope estimation)
 *   🌀 Cyclone    → Open-Meteo (extreme wind + low pressure)
 *
 * ALL APIs ARE FREE — NO API KEYS NEEDED.
 */

const OPEN_METEO_URL = 'https://api.open-meteo.com/v1';
const USGS_EARTHQUAKE_URL = 'https://earthquake.usgs.gov/fdsnws/event/1';

// ── In-memory cache (15-minute TTL) ─────────────────────────────
const cache = new Map();
const CACHE_TTL_MS = 15 * 60 * 1000;

function getCacheKey(type, lat, lng) {
  return `${type}:${Math.round(lat * 100)}:${Math.round(lng * 100)}`;
}

function getFromCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key, data) {
  cache.set(key, { data, timestamp: Date.now() });
}

// ═══════════════════════════════════════════════════════════════
// 🌊 FLOOD PREDICTION (Open-Meteo)
// ═══════════════════════════════════════════════════════════════

export async function predictFloodRisk(lat, lon) {
  const cacheKey = getCacheKey('flood', lat, lon);
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  const url = `${OPEN_METEO_URL}/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation,rain,weather_code,wind_speed_10m&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo error: ${res.status}`);
  const data = await res.json();

  const current = data?.current;
  const rainfall = current?.rain ?? current?.precipitation ?? 0;
  const humidity = current?.relative_humidity_2m ?? 0;
  const windSpeed = current?.wind_speed_10m ?? 0;

  let risk = 'LOW';
  if (rainfall > 40 && humidity > 80) risk = 'HIGH';
  else if (rainfall >= 20) risk = 'MEDIUM';

  const result = {
    type: 'FLOOD',
    icon: '🌊',
    risk,
    rainfall,
    humidity,
    windSpeed,
    description: risk === 'HIGH'
      ? `Heavy rainfall (${rainfall}mm) with ${humidity}% humidity`
      : risk === 'MEDIUM'
        ? `Moderate rainfall (${rainfall}mm)`
        : `Normal conditions (${rainfall}mm rain)`,
  };

  setCache(cacheKey, result);
  return result;
}

// ═══════════════════════════════════════════════════════════════
// 🏔️ EARTHQUAKE DETECTION (USGS API)
// ═══════════════════════════════════════════════════════════════

export async function predictEarthquakeRisk(lat, lon) {
  const cacheKey = getCacheKey('earthquake', lat, lon);
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  // Fetch earthquakes within 300km in the last 7 days
  const endTime = new Date().toISOString();
  const startTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const url = `${USGS_EARTHQUAKE_URL}/query?format=geojson&latitude=${lat}&longitude=${lon}&maxradiuskm=300&starttime=${startTime}&endtime=${endTime}&minmagnitude=2.0&orderby=magnitude`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`USGS API error: ${res.status}`);
  const data = await res.json();

  const quakes = data?.features || [];
  const totalQuakes = quakes.length;

  // Find the strongest recent earthquake
  const strongest = quakes.length > 0 ? quakes[0] : null;
  const maxMagnitude = strongest?.properties?.mag ?? 0;
  const maxDepth = strongest?.geometry?.coordinates?.[2] ?? 0;
  const maxPlace = strongest?.properties?.place ?? 'Unknown';

  // Risk assessment
  let risk = 'LOW';
  if (maxMagnitude >= 5.0 || totalQuakes >= 10) risk = 'HIGH';
  else if (maxMagnitude >= 3.5 || totalQuakes >= 5) risk = 'MEDIUM';

  const recentQuakes = quakes.slice(0, 5).map((q) => ({
    magnitude: q.properties.mag,
    place: q.properties.place,
    time: new Date(q.properties.time).toLocaleString('en-IN'),
    depth: q.geometry.coordinates[2],
  }));

  const result = {
    type: 'EARTHQUAKE',
    icon: '🏔️',
    risk,
    totalQuakes,
    maxMagnitude,
    maxDepth,
    maxPlace,
    recentQuakes,
    description: risk === 'HIGH'
      ? `${totalQuakes} earthquakes detected! Strongest: M${maxMagnitude} at ${maxPlace}`
      : risk === 'MEDIUM'
        ? `${totalQuakes} tremors detected. Strongest: M${maxMagnitude}`
        : totalQuakes > 0
          ? `${totalQuakes} minor tremors. Max M${maxMagnitude}`
          : 'No significant seismic activity',
  };

  setCache(cacheKey, result);
  return result;
}

// ═══════════════════════════════════════════════════════════════
// ⛰️ LANDSLIDE RISK (Rainfall + terrain estimation)
// ═══════════════════════════════════════════════════════════════

// Known landslide-prone regions in India (hilly areas)
const LANDSLIDE_PRONE_ZONES = [
  { name: 'Western Ghats', latRange: [8, 21], lonRange: [73, 77] },
  { name: 'Himalayas', latRange: [26, 36], lonRange: [72, 97] },
  { name: 'Northeast India', latRange: [22, 28], lonRange: [89, 97] },
  { name: 'Nilgiri Hills', latRange: [11, 12], lonRange: [76, 77] },
  { name: 'Konkan Coast', latRange: [15, 20], lonRange: [73, 74] },
];

function isLandslideProne(lat, lon) {
  return LANDSLIDE_PRONE_ZONES.find(
    (z) => lat >= z.latRange[0] && lat <= z.latRange[1] && lon >= z.lonRange[0] && lon <= z.lonRange[1]
  );
}

export async function predictLandslideRisk(lat, lon) {
  const cacheKey = getCacheKey('landslide', lat, lon);
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  // Fetch rainfall data
  const url = `${OPEN_METEO_URL}/forecast?latitude=${lat}&longitude=${lon}&current=precipitation,rain,relative_humidity_2m&hourly=precipitation&forecast_days=2&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo error: ${res.status}`);
  const data = await res.json();

  const rainfall = data?.current?.rain ?? data?.current?.precipitation ?? 0;
  const humidity = data?.current?.relative_humidity_2m ?? 0;

  // Calculate cumulative rainfall in last 24 hours from hourly data
  const hourlyPrecip = data?.hourly?.precipitation || [];
  const last24h = hourlyPrecip.slice(0, 24);
  const cumulativeRainfall = last24h.reduce((sum, val) => sum + (val || 0), 0);

  const proneZone = isLandslideProne(lat, lon);
  const isHilly = !!proneZone;

  let risk = 'LOW';
  if (isHilly && (cumulativeRainfall > 100 || rainfall > 30)) risk = 'HIGH';
  else if (isHilly && (cumulativeRainfall > 50 || rainfall > 15)) risk = 'MEDIUM';
  else if (!isHilly && cumulativeRainfall > 150) risk = 'MEDIUM';

  const result = {
    type: 'LANDSLIDE',
    icon: '⛰️',
    risk,
    rainfall,
    cumulativeRainfall24h: Math.round(cumulativeRainfall * 10) / 10,
    isHillyTerrain: isHilly,
    terrainZone: proneZone?.name || 'Plains',
    description: risk === 'HIGH'
      ? `Heavy rain (${Math.round(cumulativeRainfall)}mm/24h) in ${proneZone?.name} — landslide risk!`
      : risk === 'MEDIUM'
        ? `Moderate rain in ${isHilly ? proneZone?.name : 'area'} — watch for landslides`
        : `Low landslide risk${isHilly ? ` (${proneZone?.name})` : ''}`,
  };

  setCache(cacheKey, result);
  return result;
}

// ═══════════════════════════════════════════════════════════════
// 🌀 CYCLONE RISK (Wind + pressure — COASTAL AREAS ONLY)
// ═══════════════════════════════════════════════════════════════

// Cyclones only affect coastal regions — no alerts for inland cities
const COASTAL_ZONES = [
  { name: 'Mumbai Coast', latRange: [18, 20], lonRange: [72, 73.5] },
  { name: 'Gujarat Coast', latRange: [20, 24], lonRange: [68, 73] },
  { name: 'Konkan Coast', latRange: [15, 18], lonRange: [73, 74] },
  { name: 'Kerala Coast', latRange: [8, 12.5], lonRange: [74.5, 77] },
  { name: 'Tamil Nadu Coast', latRange: [8, 13.5], lonRange: [79, 80.5] },
  { name: 'Andhra Coast', latRange: [13.5, 18], lonRange: [79, 82] },
  { name: 'Odisha Coast', latRange: [18, 22], lonRange: [84, 87.5] },
  { name: 'Bengal Coast', latRange: [21, 23], lonRange: [87, 89] },
];

function isCoastal(lat, lon) {
  return COASTAL_ZONES.find(
    (z) => lat >= z.latRange[0] && lat <= z.latRange[1] && lon >= z.lonRange[0] && lon <= z.lonRange[1]
  );
}

export async function predictCycloneRisk(lat, lon) {
  const cacheKey = getCacheKey('cyclone', lat, lon);
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  const coastalZone = isCoastal(lat, lon);

  // If not coastal, always LOW risk — cyclones don't affect inland cities
  if (!coastalZone) {
    const result = {
      type: 'CYCLONE', icon: '🌀', risk: 'LOW',
      windSpeed: 0, pressure: 1013, windDirection: 0,
      category: 'None', isCoastal: false,
      description: 'Inland area — not cyclone prone',
    };
    setCache(cacheKey, result);
    return result;
  }

  const url = `${OPEN_METEO_URL}/forecast?latitude=${lat}&longitude=${lon}&current=wind_speed_10m,wind_direction_10m,surface_pressure,weather_code&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo error: ${res.status}`);
  const data = await res.json();

  const current = data?.current;
  const windSpeed = current?.wind_speed_10m ?? 0;
  const pressure = current?.surface_pressure ?? 1013;
  const windDirection = current?.wind_direction_10m ?? 0;

  let risk = 'LOW';
  let category = 'None';

  // Strict thresholds — BOTH wind AND pressure must indicate cyclone
  if (windSpeed >= 120 && pressure < 970) {
    risk = 'HIGH';
    category = windSpeed >= 200 ? 'Super Cyclone' : windSpeed >= 160 ? 'Very Severe' : 'Severe Cyclone';
  } else if (windSpeed >= 80 && pressure < 990) {
    risk = 'MEDIUM';
    category = windSpeed >= 100 ? 'Cyclonic Storm' : 'Deep Depression';
  }

  const result = {
    type: 'CYCLONE',
    icon: '🌀',
    risk,
    windSpeed,
    pressure,
    windDirection,
    category,
    isCoastal: true,
    coastalZone: coastalZone.name,
    description: risk === 'HIGH'
      ? `${category}! Wind: ${windSpeed}km/h, Pressure: ${pressure}hPa — ${coastalZone.name}`
      : risk === 'MEDIUM'
        ? `${category} forming near ${coastalZone.name}. Wind: ${windSpeed}km/h`
        : `Normal conditions at ${coastalZone.name} (wind ${windSpeed}km/h)`,
  };

  setCache(cacheKey, result);
  return result;
}

// ═══════════════════════════════════════════════════════════════
// 🎯 COMBINED PREDICTION (All disaster types)
// ═══════════════════════════════════════════════════════════════

export async function predictAllRisks(lat, lon) {
  const [flood, earthquake, landslide, cyclone] = await Promise.all([
    predictFloodRisk(lat, lon).catch(() => ({ type: 'FLOOD', icon: '🌊', risk: 'LOW', description: 'Unable to fetch' })),
    predictEarthquakeRisk(lat, lon).catch(() => ({ type: 'EARTHQUAKE', icon: '🏔️', risk: 'LOW', description: 'Unable to fetch' })),
    predictLandslideRisk(lat, lon).catch(() => ({ type: 'LANDSLIDE', icon: '⛰️', risk: 'LOW', description: 'Unable to fetch' })),
    predictCycloneRisk(lat, lon).catch(() => ({ type: 'CYCLONE', icon: '🌀', risk: 'LOW', description: 'Unable to fetch' })),
  ]);

  // Overall risk = highest of all
  const risks = [flood, earthquake, landslide, cyclone];
  const riskOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 };
  const overallRisk = risks.reduce(
    (max, r) => (riskOrder[r.risk] > riskOrder[max] ? r.risk : max),
    'LOW'
  );

  return {
    overallRisk,
    predictions: { flood, earthquake, landslide, cyclone },
    highRiskTypes: risks.filter((r) => r.risk === 'HIGH').map((r) => r.type),
    generated_at: new Date().toISOString(),
  };
}
