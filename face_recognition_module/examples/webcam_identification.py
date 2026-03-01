"""
Webcam Identification Example
==============================

Opens the default camera, runs face identification on each frame, and draws
bounding boxes with names in real time.  Press 'q' to quit.

This demonstrates how you'd plug the module into any live-camera use case
(attendance, access control, safety monitoring, etc.).
"""

import cv2
from face_recognition_module import FaceRecognition, SQLiteStorage

# ── Setup ─────────────────────────────────────────────────────────────────────

fr = FaceRecognition(
    storage=SQLiteStorage("my_faces.sqlite"),
    threshold=0.5,
    # Uncomment the next line for GPU acceleration:
    # providers=["CUDAExecutionProvider", "CPUExecutionProvider"],
)

# Make sure you've enrolled at least one person before running this.
# e.g.  fr.enroll("alice", "Alice", "alice_photo.jpg", overwrite=True)

# ── Live loop ─────────────────────────────────────────────────────────────────

cap = cv2.VideoCapture(0)

if not cap.isOpened():
    print("Error: could not open webcam.")
    exit(1)

print("Running live identification.  Press 'q' to quit.")

while True:
    ret, frame = cap.read()
    if not ret:
        break

    # identify_all returns [] instead of raising when no faces are visible
    results = fr.identify_all(frame)

    for r in results:
        x1, y1, x2, y2 = r.face.bbox
        label = f"{r.name} ({r.confidence:.0%})" if r.person_id else "Unknown"
        color = (0, 255, 0) if r.person_id else (0, 0, 255)

        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
        cv2.putText(frame, label, (x1, y1 - 10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)

    cv2.imshow("Face Identification", frame)
    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

cap.release()
cv2.destroyAllWindows()
