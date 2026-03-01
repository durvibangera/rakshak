/**
 * FILE: route.js (Multi-Disaster Prediction API)
 * PURPOSE: Predict all disaster types for a given location.
 *
 * USAGE:
 *   GET /api/predict?lat=19.076&lon=72.8777           → All disasters
 *   GET /api/predict?lat=19.076&lon=72.8777&type=flood → Specific type
 */

import { NextResponse } from 'next/server';
import {
  predictFloodRisk,
  predictEarthquakeRisk,
  predictLandslideRisk,
  predictCycloneRisk,
  predictAllRisks,
} from '@/lib/external/weatherService';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = parseFloat(searchParams.get('lat'));
    const lon = parseFloat(searchParams.get('lon'));
    const type = searchParams.get('type') || 'all';

    if (isNaN(lat) || isNaN(lon)) {
      return NextResponse.json(
        { error: 'lat and lon query parameters are required (numbers)' },
        { status: 400 }
      );
    }

    let result;

    switch (type) {
      case 'flood':
        result = await predictFloodRisk(lat, lon);
        break;
      case 'earthquake':
        result = await predictEarthquakeRisk(lat, lon);
        break;
      case 'landslide':
        result = await predictLandslideRisk(lat, lon);
        break;
      case 'cyclone':
        result = await predictCycloneRisk(lat, lon);
        break;
      case 'all':
      default:
        result = await predictAllRisks(lat, lon);
        break;
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('[Predict API] Error:', err);
    return NextResponse.json(
      { error: 'Failed to generate prediction', details: err.message },
      { status: 500 }
    );
  }
}
