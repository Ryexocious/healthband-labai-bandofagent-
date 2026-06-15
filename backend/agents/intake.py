"""
Intake Agent — parses raw user input into a structured HealthProfile.
Model: gpt-4o (multimodal — reads images + PDFs + text)
Channel: #intake
"""

from __future__ import annotations

import json
import logging

from .base import BaseAgent

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are the Intake Agent in the HealthBand multi-agent medical advisory system.
Your ONLY job is to parse and structure raw user health input.

You receive: free-text symptoms, IoT readings, and optionally file analysis results.
You output: a strict JSON HealthProfile object. Nothing else.

Rules:
- Never diagnose. Never recommend. Only structure input.
- If emergency keywords detected (chest pain, stroke, unconscious, can't breathe,
  severe bleeding), set emergency_keywords_detected: true immediately.
- Normalize all IoT values to standard units (mg/dL for glucose, mmHg for BP).
- If age is not given, set age_group: "unknown".
- Duration: convert all time expressions to days (e.g. "2 weeks" → 14).
- Severity: use the user's rating if provided (1-10); default to 5 if not available.

Output format: strict JSON matching this schema:
{
  "patient_context": {
    "age_group": "adult|child|elderly|unknown",
    "symptoms": ["symptom1", "symptom2"],
    "duration_days": 14,
    "severity": 7
  },
  "iot_readings": {
    "blood_glucose_mgdl": 248,
    "blood_pressure": "138/88",
    "spo2_percent": 97,
    "hba1c_percent": null,
    "temperature_f": null,
    "weight_kg": null
  },
  "uploaded_files": [
    {"type": "lab_report", "key_findings": ["HbA1c: 8.4%"]}
  ],
  "emergency_keywords_detected": false
}

No markdown. No prose. Only valid JSON."""


class IntakeAgent(BaseAgent):
    agent_name = "Intake Agent"
    model = "gpt-4o"
    channel = "#intake"
    timeout_key = "intake"

    async def run(self, context: dict) -> dict:
        """
        Parse raw user input into a structured HealthProfile.

        context keys:
            - symptoms: str — free-text symptom description
            - iot_readings: dict — raw IoT data (optional)
            - file_analyses: list[dict] — processed file data (optional)
        """
        symptoms = context.get("symptoms", "")
        iot_readings = context.get("iot_readings", {})
        file_analyses = context.get("file_analyses", [])

        # Build user prompt from all input sources
        prompt_parts = []

        if symptoms:
            prompt_parts.append(f"Patient symptoms: {symptoms}")

        if iot_readings:
            prompt_parts.append(f"IoT device readings: {json.dumps(iot_readings)}")

        if file_analyses:
            for fa in file_analyses:
                file_type = fa.get("type", "unknown")
                if fa.get("extracted_text"):
                    prompt_parts.append(
                        f"Uploaded {file_type} text content:\n{fa['extracted_text']}"
                    )
                elif fa.get("key_findings"):
                    prompt_parts.append(
                        f"Uploaded {file_type} findings: {', '.join(fa['key_findings'])}"
                    )

        user_prompt = "\n\n".join(prompt_parts)

        if not user_prompt.strip():
            user_prompt = "No input provided."

        # Check for vision content (images)
        images = []
        for fa in file_analyses:
            if fa.get("base64") and fa.get("type") in ("xray", "mri", "image"):
                from files.vision import build_vision_prompt
                img_parts = build_vision_prompt(fa["base64"], fa["type"])
                images.extend(img_parts)

        result = await self.call_llm(
            system_prompt=SYSTEM_PROMPT,
            user_prompt=user_prompt,
            images=images if images else None,
        )

        return result
