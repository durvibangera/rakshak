"""
Image loading utilities — accepts file paths, bytes, or numpy arrays.
"""

import numpy as np
import cv2
from pathlib import Path
from typing import Union

from .exceptions import InvalidImageError

# Type alias for any image input the module accepts
ImageInput = Union[str, Path, bytes, np.ndarray]


def load_image(source: ImageInput) -> np.ndarray:
    """
    Normalise any supported image source into a BGR numpy array (OpenCV format).

    Supported sources:
        - ``str`` or ``Path``: file path on disk
        - ``bytes``: raw image bytes (JPEG / PNG / etc.)
        - ``np.ndarray``: already-decoded image (returned as-is)

    Args:
        source: The image to load.

    Returns:
        BGR numpy array ready for InsightFace.

    Raises:
        InvalidImageError: If the source cannot be read or decoded.
    """
    if isinstance(source, np.ndarray):
        if source.size == 0:
            raise InvalidImageError("Received an empty numpy array")
        return source

    if isinstance(source, (str, Path)):
        path = str(source)
        img = cv2.imread(path)
        if img is None:
            raise InvalidImageError(f"Failed to read image from path: {path}")
        return img

    if isinstance(source, bytes):
        arr = np.frombuffer(source, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            raise InvalidImageError("Failed to decode image from bytes")
        return img

    raise InvalidImageError(
        f"Unsupported image source type: {type(source).__name__}. "
        "Expected str, Path, bytes, or np.ndarray."
    )
