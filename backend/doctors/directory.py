"""
Doctor Directory — specialist registry with matching and availability.
Supports both simulated doctors and real doctor integration.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

DOCTORS_FILE = Path(__file__).parent / "doctors.json"


class Doctor:
    """A single doctor entry."""

    def __init__(self, data: dict):
        self.id: str = data["id"]
        self.name: str = data["name"]
        self.specialty: str = data["specialty"]
        self.availability: str = data["availability"]  # "async" | "on-call"
        self.response_sla_hours: int = data.get("response_sla_hours", 4)
        self.languages: list[str] = data.get("languages", ["en"])
        self.bio: str = data.get("bio", "")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "specialty": self.specialty,
            "availability": self.availability,
            "response_sla_hours": self.response_sla_hours,
            "languages": self.languages,
            "bio": self.bio,
        }


class DoctorDirectory:
    """
    Loads doctor data from JSON and provides lookup/matching.

    Supports two modes:
    - Simulated: doctor responses are LLM-generated (demo mode)
    - Real: a real doctor interface can be plugged in (production mode)
    """

    def __init__(self, doctors_file: Path = DOCTORS_FILE):
        self.doctors: list[Doctor] = []
        self._load(doctors_file)

    def _load(self, filepath: Path) -> None:
        """Load doctor registry from JSON file."""
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                data = json.load(f)
            self.doctors = [Doctor(d) for d in data.get("doctors", [])]
            logger.info(f"Loaded {len(self.doctors)} doctors from {filepath}")
        except FileNotFoundError:
            logger.warning(f"Doctor directory not found: {filepath}")
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON in doctor directory: {e}")

    def find_specialist(self, specialty: str) -> Optional[Doctor]:
        """
        Find the best available doctor for a given specialty.
        Falls back to general_practitioner if no exact match.
        """
        # Exact specialty match
        for doc in self.doctors:
            if doc.specialty.lower() == specialty.lower():
                return doc

        # Fallback to GP
        for doc in self.doctors:
            if doc.specialty == "general_practitioner":
                return doc

        # Return first available if nothing matches
        return self.doctors[0] if self.doctors else None

    def get_on_call(self) -> Optional[Doctor]:
        """Get the first available on-call doctor for emergencies."""
        for doc in self.doctors:
            if doc.availability == "on-call":
                return doc
        # In emergency, anyone is better than no one
        return self.doctors[0] if self.doctors else None

    def get_by_id(self, doctor_id: str) -> Optional[Doctor]:
        """Look up a doctor by their ID."""
        for doc in self.doctors:
            if doc.id == doctor_id:
                return doc
        return None

    def list_all(self) -> list[dict]:
        """Return all doctors as dicts (for the API)."""
        return [d.to_dict() for d in self.doctors]

    # ── Specialist mapping (condition → specialty) ─────────────────────

    SPECIALTY_MAP = {
        "diabetes": "endocrinologist",
        "thyroid": "endocrinologist",
        "metabolic": "endocrinologist",
        "hormonal": "endocrinologist",
        "cardiac": "cardiologist",
        "hypertension": "cardiologist",
        "chest pain": "cardiologist",
        "heart": "cardiologist",
        "ecg": "cardiologist",
        "imaging": "radiologist",
        "x-ray": "radiologist",
        "mri": "radiologist",
        "ct scan": "radiologist",
        "respiratory": "pulmonologist",
        "lung": "pulmonologist",
        "breathing": "pulmonologist",
        "spo2": "pulmonologist",
        "neurological": "neurologist",
        "stroke": "neurologist",
        "headache": "neurologist",
        "seizure": "neurologist",
    }

    @classmethod
    def map_condition_to_specialty(cls, condition_or_keyword: str) -> str:
        """Map a condition or keyword to a specialist type."""
        lower = condition_or_keyword.lower()
        for keyword, specialty in cls.SPECIALTY_MAP.items():
            if keyword in lower:
                return specialty
        return "general_practitioner"
