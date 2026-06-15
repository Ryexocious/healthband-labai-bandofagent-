"""
Doctor Liaison Agent — routes cases to the right specialist.
Model: gpt-4o-mini (fast, structured routing)
Channel: #doctor-comms

Supports two modes:
- Simulated: LLM generates specialist response (demo)
- Real: Interface for actual doctor responses (production)
"""

from __future__ import annotations

import json
import logging
import os

from .base import BaseAgent

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are the Doctor Liaison Agent in HealthBand.
You receive the Reviewer Agent's escalation flag and full case context from Band.

Your job: format a clean clinical brief and assign the right specialist.

Clinical brief rules:
- Write for a medical professional, not the patient.
- Include: chief complaint, key findings, diagnostic candidates, confidence scores,
  reviewer notes, and specific questions needing specialist input.
- Do NOT include raw agent JSON in the brief — translate to clinical language.
- Maximum 300 words.

Specialist matching logic:
- endocrinologist → diabetes, thyroid, metabolic, hormonal conditions
- cardiologist → cardiac, hypertension, chest pain, ECG findings
- radiologist → any imaging analysis flagged for review
- pulmonologist → respiratory, SpO2 concerns, lung findings
- neurologist → neurological symptoms, stroke risk, headache patterns
- general_practitioner → low-complexity, multi-system, or unclear cases

Output format: strict JSON matching this schema:
{
  "case_id": "HC-20260602-0041",
  "assigned_doctor": "dr_001",
  "specialty_match": "endocrinologist",
  "mode": "async",
  "status": "sent",
  "clinical_brief": "...",
  "eta_hours": 4,
  "priority": "normal"
}

For emergencies:
- Set mode: "on-call"
- Set priority: "critical"
- Set eta_hours: 0

No markdown. No prose. Only valid JSON."""


DOCTOR_SIMULATION_PROMPT = """You are Dr. {doctor_name}, a {specialty} reviewing a case via HealthBand.

You have received the following clinical brief:
{clinical_brief}

Full case context:
{case_context}

Respond as a real {specialty} would. Provide:
1. Your professional assessment of the diagnostic findings
2. Any additional tests or investigations you'd recommend
3. Preliminary treatment considerations (general, not prescriptions)
4. Follow-up timeline
5. Any concerns or areas needing further evaluation

Keep your response clear, professional, and under 400 words.
Output format: JSON with keys: response_text, recommendations (list), follow_up_needed (bool)"""


class DoctorLiaisonAgent(BaseAgent):
    agent_name = "Doctor Liaison"
    model = "gpt-4o-mini"
    channel = "#doctor-comms"
    timeout_key = "liaison"

    async def run(self, context: dict) -> dict:
        """
        Format clinical brief and assign specialist.

        context keys:
            - case_id: str
            - reviewer_data: dict — ReviewerOutput
            - band_context: str — Full Band channel history
            - doctor_directory: list[dict] — Available doctors
        """
        case_id = context.get("case_id", "HC-UNKNOWN")
        reviewer_data = context.get("reviewer_data", {})
        band_context = context.get("band_context", "")
        doctors = context.get("doctor_directory", [])

        user_prompt = f"""Route this case to the appropriate specialist.

Case ID: {case_id}

=== REVIEWER OUTPUT (from #review) ===
{json.dumps(reviewer_data, indent=2)}

=== AVAILABLE DOCTORS ===
{json.dumps(doctors, indent=2)}

=== FULL BAND CONTEXT ===
{band_context}

Create a clinical brief for the assigned specialist and determine the routing mode."""

        result = await self.call_llm(
            system_prompt=SYSTEM_PROMPT,
            user_prompt=user_prompt,
        )

        # Ensure case_id is set
        result["case_id"] = case_id

        return result

    async def simulate_doctor_response(
        self,
        doctor_name: str,
        specialty: str,
        clinical_brief: str,
        case_context: str,
    ) -> dict:
        """
        Generate a simulated doctor response using the LLM.
        Used in demo mode when SIMULATE_DOCTOR_RESPONSE=true.
        """
        prompt = DOCTOR_SIMULATION_PROMPT.format(
            doctor_name=doctor_name,
            specialty=specialty,
            clinical_brief=clinical_brief,
            case_context=case_context,
        )

        result = await self.call_llm(
            system_prompt=f"You are Dr. {doctor_name}, a {specialty}.",
            user_prompt=prompt,
        )

        return result
