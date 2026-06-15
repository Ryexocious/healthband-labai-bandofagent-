"""
Band Message Bus — in-memory pub/sub channel system.

This module provides the local Band bus that mirrors the channel architecture
described in the blueprint. It also integrates with the Thenvoi Band SDK
so agents can publish to both the local bus (for API responses) and to
Band platform rooms (for cross-agent collaboration and audit trail).
"""

from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Callable, Optional

from .schemas import BandMessage

logger = logging.getLogger(__name__)


# ── Channel names ──────────────────────────────────────────────────────────

CHANNELS = [
    "#intake",
    "#diagnosis",
    "#review",
    "#doctor-comms",
    "#solutions",
    "#pharmacy",
    "#emergency",
]


class BandChannel:
    """A single named channel with message history and optional subscribers."""

    def __init__(self, name: str):
        self.name = name
        self.messages: list[BandMessage] = []
        self._subscribers: list[Callable[[BandMessage], None]] = []

    def publish(self, message: BandMessage) -> None:
        """Add a message to this channel and notify subscribers."""
        self.messages.append(message)
        logger.info(
            f"[Band {self.name}] {message.author} → {message.message_type} "
            f"({len(json.dumps(message.content))} bytes)"
        )
        for callback in self._subscribers:
            try:
                callback(message)
            except Exception as e:
                logger.error(f"Subscriber error on {self.name}: {e}")

    def subscribe(self, callback: Callable[[BandMessage], None]) -> None:
        """Register a callback for new messages on this channel."""
        self._subscribers.append(callback)

    def get_history(self) -> list[BandMessage]:
        """Return full message history for this channel."""
        return list(self.messages)

    def get_latest(self) -> Optional[BandMessage]:
        """Return the most recent message, or None."""
        return self.messages[-1] if self.messages else None

    def clear(self) -> None:
        """Reset channel history (for new sessions)."""
        self.messages.clear()


class BandBus:
    """
    Manages all Band channels for a single case session.

    Each case gets its own BandBus instance so there's no cross-case
    data leakage. The bus provides publish/subscribe, history aggregation,
    and emergency broadcast functionality.
    """

    def __init__(self):
        self.channels: dict[str, BandChannel] = {
            name: BandChannel(name) for name in CHANNELS
        }
        self._emergency_callbacks: list[Callable[[BandMessage], None]] = []

    def publish(self, channel_name: str, message: BandMessage) -> None:
        """Publish a message to a specific channel."""
        if channel_name not in self.channels:
            raise ValueError(f"Unknown Band channel: {channel_name}")

        message.channel = channel_name
        self.channels[channel_name].publish(message)

        # Emergency broadcast — if posting to #emergency, notify all watchers
        if channel_name == "#emergency":
            for callback in self._emergency_callbacks:
                try:
                    callback(message)
                except Exception as e:
                    logger.error(f"Emergency callback error: {e}")

    def get_channel_history(self, channel_name: str) -> list[BandMessage]:
        """Get full message history for a channel."""
        if channel_name not in self.channels:
            return []
        return self.channels[channel_name].get_history()

    def get_channel_latest(self, channel_name: str) -> Optional[BandMessage]:
        """Get the latest message from a channel."""
        if channel_name not in self.channels:
            return None
        return self.channels[channel_name].get_latest()

    def subscribe(
        self, channel_name: str, callback: Callable[[BandMessage], None]
    ) -> None:
        """Subscribe to new messages on a channel."""
        if channel_name in self.channels:
            self.channels[channel_name].subscribe(callback)

    def on_emergency(self, callback: Callable[[BandMessage], None]) -> None:
        """Register a callback for any emergency broadcast."""
        self._emergency_callbacks.append(callback)

    def build_context(self, channel_names: list[str]) -> str:
        """
        Aggregate Band channel history into a single context string.
        Used by downstream agents to see the full conversation so far.
        """
        context_parts = []
        for ch_name in channel_names:
            messages = self.get_channel_history(ch_name)
            for msg in messages:
                context_parts.append(
                    f"[{msg.channel} | {msg.author} | {msg.timestamp.isoformat()}]\n"
                    f"{json.dumps(msg.content, indent=2)}"
                )
        return "\n\n---\n\n".join(context_parts) if context_parts else ""

    def get_all_channels_summary(self) -> dict[str, int]:
        """Return a summary of message counts per channel."""
        return {
            name: len(ch.messages) for name, ch in self.channels.items()
        }

    def get_all_messages(self) -> list[BandMessage]:
        """Return all messages across all channels, sorted by timestamp."""
        all_msgs = []
        for ch in self.channels.values():
            all_msgs.extend(ch.messages)
        all_msgs.sort(key=lambda m: m.timestamp)
        return all_msgs

    def reset(self) -> None:
        """Clear all channels (new session)."""
        for ch in self.channels.values():
            ch.clear()
