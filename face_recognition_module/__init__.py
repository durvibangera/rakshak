"""
face_recognition_module
=======================

A standalone, use-case-agnostic face recognition package.

Quick start::

    from face_recognition_module import FaceRecognition

    fr = FaceRecognition()                         # JSON file storage by default
    fr.enroll("alice", "Alice Johnson", "photo.jpg")
    results = fr.identify("some_image.jpg")

See ``FaceRecognition`` for the full API.
"""

from .core import FaceRecognition, IdentifyResult, VerifyResult, FaceLocation
from .storage.base import PersonRecord, StorageBackend
from .storage.json_storage import JSONStorage
from .storage.sqlite_storage import SQLiteStorage
from .exceptions import (
    FaceRecognitionError,
    NoFaceDetectedError,
    MultipleFacesError,
    PersonNotFoundError,
    PersonAlreadyExistsError,
    InvalidImageError,
)

__all__ = [
    # Main class
    "FaceRecognition",
    # Result types
    "IdentifyResult",
    "VerifyResult",
    "FaceLocation",
    # Storage
    "PersonRecord",
    "StorageBackend",
    "JSONStorage",
    "SQLiteStorage",
    # Exceptions
    "FaceRecognitionError",
    "NoFaceDetectedError",
    "MultipleFacesError",
    "PersonNotFoundError",
    "PersonAlreadyExistsError",
    "InvalidImageError",
]

__version__ = "1.0.0"
