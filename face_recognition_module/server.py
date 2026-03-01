"""
Face Recognition Microservice
==============================

A lightweight FastAPI server that wraps the face_recognition_module,
exposing REST endpoints for the Rakshak Next.js app to call.

Endpoints:
    POST /api/extract-embedding   — Extract a 512-dim face embedding from a base64 image
    POST /api/compare             — Compare two embeddings (cosine similarity)
    POST /api/identify            — Match a face against a list of candidate embeddings

Run:
    cd face_recognition_module
    uvicorn server:app --host 0.0.0.0 --port 8100 --reload
"""

from __future__ import annotations

import base64
import logging
from typing import Dict, List, Optional

import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from face_recognition_module.core import FaceRecognition
from face_recognition_module.exceptions import (
    InvalidImageError,
    MultipleFacesError,
    NoFaceDetectedError,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── App setup ─────────────────────────────────────────────────────────────────

app = FastAPI(title="Rakshak Face Recognition Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Headless engine — we only use the InsightFace model for embedding extraction,
# not the storage layer (Supabase handles persistence in Rakshak).
fr = FaceRecognition(threshold=0.45)


# ── Request / Response models ─────────────────────────────────────────────────

class ExtractEmbeddingRequest(BaseModel):
    """Base64-encoded image (JPEG/PNG). Data-URI prefix is stripped automatically."""
    image_base64: str
    allow_multiple: bool = False  # if True, returns embeddings for ALL detected faces


class EmbeddingResponse(BaseModel):
    success: bool
    embedding: Optional[List[float]] = None       # single face
    embeddings: Optional[List[List[float]]] = None  # multiple faces
    face_count: int = 0
    error: Optional[str] = None


class CompareRequest(BaseModel):
    embedding_a: List[float]
    embedding_b: List[float]


class CompareResponse(BaseModel):
    similarity: float
    is_match: bool
    threshold: float


class IdentifyCandidate(BaseModel):
    id: str
    embedding: List[float]
    metadata: Optional[Dict] = None


class IdentifyRequest(BaseModel):
    image_base64: str
    candidates: List[IdentifyCandidate]
    threshold: Optional[float] = None


class IdentifyMatch(BaseModel):
    candidate_id: str
    similarity: float
    metadata: Optional[Dict] = None


class IdentifyResponse(BaseModel):
    success: bool
    matches: List[IdentifyMatch] = []
    face_count: int = 0
    error: Optional[str] = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _decode_base64_image(b64: str) -> bytes:
    """Strip optional data-URI prefix and decode base64 to raw bytes."""
    if "," in b64:
        b64 = b64.split(",", 1)[1]
    return base64.b64decode(b64)


def _cosine_similarity(a: List[float], b: List[float]) -> float:
    v1, v2 = np.array(a), np.array(b)
    dot = np.dot(v1, v2)
    n1, n2 = np.linalg.norm(v1), np.linalg.norm(v2)
    if n1 == 0 or n2 == 0:
        return 0.0
    return float(dot / (n1 * n2))


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.post("/api/extract-embedding", response_model=EmbeddingResponse)
async def extract_embedding(req: ExtractEmbeddingRequest):
    """
    Extract face embedding(s) from a base64 image.

    - Single-face mode (default): returns one 512-dim vector. Fails if 0 or >1 face.
    - Multi-face mode (allow_multiple=True): returns a list of embeddings.
    """
    try:
        image_bytes = _decode_base64_image(req.image_base64)
        img = fr._engine.get(
            __import__("cv2").imdecode(
                np.frombuffer(image_bytes, np.uint8),
                __import__("cv2").IMREAD_COLOR,
            )
        )

        if not img:
            return EmbeddingResponse(
                success=False, face_count=0, error="No face detected in image"
            )

        if req.allow_multiple:
            embeddings = [face.normed_embedding.tolist() for face in img]
            return EmbeddingResponse(
                success=True, embeddings=embeddings, face_count=len(img)
            )

        if len(img) > 1:
            return EmbeddingResponse(
                success=False,
                face_count=len(img),
                error=f"Expected 1 face, found {len(img)}. Use allow_multiple=true for multi-face images.",
            )

        embedding = img[0].normed_embedding.tolist()
        return EmbeddingResponse(success=True, embedding=embedding, face_count=1)

    except Exception as exc:
        logger.exception("Embedding extraction failed")
        return EmbeddingResponse(success=False, error=str(exc))


@app.post("/api/compare", response_model=CompareResponse)
async def compare_embeddings(req: CompareRequest):
    """Compute cosine similarity between two embedding vectors."""
    sim = _cosine_similarity(req.embedding_a, req.embedding_b)
    return CompareResponse(
        similarity=round(sim, 6),
        is_match=sim >= fr.threshold,
        threshold=fr.threshold,
    )


@app.post("/api/identify", response_model=IdentifyResponse)
async def identify_against_candidates(req: IdentifyRequest):
    """
    Extract face(s) from the image and match each against a provided list of candidates.
    Returns the best match per detected face (if above threshold).
    """
    try:
        image_bytes = _decode_base64_image(req.image_base64)
        import cv2

        faces = fr._engine.get(
            cv2.imdecode(np.frombuffer(image_bytes, np.uint8), cv2.IMREAD_COLOR)
        )

        if not faces:
            return IdentifyResponse(success=False, face_count=0, error="No face detected")

        threshold = req.threshold if req.threshold is not None else fr.threshold
        matches: list[IdentifyMatch] = []

        for face in faces:
            emb = face.normed_embedding.tolist()
            best_id, best_score, best_meta = None, 0.0, None
            for cand in req.candidates:
                score = _cosine_similarity(emb, cand.embedding)
                if score > best_score:
                    best_score = score
                    best_id = cand.id
                    best_meta = cand.metadata
            if best_id and best_score >= threshold:
                matches.append(
                    IdentifyMatch(
                        candidate_id=best_id,
                        similarity=round(best_score, 6),
                        metadata=best_meta,
                    )
                )

        return IdentifyResponse(success=True, matches=matches, face_count=len(faces))

    except Exception as exc:
        logger.exception("Identification failed")
        return IdentifyResponse(success=False, error=str(exc))


@app.get("/health")
async def health():
    return {"status": "ok", "model": "insightface", "embedding_dim": 512}
