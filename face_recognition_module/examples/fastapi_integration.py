"""
FastAPI Integration Example
============================

Shows how to build a REST API around the face recognition module
using FastAPI.  This is a minimal template — adapt it to your app.

Run with:  uvicorn fastapi_integration:app --reload
"""

import io
from fastapi import FastAPI, File, UploadFile, HTTPException
from face_recognition_module import (
    FaceRecognition,
    SQLiteStorage,
    NoFaceDetectedError,
    MultipleFacesError,
    PersonAlreadyExistsError,
    PersonNotFoundError,
)

app = FastAPI(title="Face Recognition API")

# Initialise once at startup
fr = FaceRecognition(
    storage=SQLiteStorage("faces.sqlite"),
    threshold=0.5,
)


@app.post("/enroll/{person_id}")
async def enroll(person_id: str, name: str, photo: UploadFile = File(...)):
    """Enroll a new person with a single-face photo."""
    image_bytes = await photo.read()
    try:
        record = fr.enroll(person_id, name, image_bytes, overwrite=True)
        return {"person_id": record.person_id, "name": record.name}
    except (NoFaceDetectedError, MultipleFacesError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/identify")
async def identify(photo: UploadFile = File(...)):
    """Identify all faces in the uploaded image."""
    image_bytes = await photo.read()
    try:
        results = fr.identify(image_bytes)
    except NoFaceDetectedError:
        return {"faces": []}
    return {
        "faces": [
            {
                "person_id": r.person_id,
                "name": r.name,
                "confidence": round(r.confidence, 3),
                "bbox": r.face.bbox,
            }
            for r in results
        ]
    }


@app.post("/verify/{person_id}")
async def verify(person_id: str, photo: UploadFile = File(...)):
    """Verify whether the face belongs to person_id."""
    image_bytes = await photo.read()
    try:
        result = fr.verify(person_id, image_bytes)
        return {
            "is_match": result.is_match,
            "confidence": round(result.confidence, 3),
        }
    except PersonNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except (NoFaceDetectedError, MultipleFacesError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.delete("/person/{person_id}")
async def remove(person_id: str):
    """Remove an enrolled person."""
    deleted = fr.remove(person_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Person '{person_id}' not found")
    return {"deleted": person_id}


@app.get("/enrolled")
async def list_enrolled():
    """List all enrolled people."""
    records = fr.list_enrolled()
    return {
        "count": len(records),
        "people": [
            {"person_id": r.person_id, "name": r.name, "metadata": r.metadata}
            for r in records
        ],
    }
