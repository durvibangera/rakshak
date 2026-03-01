"""
Basic Usage Example
===================

Shows how to enroll people and then identify faces in a new image.
"""

from face_recognition_module import FaceRecognition, NoFaceDetectedError

# ── 1. Initialise ────────────────────────────────────────────────────────────
#   By default it stores data in face_db.json in the current directory.
#   For SQLite:
#       from face_recognition_module import FaceRecognition, SQLiteStorage
#       fr = FaceRecognition(storage=SQLiteStorage("my_faces.sqlite"))

fr = FaceRecognition(threshold=0.5)

# ── 2. Enroll people ─────────────────────────────────────────────────────────
#   Each image must contain exactly ONE face.

fr.enroll(
    person_id="emp_001",
    name="Alice Johnson",
    image="photos/alice.jpg",          # file path
    metadata={"department": "Engineering", "badge": "A-1234"},
    overwrite=True,                     # replace if already enrolled
)

fr.enroll(
    person_id="emp_002",
    name="Bob Smith",
    image="photos/bob.jpg",
    metadata={"department": "Operations"},
    overwrite=True,
)

print(f"Enrolled {fr.enrolled_count} people.\n")

# ── 3. Identify unknown faces ────────────────────────────────────────────────
#   Pass any image — it detects ALL faces and tells you who each one is.

try:
    results = fr.identify("photos/group_photo.jpg")
    for r in results:
        if r.person_id:
            print(f"✓ Recognised: {r.name} (confidence {r.confidence:.2f})")
            print(f"  Metadata: {r.metadata}")
        else:
            print(f"✗ Unknown face (best score {r.confidence:.2f})")
        print(f"  Bounding box: {r.face.bbox}\n")
except NoFaceDetectedError:
    print("No faces found in the image.")

# ── 4. Verify a specific person (1:1) ────────────────────────────────────────

result = fr.verify("emp_001", "photos/alice_selfie.jpg")
print(f"Verification: match={result.is_match}, confidence={result.confidence:.2f}")

# ── 5. Remove someone ────────────────────────────────────────────────────────

fr.remove("emp_002")
print(f"\nEnrolled count after removal: {fr.enrolled_count}")
