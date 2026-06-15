"""
BaseAgent — abstract base for all HealthBand agents.

Wraps the OpenAI-compatible AI/ML API client with:
- Retry logic (3 attempts, exponential backoff)
- Configurable timeouts per agent
- JSON response parsing
- Optional vision (multimodal) support
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from abc import ABC, abstractmethod
from typing import Optional

from openai import AsyncOpenAI

logger = logging.getLogger(__name__)

# Timeout config per agent (seconds)
AGENT_TIMEOUTS = {
    "intake": 30,
    "diagnostic": 45,
    "reviewer": 30,
    "liaison": 45,
    "solution": 30,
}


class BaseAgent(ABC):
    """
    Abstract base class for HealthBand agents.

    Each agent subclass:
    1. Defines its model, system prompt, and channel
    2. Implements `build_user_prompt()` to format its input
    3. Calls `self.call_llm()` to get a response
    4. Parses the response into a Pydantic schema
    """

    agent_name: str = "BaseAgent"
    model: str = "gpt-4o"
    channel: str = "#unknown"
    timeout_key: str = "intake"

    def __init__(self):
        self.client = AsyncOpenAI(
            api_key=os.getenv("AIML_API_KEY") or os.getenv("FEATHERLESS_API_KEY", ""),
            base_url=os.getenv("AIML_API_BASE") or os.getenv("FEATHERLESS_API_BASE", "https://api.aimlapi.com/v1"),
        )

    async def call_llm(
        self,
        system_prompt: str,
        user_prompt: str,
        images: Optional[list[dict]] = None,
        max_retries: int = 3,
        backoff_seconds: float = 1.5,
    ) -> dict:
        """
        Call the LLM with retry logic and JSON response parsing.

        Args:
            system_prompt: The agent's system prompt
            user_prompt: The formatted user/context prompt
            images: Optional list of image content parts for vision
            max_retries: Number of retry attempts
            backoff_seconds: Base backoff time between retries

        Returns:
            Parsed JSON dict from the LLM response
        """
        timeout = AGENT_TIMEOUTS.get(self.timeout_key, 30)

        # Build messages
        messages = [{"role": "system", "content": system_prompt}]

        if images:
            # Multimodal message with text + images
            content_parts = [{"type": "text", "text": user_prompt}]
            content_parts.extend(images)
            messages.append({"role": "user", "content": content_parts})
        else:
            messages.append({"role": "user", "content": user_prompt})

        last_error = None
        for attempt in range(max_retries):
            try:
                logger.info(
                    f"[{self.agent_name}] Calling {self.model} "
                    f"(attempt {attempt + 1}/{max_retries})"
                )

                response = await asyncio.wait_for(
                    self.client.chat.completions.create(
                        model=self.model,
                        messages=messages,
                        temperature=0.3,
                        max_tokens=2000,
                        response_format={"type": "json_object"},
                    ),
                    timeout=timeout,
                )

                raw_content = response.choices[0].message.content or "{}"

                # Parse JSON — strip markdown fences if present
                cleaned = raw_content.strip()
                if cleaned.startswith("```"):
                    lines = cleaned.split("\n")
                    # Remove first and last lines (``` markers)
                    cleaned = "\n".join(lines[1:-1]).strip()

                result = json.loads(cleaned)
                logger.info(f"[{self.agent_name}] Response received successfully")
                return result

            except asyncio.TimeoutError:
                last_error = TimeoutError(
                    f"{self.agent_name} timed out after {timeout}s"
                )
                logger.warning(f"[{self.agent_name}] Timeout on attempt {attempt + 1}")
            except json.JSONDecodeError as e:
                last_error = e
                logger.warning(
                    f"[{self.agent_name}] JSON parse error on attempt {attempt + 1}: {e}"
                )
            except Exception as e:
                last_error = e
                logger.error(
                    f"[{self.agent_name}] Error on attempt {attempt + 1}: {e}"
                )

            if attempt < max_retries - 1:
                wait_time = backoff_seconds * (attempt + 1)
                logger.info(f"[{self.agent_name}] Retrying in {wait_time}s...")
                await asyncio.sleep(wait_time)

        logger.error(f"[{self.agent_name}] All {max_retries} attempts failed")
        raise last_error or RuntimeError(f"{self.agent_name} failed after all retries")

    @abstractmethod
    async def run(self, context: dict) -> dict:
        """
        Execute this agent's task.

        Args:
            context: Dict containing all necessary input data

        Returns:
            Dict matching the agent's output schema
        """
        ...
