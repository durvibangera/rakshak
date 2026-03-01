import { NextResponse } from 'next/server';
import { extractFaceEmbedding } from '@/lib/ai/faceRecognition';

/**
 * POST /api/face-embedding
 * Proxy to the Python face recognition service for extracting ArcFace embeddings.
 * Used by client-side pages (e.g. /register) that can't call the Python service directly.
 *
 * Body: { image_base64: string, allow_multiple?: boolean }
 * Returns: { success, embedding?, embeddings?, face_count, error? }
 */
export async function POST(request) {
  try {
    const { image_base64, allow_multiple } = await request.json();

    if (!image_base64) {
      return NextResponse.json({ success: false, error: 'image_base64 is required' }, { status: 400 });
    }

    const result = await extractFaceEmbedding(image_base64, allow_multiple || false);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[FaceEmbedding] Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
