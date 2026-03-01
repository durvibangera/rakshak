/**
 * Face Recognition Service Client
 * ================================
 *
 * Thin wrapper around the Python face_recognition_module microservice.
 * All Next.js API routes that need face embeddings or matching should
 * use this module instead of the old extractColorEncoding() approach.
 *
 * The Python service must be running:
 *   cd face_recognition_module && uvicorn server:app --port 8100
 *
 * Environment variable (optional):
 *   FACE_RECOGNITION_URL — defaults to http://localhost:8100
 */

const FACE_SERVICE_URL = process.env.FACE_RECOGNITION_URL || 'http://localhost:8100';

/**
 * Cosine similarity between two embedding vectors (JS fallback).
 * Used when comparing embeddings already stored in Supabase —
 * doesn't require a round-trip to the Python service.
 */
export function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, nA = 0, nB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    nA += a[i] * a[i];
    nB += b[i] * b[i];
  }
  if (nA === 0 || nB === 0) return 0;
  return dot / (Math.sqrt(nA) * Math.sqrt(nB));
}

/** Default similarity threshold for ArcFace 512-dim embeddings */
export const FACE_MATCH_THRESHOLD = 0.45;

/**
 * Extract a 512-dimensional ArcFace face embedding from a base64 image.
 *
 * @param {string} imageBase64 — Base64-encoded JPEG/PNG (data-URI prefix OK)
 * @param {boolean} [allowMultiple=false] — If true, returns an array of embeddings for all faces
 * @returns {Promise<{ success: boolean, embedding?: number[], embeddings?: number[][], face_count: number, error?: string }>}
 */
export async function extractFaceEmbedding(imageBase64, allowMultiple = false) {
  try {
    const res = await fetch(`${FACE_SERVICE_URL}/api/extract-embedding`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_base64: imageBase64,
        allow_multiple: allowMultiple,
      }),
    });

    if (!res.ok) {
      return { success: false, face_count: 0, error: `Face service returned ${res.status}` };
    }

    return await res.json();
  } catch (err) {
    console.error('[FaceRecognition] Service unreachable:', err.message);
    return {
      success: false,
      face_count: 0,
      error: `Face recognition service unreachable at ${FACE_SERVICE_URL}. Is the Python server running?`,
    };
  }
}

/**
 * Find the best matching candidate from a list by comparing embeddings.
 * Runs entirely in JS — no network call needed.
 *
 * @param {number[]} queryEmbedding — The embedding to search with
 * @param {{ id: string, face_encoding: number[], [key: string]: any }[]} candidates — Rows from Supabase
 * @param {number} [threshold] — Minimum similarity to count as a match
 * @returns {{ match: object|null, score: number }}
 */
export function findBestMatch(queryEmbedding, candidates, threshold = FACE_MATCH_THRESHOLD) {
  let bestMatch = null;
  let bestScore = 0;

  for (const candidate of candidates) {
    if (!candidate.face_encoding) continue;
    const score = cosineSimilarity(queryEmbedding, candidate.face_encoding);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = candidate;
    }
  }

  if (bestScore < threshold) {
    return { match: null, score: bestScore };
  }

  return { match: bestMatch, score: bestScore };
}
