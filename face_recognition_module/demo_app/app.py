"""
Face Recognition Module — Demo Web App
=======================================

A self-contained web UI that showcases every operation exposed by the
face_recognition_module package:

    • Enroll   – register a person with a photo
    • Identify – upload a photo and find out who's in it (1:N)
    • Verify   – confirm whether a photo matches a specific person (1:1)
    • Remove   – delete an enrolled person
    • List     – browse all enrolled people

Run:
    cd face_recognition_module
    uvicorn demo_app.app:app --reload

Then open http://127.0.0.1:8000 in a browser.
"""

from __future__ import annotations

import base64
import io
import sys
from pathlib import Path

import cv2
import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

# Ensure the parent package is importable when running from the repo root
# demo_app/app.py → face_recognition_module/ → D:\yes  (where the package lives)
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from face_recognition_module import (
    FaceRecognition,
    SQLiteStorage,
    NoFaceDetectedError,
    MultipleFacesError,
    PersonAlreadyExistsError,
    PersonNotFoundError,
    InvalidImageError,
)

# ── App setup ─────────────────────────────────────────────────────────────────

app = FastAPI(title="Face Recognition Demo")

DEMO_DIR = Path(__file__).resolve().parent
templates = Jinja2Templates(directory=str(DEMO_DIR / "templates"))
app.mount("/static", StaticFiles(directory=str(DEMO_DIR / "static")), name="static")

# Storage lives next to this script so it's easy to reset
DB_PATH = DEMO_DIR / "demo_faces.sqlite"

fr = FaceRecognition(
    storage=SQLiteStorage(str(DB_PATH)),
    threshold=0.45,
)


# ── Pages ─────────────────────────────────────────────────────────────────────

@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


# ── API endpoints ─────────────────────────────────────────────────────────────

@app.post("/api/enroll")
async def api_enroll(
    person_id: str = Form(...),
    name: str = Form(...),
    photo: UploadFile = File(...),
):
    """Enroll a new person (single-face photo required)."""
    image_bytes = await photo.read()
    try:
        record = fr.enroll(person_id, name, image_bytes, overwrite=False)
        return {
            "ok": True,
            "person_id": record.person_id,
            "name": record.name,
        }
    except PersonAlreadyExistsError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    except NoFaceDetectedError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except MultipleFacesError as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Expected 1 face in the photo, found {exc.count}. Please use a photo with a single face.",
        )
    except InvalidImageError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/api/identify")
async def api_identify(photo: UploadFile = File(...)):
    """Identify all faces in the uploaded image."""
    image_bytes = await photo.read()
    try:
        img_np = cv2.imdecode(np.frombuffer(image_bytes, np.uint8), cv2.IMREAD_COLOR)
        results = fr.identify(image_bytes)
    except NoFaceDetectedError:
        return {"ok": True, "faces": [], "annotated_image": None}
    except InvalidImageError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    # Draw bounding boxes on the image
    if img_np is not None:
        for r in results:
            x1, y1, x2, y2 = r.face.bbox
            label = r.name if r.name else "Unknown"
            conf = f"{r.confidence:.1%}"
            color = (0, 200, 0) if r.person_id else (0, 0, 220)
            cv2.rectangle(img_np, (x1, y1), (x2, y2), color, 2)
            cv2.putText(
                img_np,
                f"{label} ({conf})",
                (x1, y1 - 10),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.7,
                color,
                2,
            )
        _, buf = cv2.imencode(".jpg", img_np)
        b64 = base64.b64encode(buf.tobytes()).decode()
    else:
        b64 = None

    return {
        "ok": True,
        "faces": [
            {
                "person_id": r.person_id,
                "name": r.name,
                "confidence": round(r.confidence, 4),
                "bbox": r.face.bbox,
            }
            for r in results
        ],
        "annotated_image": b64,
    }


@app.post("/api/verify")
async def api_verify(
    person_id: str = Form(...),
    photo: UploadFile = File(...),
):
    """Verify whether the face in the photo matches person_id."""
    image_bytes = await photo.read()
    try:
        result = fr.verify(person_id, image_bytes)
        return {
            "ok": True,
            "is_match": result.is_match,
            "confidence": round(result.confidence, 4),
            "bbox": result.face.bbox,
        }
    except PersonNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except NoFaceDetectedError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except MultipleFacesError as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Expected 1 face, found {exc.count}. Verification requires a single face.",
        )
    except InvalidImageError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.delete("/api/person/{person_id}")
async def api_remove(person_id: str):
    """Remove an enrolled person."""
    deleted = fr.remove(person_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Person '{person_id}' not found")
    return {"ok": True, "deleted": person_id}


@app.get("/api/enrolled")
async def api_list_enrolled():
    """Return all enrolled people."""
    records = fr.list_enrolled()
    return {
        "ok": True,
        "count": len(records),
        "people": [
            {
                "person_id": r.person_id,
                "name": r.name,
                "metadata": r.metadata,
                "created_at": r.created_at,
            }
            for r in records
        ],
    }


@app.post("/api/re-enroll")
async def api_re_enroll(
    person_id: str = Form(...),
    name: str = Form(...),
    photo: UploadFile = File(...),
):
    """Re-enroll (overwrite) an existing person."""
    image_bytes = await photo.read()
    try:
        record = fr.enroll(person_id, name, image_bytes, overwrite=True)
        return {
            "ok": True,
            "person_id": record.person_id,
            "name": record.name,
        }
    except NoFaceDetectedError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except MultipleFacesError as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Expected 1 face, found {exc.count}.",
        )
    except InvalidImageError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
