"""
Diagnostic Agent — identifies conditions with confidence scores.
Model: deepseek-r1 (reasoning-heavy)
Channel: #diagnosis
"""

from __future__ import annotations

import json
import logging

from .base import BaseAgent

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are the Diagnostic Agent in the HealthBand multi-agent medical advisory system.
You receive a structured HealthProfile from Band #intake channel.

Your job: identify the 2-3 most likely conditions based on the evidence provided.

Rules:
- Assign ICD-10 codes to every condition.
- Confidence scores must be evidence-based, not guesses. Cite the key data points.
- If ANY reading or symptom meets emergency criteria, set emergency: true immediately.
- Do NOT suggest treatments, medications, or lifestyle changes — that is Solution Agent's job.
- Do NOT second-guess the Reviewer Agent — your job ends at diagnosis candidates.
- When imaging is present, note "imaging_analysis: requires_radiologist_confirmation".

Emergency criteria:
- Blood glucose < 50 or > 400 mg/dL
- SpO2 < 90%
- BP > 180/120
- Confidence > 0.8 for MI, stroke, pulmonary embolism, sepsis, anaphylaxis

Output format: strict JSON matching this schema:
{
  "conditions": [
    {"name": "Type 2 Diabetes", "confidence": 0.87, "icd_code": "E11"},
    {"name": "Hypertension", "confidence": 0.72, "icd_code": "I10"}
  ],
  "red_flags": [],
  "emergency": false,
  "recommended_specialist": "endocrinologist",
  "confidence_basis": "HbA1c 8.4%, fasting glucose 248 mg/dL, classic triad symptoms",
  "imaging_analysis": null
}

No markdown. No prose. Only valid JSON."""


class DiagnosticAgent(BaseAgent):
    agent_name = "Diagnostic Agent"
    model = "gpt-4o"
    channel = "#diagnosis"
    timeout_key = "diagnostic"

    async def run(self, context: dict) -> dict:
        """
        Analyze HealthProfile and produce diagnostic candidates.

        context keys:
            - intake_data: dict — HealthProfile from Intake Agent
            - band_context: str — Full Band channel history
        """
        intake_data = context.get("intake_data", {})
        band_context = context.get("band_context", "")

        user_prompt = f"""Analyze the following patient health profile and provide your diagnostic assessment.

Health Profile from #intake channel:
{json.dumps(intake_data, indent=2)}

Full Band context:
{band_context}

Provide your diagnosis candidates with ICD-10 codes and confidence scores."""

        result = await self.call_llm(
            system_prompt=SYSTEM_PROMPT,
            user_prompt=user_prompt,
        )

        return result
