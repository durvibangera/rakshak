"""
Abstract base class for storage backends.

Implement this interface to plug in any database, file system, or cloud store.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Dict, List, Optional
from datetime import datetime


@dataclass
class PersonRecord:
    """
    A single enrolled person.

    Attributes:
        person_id:  Unique identifier (you choose the scheme — name, UUID, employee code, etc.)
        name:       Human-readable display name.
        embedding:  512-dimensional face embedding vector.
        metadata:   Arbitrary extra data you want to store alongside the person.
        created_at: Timestamp of enrollment.
        updated_at: Timestamp of last update.
    """
    person_id: str
    name: str
    embedding: List[float]
    metadata: Dict = field(default_factory=dict)
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())


class StorageBackend(ABC):
    """
    Interface that every storage backend must implement.

    The module ships with ``JSONStorage`` and ``SQLiteStorage``.
    You can create your own by subclassing this and passing it to
    ``FaceRecognition(storage=YourBackend(...))``.
    """

    @abstractmethod
    def save(self, record: PersonRecord) -> None:
        """Insert or update a person record."""
        ...

    @abstractmethod
    def get(self, person_id: str) -> Optional[PersonRecord]:
        """Return the record for *person_id*, or ``None`` if not found."""
        ...

    @abstractmethod
    def get_all(self) -> List[PersonRecord]:
        """Return every enrolled person."""
        ...

    @abstractmethod
    def delete(self, person_id: str) -> bool:
        """Delete *person_id*. Return ``True`` if it existed, ``False`` otherwise."""
        ...

    @abstractmethod
    def exists(self, person_id: str) -> bool:
        """Check whether *person_id* is enrolled."""
        ...

    @abstractmethod
    def count(self) -> int:
        """Return the total number of enrolled people."""
        ...
