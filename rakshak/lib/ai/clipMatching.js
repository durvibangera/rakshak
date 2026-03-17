/**
 * CLIP Matching Integration
 * Provides text-to-image ranking using CLIP model
 */

const CLIP_SERVICE_URL = process.env.FACE_SERVICE_URL || 'http://localhost:5001';

/**
 * Build a natural language description from structured report fields
 */
export function buildDescription(report) {
  const parts = [];
  
  // Age
  if (report.age_min && report.age_max) {
    parts.push(`age ${report.age_min}-${report.age_max}`);
  } else if (report.age) {
    parts.push(`age ${report.age}`);
  }
  
  // Gender
  if (report.gender) {
    parts.push(report.gender.toLowerCase());
  }
  
  // Physical attributes
  if (report.height) {
    parts.push(`${report.height} height`);
  }
  if (report.build) {
    parts.push(`${report.build} build`);
  }
  if (report.skin_tone) {
    parts.push(`${report.skin_tone} skin`);
  }
  
  // Hair
  if (report.hair_color && report.hair_length) {
    parts.push(`${report.hair_length} ${report.hair_color} hair`);
  } else if (report.hair_color) {
    parts.push(`${report.hair_color} hair`);
  } else if (report.hair_length) {
    parts.push(`${report.hair_length} hair`);
  }
  
  // Facial hair
  if (report.facial_hair && report.facial_hair !== 'clean_shaven') {
    parts.push(report.facial_hair);
  }
  
  // Distinguishing marks
  if (report.distinguishing_marks) {
    parts.push(report.distinguishing_marks);
  }
  
  // Accessories
  if (report.accessories) {
    parts.push(`wearing ${report.accessories}`);
  }
  
  // Clothing
  if (report.clothing_description) {
    parts.push(report.clothing_description);
  }
  
  // Other identifying details
  if (report.identifying_details) {
    parts.push(report.identifying_details);
  }
  
  return parts.join(', ');
}

/**
 * Rank candidates using CLIP text-to-image matching
 * 
 * @param {Object} report - Missing person report with structured fields
 * @param {Array} candidates - Array of candidate objects with image URLs
 * @returns {Promise<Array>} - Candidates sorted by CLIP similarity
 */
export async function rankWithCLIP(report, candidates) {
  try {
    // Build natural language description
    const description = buildDescription(report);
    
    if (!description) {
      console.warn('[CLIP] No description could be built from report');
      return candidates;
    }
    
    console.log(`[CLIP] Ranking ${candidates.length} candidates with description: "${description}"`);
    
    // Call CLIP service
    const response = await fetch(`${CLIP_SERVICE_URL}/clip-rank`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description,
        candidates: candidates.map(c => ({
          id: c.id,
          name: c.name,
          image_url: c.selfie_url,
          // Pass through other fields
          phone: c.phone,
          gender: c.gender,
          height: c.height,
          build: c.build,
          skin_tone: c.skin_tone,
          hair_color: c.hair_color,
          hair_length: c.hair_length,
          facial_hair: c.facial_hair,
          distinguishing_marks: c.distinguishing_marks,
          match_score: c.match_score,
          match_confidence: c.match_confidence,
          matched_attributes: c.matched_attributes,
        }))
      }),
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `CLIP service returned ${response.status}`);
    }
    
    const rankedCandidates = await response.json();
    
    console.log(`[CLIP] Ranked candidates. Top 3 similarities: ${
      rankedCandidates.slice(0, 3).map(c => c.clip_similarity.toFixed(3)).join(', ')
    }`);
    
    return rankedCandidates;
    
  } catch (error) {
    console.error('[CLIP] Ranking failed:', error.message);
    // Return original candidates if CLIP fails
    return candidates;
  }
}

/**
 * Check if CLIP service is available
 */
export async function checkCLIPHealth() {
  try {
    const response = await fetch(`${CLIP_SERVICE_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(2000), // 2 second timeout
    });
    
    if (!response.ok) return false;
    
    const data = await response.json();
    return data.status === 'ok';
    
  } catch (error) {
    return false;
  }
}
