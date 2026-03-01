"""
JSON file-based storage backend.

Good for prototyping, small projects, or when you don't want a database dependency.
Data is stored as a single JSON file on disk.
"""

import json
import os
from pathlib import Path
from typing import Dict, List, Optional
from datetime import datetime
from filelock import FileLock  # pip install filelock

from .base import StorageBackend, PersonRecord


class JSONStorage(StorageBackend):
    """
    Persist enrolled faces as a JSON file.

    Args:
        path: File path for the JSON store (default: ``face_db.json``).

    The file is created automatically if it doesn't exist.
    A file lock is used so multiple processes can safely read/write.
    """

    def __init__(self, path: str = "face_db.json"):
        self._path = Path(path)
        self._lock_path = Path(f"{path}.lock")
        self._lock = FileLock(str(self._lock_path))
        # Ensure parent directory exists
        self._path.parent.mkdir(parents=True, exist_ok=True)
        if not self._path.exists():
            self._write({})

    # ── internal helpers ──────────────────────────────────────────────

    def _read(self) -> Dict[str, dict]:
        with self._lock:
            with open(self._path, "r") as f:
                return json.load(f)

    def _write(self, data: Dict[str, dict]) -> None:
        with self._lock:
            with open(self._path, "w") as f:
                json.dump(data, f, indent=2)

    @staticmethod
    def _record_to_dict(record: PersonRecord) -> dict:
        return {
            "person_id": record.person_id,
            "name": record.name,
            "embedding": record.embedding,
            "metadata": record.metadata,
            "created_at": record.created_at,
            "updated_at": record.updated_at,
        }

    @staticmethod
    def _dict_to_record(d: dict) -> PersonRecord:
        return PersonRecord(
            person_id=d["person_id"],
            name=d["name"],
            embedding=d["embedding"],
            metadata=d.get("metadata", {}),
            created_at=d.get("created_at", ""),
            updated_at=d.get("updated_at", ""),
        )

    # ── public API ────────────────────────────────────────────────────

    def save(self, record: PersonRecord) -> None:
        data = self._read()
        record.updated_at = datetime.utcnow().isoformat()
        data[record.person_id] = self._record_to_dict(record)
        self._write(data)

    def get(self, person_id: str) -> Optional[PersonRecord]:
        data = self._read()
        entry = data.get(person_id)
        return self._dict_to_record(entry) if entry else None

    def get_all(self) -> List[PersonRecord]:
        data = self._read()
        return [self._dict_to_record(v) for v in data.values()]

    def delete(self, person_id: str) -> bool:
        data = self._read()
        if person_id in data:
            del data[person_id]
            self._write(data)
            return True
        return False

    def exists(self, person_id: str) -> bool:
        data = self._read()
        return person_id in data

    def count(self) -> int:
        data = self._read()
        return len(data)
