"""
Core face recognition engine.

This is the main class you interact with. It wraps InsightFace and a pluggable
storage backend into four high-level operations:

    enroll    – Register a person with their photo
    identify  – "Who is this?" (1:N search)
    verify    – "Is this person X?" (1:1 comparison)
    remove    – Delete a person from the database
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple, Union

import cv2
import numpy as np
from insightface.app import FaceAnalysis

from .exceptions import (
    MultipleFacesError,
    NoFaceDetectedError,
    PersonAlreadyExistsError,
    PersonNotFoundError,
)
from .storage.base import PersonRecord, StorageBackend
from .storage.json_storage import JSONStorage
from .utils import ImageInput, load_image

logger = logging.getLogger(__name__)


# ── Result dataclasses ────────────────────────────────────────────────────────

@dataclass
class FaceLocation:
    """Bounding box and metadata for one detected face."""
    bbox: List[int]              # [x1, y1, x2, y2]
    detection_score: float       # 0‒1 confidence from the detector
    landmarks: Optional[List]    # facial landmarks (may be None)


@dataclass
class IdentifyResult:
    """Result of an ``identify()`` call for a single face."""
    person_id: Optional[str]     # None if no match above threshold
    name: Optional[str]          # None if no match
    confidence: float            # best cosine similarity score
    face: FaceLocation           # where the face was in the image
    metadata: Dict = field(default_factory=dict)


@dataclass
class VerifyResult:
    """Result of a ``verify()`` call."""
    is_match: bool
    confidence: float
    face: FaceLocation


# ── Main class ────────────────────────────────────────────────────────────────

class FaceRecognition:
    """
    High-level face recognition engine.

    Args:
        storage:        A ``StorageBackend`` instance (default: ``JSONStorage("face_db.json")``).
        model_name:     InsightFace model pack — ``"buffalo_sc"`` (small/fast) or
                        ``"buffalo_l"`` (large/accurate).
        det_size:       Detection input size as ``(width, height)``.
        providers:      ONNX Runtime execution providers
                        (e.g. ``['CUDAExecutionProvider', 'CPUExecutionProvider']``).
        threshold:      Default cosine-similarity threshold for a positive match (0‒1).

    Example::

        from face_recognition_module import FaceRecognition

        fr = FaceRecognition()
        fr.enroll("alice", "Alice Johnson", "alice_photo.jpg")
        results = fr.identify("unknown_photo.jpg")
        for r in results:
            print(r.person_id, r.confidence)
    """

    def __init__(
        self,
        storage: Optional[StorageBackend] = None,
        model_name: str = "buffalo_sc",
        det_size: Tuple[int, int] = (640, 640),
        providers: Optional[List[str]] = None,
        threshold: float = 0.5,
    ):
        self.storage = storage or JSONStorage()
        self.threshold = threshold
        self._embedding_dim = 512

        if providers is None:
            providers = ["CPUExecutionProvider"]

        logger.info("Loading InsightFace model '%s' …", model_name)
        self._engine = FaceAnalysis(name=model_name, providers=providers)
        self._engine.prepare(ctx_id=0, det_size=det_size)
        logger.info("Model ready.")

    # ── Public API ────────────────────────────────────────────────────

    def enroll(
        self,
        person_id: str,
        name: str,
        image: ImageInput,
        metadata: Optional[Dict] = None,
        overwrite: bool = False,
    ) -> PersonRecord:
        """
        Register a person by extracting a face embedding from their photo.

        Args:
            person_id:  Unique identifier (employee code, UUID, username, …).
            name:       Human-readable name.
            image:      Photo containing **exactly one** face.
                        Accepts a file path, raw bytes, or a numpy array.
            metadata:   Optional dict of extra info to store (department, role, …).
            overwrite:  If ``True``, silently replace an existing enrollment.

        Returns:
            The created ``PersonRecord``.

        Raises:
            PersonAlreadyExistsError: If *person_id* exists and *overwrite* is ``False``.
            NoFaceDetectedError:      If no face is found in the image.
            MultipleFacesError:       If more than one face is found.
        """
        if not overwrite and self.storage.exists(person_id):
            raise PersonAlreadyExistsError(person_id)

        img = load_image(image)
        faces = self._engine.get(img)

        if len(faces) == 0:
            raise NoFaceDetectedError("No face detected in the enrollment image")
        if len(faces) > 1:
            raise MultipleFacesError(len(faces))

        embedding = faces[0].normed_embedding.tolist()
        record = PersonRecord(
            person_id=person_id,
            name=name,
            embedding=embedding,
            metadata=metadata or {},
        )
        self.storage.save(record)
        logger.info("Enrolled '%s' (%s)", person_id, name)
        return record

    def identify(
        self,
        image: ImageInput,
        threshold: Optional[float] = None,
        top_k: int = 1,
    ) -> List[IdentifyResult]:
        """
        Detect **every** face in *image* and match each against the enrolled database.

        This is a 1:N search. Use it when you don't know who's in the image.

        Args:
            image:     The image to scan (path, bytes, or numpy array).
            threshold: Override the default similarity threshold for this call.
            top_k:     (reserved for future use) Number of candidates per face.

        Returns:
            A list of ``IdentifyResult`` — one per detected face.
            If a face has no match above the threshold, ``person_id`` and ``name``
            will be ``None`` but the entry is still returned so you know a face
            was there.

        Raises:
            NoFaceDetectedError: If no faces are found in the image.
        """
        threshold = threshold if threshold is not None else self.threshold
        img = load_image(image)
        faces = self._engine.get(img)

        if len(faces) == 0:
            raise NoFaceDetectedError("No faces detected in the image")

        # Load all enrolled embeddings once
        all_records = self.storage.get_all()
        enrolled: List[Tuple[str, str, List[float], Dict]] = [
            (r.person_id, r.name, r.embedding, r.metadata) for r in all_records
        ]

        results: List[IdentifyResult] = []

        for face in faces:
            embedding = face.normed_embedding.tolist()
            face_loc = self._face_location(face)

            best_id, best_name, best_score, best_meta = None, None, 0.0, {}
            for pid, pname, pemb, pmeta in enrolled:
                score = self._cosine_similarity(embedding, pemb)
                if score > best_score:
                    best_score = score
                    best_id = pid
                    best_name = pname
                    best_meta = pmeta

            if best_score < threshold:
                best_id, best_name, best_meta = None, None, {}

            results.append(
                IdentifyResult(
                    person_id=best_id,
                    name=best_name,
                    confidence=best_score,
                    face=face_loc,
                    metadata=best_meta,
                )
            )
            logger.debug(
                "Face at %s → %s (%.3f)", face_loc.bbox, best_id or "Unknown", best_score
            )

        return results

    def identify_all(
        self,
        image: ImageInput,
        threshold: Optional[float] = None,
    ) -> List[IdentifyResult]:
        """
        Same as ``identify()`` but returns an empty list instead of raising
        ``NoFaceDetectedError`` when no faces are found.

        Convenient when processing video frames where empty frames are normal.
        """
        try:
            return self.identify(image, threshold=threshold)
        except NoFaceDetectedError:
            return []

    def verify(
        self,
        person_id: str,
        image: ImageInput,
        threshold: Optional[float] = None,
    ) -> VerifyResult:
        """
        1:1 verification — "Is the person in *image* the same as *person_id*?"

        Args:
            person_id: The enrolled person to compare against.
            image:     Photo containing **exactly one** face.
            threshold: Override the default similarity threshold.

        Returns:
            ``VerifyResult`` with ``is_match``, ``confidence``, and face location.

        Raises:
            PersonNotFoundError:  If *person_id* is not enrolled.
            NoFaceDetectedError:  If no face is found in the image.
            MultipleFacesError:   If more than one face is found.
        """
        threshold = threshold if threshold is not None else self.threshold
        record = self.storage.get(person_id)
        if record is None:
            raise PersonNotFoundError(person_id)

        img = load_image(image)
        faces = self._engine.get(img)

        if len(faces) == 0:
            raise NoFaceDetectedError("No face detected in the verification image")
        if len(faces) > 1:
            raise MultipleFacesError(len(faces))

        embedding = faces[0].normed_embedding.tolist()
        score = self._cosine_similarity(embedding, record.embedding)
        face_loc = self._face_location(faces[0])

        return VerifyResult(
            is_match=score >= threshold,
            confidence=score,
            face=face_loc,
        )

    def remove(self, person_id: str) -> bool:
        """
        Remove a person from the database.

        Args:
            person_id: The person to delete.

        Returns:
            ``True`` if the person existed and was removed, ``False`` otherwise.
        """
        deleted = self.storage.delete(person_id)
        if deleted:
            logger.info("Removed '%s'", person_id)
        return deleted

    def list_enrolled(self) -> List[PersonRecord]:
        """Return all enrolled person records."""
        return self.storage.get_all()

    @property
    def enrolled_count(self) -> int:
        """Number of people currently enrolled."""
        return self.storage.count()

    # ── Helpers ───────────────────────────────────────────────────────

    @staticmethod
    def _cosine_similarity(a: List[float], b: List[float]) -> float:
        v1 = np.array(a)
        v2 = np.array(b)
        dot = np.dot(v1, v2)
        n1 = np.linalg.norm(v1)
        n2 = np.linalg.norm(v2)
        if n1 == 0 or n2 == 0:
            return 0.0
        return float(dot / (n1 * n2))

    @staticmethod
    def _face_location(face) -> FaceLocation:
        return FaceLocation(
            bbox=face.bbox.astype(int).tolist(),
            detection_score=float(face.det_score),
            landmarks=(
                face.landmark.tolist()
                if hasattr(face, "landmark") and face.landmark is not None
                else None
            ),
        )
