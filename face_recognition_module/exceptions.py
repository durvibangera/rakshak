"""
Custom exceptions for the face recognition module.
"""


class FaceRecognitionError(Exception):
    """Base exception for all face recognition errors."""
    pass


class NoFaceDetectedError(FaceRecognitionError):
    """Raised when no face is found in the image."""
    pass


class MultipleFacesError(FaceRecognitionError):
    """Raised when multiple faces are found during enrollment (single-face operation)."""

    def __init__(self, count: int):
        self.count = count
        super().__init__(f"Expected 1 face, found {count}")


class PersonNotFoundError(FaceRecognitionError):
    """Raised when a person_id is not found in the storage backend."""

    def __init__(self, person_id: str):
        self.person_id = person_id
        super().__init__(f"Person '{person_id}' not found")


class PersonAlreadyExistsError(FaceRecognitionError):
    """Raised when trying to enroll a person_id that already exists (and overwrite=False)."""

    def __init__(self, person_id: str):
        self.person_id = person_id
        super().__init__(f"Person '{person_id}' already exists. Use overwrite=True to replace.")


class InvalidImageError(FaceRecognitionError):
    """Raised when the provided image cannot be read or decoded."""
    pass
