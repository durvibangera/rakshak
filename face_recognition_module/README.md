# face_recognition_module

A standalone, use-case-agnostic face recognition package. Drop it into **any** Python project that needs face enrollment, identification, or verification — attendance systems, access control, safety monitoring, customer tracking, etc.

Built on [InsightFace](https://github.com/deepinsight/insightface) (ArcFace embeddings).

## Installation

```bash
pip install insightface onnxruntime opencv-python-headless numpy filelock
```

Or use the bundled requirements:

```bash
pip install -r requirements.txt
```

Then copy (or symlink) the `face_recognition_module/` folder into your project, or install it with:

```bash
pip install -e .
```

## Quick Start

```python
from face_recognition_module import FaceRecognition

fr = FaceRecognition()

# Enroll people (one face per image)
fr.enroll("alice", "Alice Johnson", "alice_photo.jpg")
fr.enroll("bob",   "Bob Smith",     "bob_photo.jpg")

# Identify faces in a new image (1:N)
results = fr.identify("group_photo.jpg")
for r in results:
    print(r.name, r.confidence, r.face.bbox)

# Verify a specific person (1:1)
result = fr.verify("alice", "selfie.jpg")
print(result.is_match, result.confidence)

# Remove someone
fr.remove("bob")
```

## API Reference

### `FaceRecognition(storage, model_name, det_size, providers, threshold)`

| Parameter    | Type               | Default                  | Description                                     |
| ------------ | ------------------ | ------------------------ | ----------------------------------------------- |
| `storage`    | `StorageBackend`   | `JSONStorage()`          | Where embeddings are persisted                   |
| `model_name` | `str`              | `"buffalo_sc"`           | InsightFace model (`buffalo_sc` or `buffalo_l`) |
| `det_size`   | `(int, int)`       | `(640, 640)`             | Detection input resolution                       |
| `providers`  | `list[str]`        | `["CPUExecutionProvider"]` | ONNX Runtime providers (add CUDA for GPU)      |
| `threshold`  | `float`            | `0.5`                   | Cosine similarity threshold for a positive match |

### Methods

| Method                              | Description                                           |
| ----------------------------------- | ----------------------------------------------------- |
| `enroll(person_id, name, image)`    | Register a person (image must have exactly 1 face)    |
| `identify(image)`                   | Detect all faces and match each against the DB (1:N)  |
| `identify_all(image)`               | Same as `identify` but returns `[]` on no faces       |
| `verify(person_id, image)`          | Check if the face belongs to a specific person (1:1)  |
| `remove(person_id)`                 | Delete a person from the database                     |
| `list_enrolled()`                   | Return all `PersonRecord` objects                     |
| `enrolled_count`                    | Property — number of enrolled people                  |

### Image Input

Every method that takes `image` accepts:
- **File path** (`str` or `Path`)
- **Raw bytes** (`bytes` — e.g. from an HTTP upload)
- **NumPy array** (`np.ndarray` in BGR format — e.g. from OpenCV)

### Result Types

**`IdentifyResult`** (returned by `identify()`):
```python
person_id: str | None    # None if no match
name: str | None
confidence: float        # cosine similarity (0–1)
face: FaceLocation       # .bbox, .detection_score, .landmarks
metadata: dict           # whatever you stored during enrollment
```

**`VerifyResult`** (returned by `verify()`):
```python
is_match: bool
confidence: float
face: FaceLocation
```

## Storage Backends

### JSONStorage (default)
```python
from face_recognition_module import FaceRecognition, JSONStorage
fr = FaceRecognition(storage=JSONStorage("my_faces.json"))
```
Single JSON file. Good for prototyping and small datasets.

### SQLiteStorage
```python
from face_recognition_module import FaceRecognition, SQLiteStorage
fr = FaceRecognition(storage=SQLiteStorage("my_faces.sqlite"))
```
Single-file database. Better for production — supports concurrent reads, indexed lookups.

### Custom Backend
Subclass `StorageBackend` and implement 6 methods:
```python
from face_recognition_module import StorageBackend, PersonRecord

class RedisStorage(StorageBackend):
    def save(self, record: PersonRecord) -> None: ...
    def get(self, person_id: str) -> PersonRecord | None: ...
    def get_all(self) -> list[PersonRecord]: ...
    def delete(self, person_id: str) -> bool: ...
    def exists(self, person_id: str) -> bool: ...
    def count(self) -> int: ...
```

## Storing Extra Data

Use the `metadata` dict to attach any use-case-specific info:

```python
fr.enroll("emp_001", "Alice", "photo.jpg", metadata={
    "department": "Engineering",
    "badge_number": "A-1234",
    "access_level": 3,
})

results = fr.identify("frame.jpg")
for r in results:
    if r.person_id:
        print(r.metadata["department"])
```

## Examples

| File                                                         | Description                         |
| ------------------------------------------------------------ | ----------------------------------- |
| [`examples/basic_usage.py`](examples/basic_usage.py)         | Enroll + identify + verify          |
| [`examples/webcam_identification.py`](examples/webcam_identification.py) | Live camera with bounding boxes |
| [`examples/fastapi_integration.py`](examples/fastapi_integration.py)     | REST API with FastAPI           |

## GPU Acceleration

```python
fr = FaceRecognition(
    providers=["CUDAExecutionProvider", "CPUExecutionProvider"]
)
```

Requires `onnxruntime-gpu` instead of `onnxruntime`.

## Error Handling

```python
from face_recognition_module import (
    NoFaceDetectedError,
    MultipleFacesError,
    PersonNotFoundError,
    PersonAlreadyExistsError,
    InvalidImageError,
)

try:
    fr.enroll("x", "X", "bad_photo.jpg")
except NoFaceDetectedError:
    print("No face in the photo")
except MultipleFacesError as e:
    print(f"Found {e.count} faces, need exactly 1")
```
