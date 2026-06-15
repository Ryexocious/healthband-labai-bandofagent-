"""
Band Message Bus — in-memory pub/sub schemas.
These define the message format for inter-agent communication.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class BandMessage(BaseModel):
    """A single message posted to a Band channel."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    channel: str  # e.g. "#intake", "#diagnosis"
    author: str  # Agent name or "doctor:{id}" or "system"
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    message_type: str = "handoff"  # "handoff" | "alert" | "response" | "status"
    content: dict = Field(default_factory=dict)
    tags: list[str] = Field(default_factory=list)
    thread_id: Optional[str] = None
