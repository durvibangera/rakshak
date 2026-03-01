"""
SQLite storage backend.

Good for production single-server deployments —  zero-config, no extra server,
supports concurrent reads, and keeps data in a single portable file.
"""

import json
import sqlite3
from pathlib import Path
from typing import List, Optional
from datetime import datetime

from .base import StorageBackend, PersonRecord


class SQLiteStorage(StorageBackend):
    """
    Persist enrolled faces in a SQLite database.

    Args:
        path: File path for the SQLite database (default: ``face_db.sqlite``).

    The database and table are created automatically on first use.
    """

    _CREATE_TABLE = """
        CREATE TABLE IF NOT EXISTS persons (
            person_id   TEXT PRIMARY KEY,
            name        TEXT    NOT NULL,
            embedding   TEXT    NOT NULL,
            metadata    TEXT    DEFAULT '{}',
            created_at  TEXT    NOT NULL,
            updated_at  TEXT    NOT NULL
        )
    """

    def __init__(self, path: str = "face_db.sqlite"):
        self._path = Path(path)
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(str(self._path), check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute(self._CREATE_TABLE)
        self._conn.commit()

    # ── helpers ───────────────────────────────────────────────────────

    @staticmethod
    def _row_to_record(row: sqlite3.Row) -> PersonRecord:
        return PersonRecord(
            person_id=row["person_id"],
            name=row["name"],
            embedding=json.loads(row["embedding"]),
            metadata=json.loads(row["metadata"]),
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

    # ── public API ────────────────────────────────────────────────────

    def save(self, record: PersonRecord) -> None:
        now = datetime.utcnow().isoformat()
        record.updated_at = now
        self._conn.execute(
            """
            INSERT INTO persons (person_id, name, embedding, metadata, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(person_id) DO UPDATE SET
                name       = excluded.name,
                embedding  = excluded.embedding,
                metadata   = excluded.metadata,
                updated_at = excluded.updated_at
            """,
            (
                record.person_id,
                record.name,
                json.dumps(record.embedding),
                json.dumps(record.metadata),
                record.created_at,
                now,
            ),
        )
        self._conn.commit()

    def get(self, person_id: str) -> Optional[PersonRecord]:
        cur = self._conn.execute(
            "SELECT * FROM persons WHERE person_id = ?", (person_id,)
        )
        row = cur.fetchone()
        return self._row_to_record(row) if row else None

    def get_all(self) -> List[PersonRecord]:
        cur = self._conn.execute("SELECT * FROM persons")
        return [self._row_to_record(r) for r in cur.fetchall()]

    def delete(self, person_id: str) -> bool:
        cur = self._conn.execute(
            "DELETE FROM persons WHERE person_id = ?", (person_id,)
        )
        self._conn.commit()
        return cur.rowcount > 0

    def exists(self, person_id: str) -> bool:
        cur = self._conn.execute(
            "SELECT 1 FROM persons WHERE person_id = ? LIMIT 1", (person_id,)
        )
        return cur.fetchone() is not None

    def count(self) -> int:
        cur = self._conn.execute("SELECT COUNT(*) AS c FROM persons")
        return cur.fetchone()["c"]

    def close(self) -> None:
        """Close the database connection."""
        self._conn.close()
