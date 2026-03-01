# Face Recognition Demo Web App

Interactive web UI that demonstrates every operation in the `face_recognition_module` package.

## Features

| Tab             | Module Method        | Description                                      |
|-----------------|----------------------|--------------------------------------------------|
| **Enroll**      | `fr.enroll()`        | Register a person with a single-face photo       |
| **Identify**    | `fr.identify()`      | 1:N search — detect & match all faces in a photo |
| **Verify**      | `fr.verify()`        | 1:1 check — "Is this person X?"                  |
| **Enrolled**    | `fr.list_enrolled()` | Browse & remove enrolled people                  |

## Quick Start

```bash
# 1. Install dependencies (if not already)
pip install fastapi uvicorn jinja2 python-multipart

# 2. Run from the repo root
cd face_recognition_module
uvicorn demo_app.app:app --reload
```

Then open **http://127.0.0.1:8000** in your browser.

## How to Use

1. **Enroll** — Go to the Enroll tab, enter a unique ID and name, upload a photo with one face, and click *Enroll Person*.
2. **Identify** — Switch to Identify, upload any image. The app detects every face and matches it against enrolled people. Results include an annotated image with bounding boxes.
3. **Verify** — Pick an enrolled person from the dropdown, upload a photo, and check whether it's a match.
4. **Manage** — The Enrolled People tab lets you browse the database and remove entries.

## Tech Stack

- **Backend**: FastAPI + the `face_recognition_module` package (InsightFace under the hood)
- **Storage**: SQLite (via `SQLiteStorage`) — stored as `demo_faces.sqlite` next to the app
- **Frontend**: Vanilla HTML/CSS/JS — no build step required
