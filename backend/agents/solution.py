"""
Solution Agent — generates actionable recommendations for the patient.
Model: claude-3-5-sonnet (empathetic, actionable writing)
Channel: #solutions
"""

from __future__ import annotations

import json
import logging

from .base import BaseAgent

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are the Solution Agent — the final voice the patient hears.
You have access to the FULL Band history: intake, diagnosis, review, and doctor comms.

Your job: deliver clear, safe, actionable recommendations.

Tone rules:
- Warm, clear, and calm. Never alarmist (unless emergency-flagged).
- Write for a non-medical audience. Avoid jargon.
- Always acknowledge uncertainty — never overstate confidence.

Structure every response with:
1. Plain-language summary of what the agents found
2. Immediate actions (things to do today)
3. Lifestyle changes (medium-term)
4. Specialist referrals (who to see + urgency)
5. Warning signs (go to ER if...)
6. Prevention plan (long-term)
7. Mandatory disclaimer

Hard rules:
- NEVER recommend specific prescription medications by name.
- ALWAYS end with the professional consultation disclaimer.
- If doctor has already responded, incorporate their input prominently.
- Emergency cases: lead with emergency action steps before anything else.

Output format: strict JSON matching this schema:
{
  "primary_assessment": "Likely Type 2 Diabetes with concurrent Hypertension",
  "immediate_actions": [
    "Reduce refined carbohydrate intake today",
    "Monitor blood glucose every 6 hours and log readings"
  ],
  "lifestyle_changes": [
    "Mediterranean-style diet with <50g net carbs/day",
    "30-minute walks daily, building to 5x/week"
  ],
  "specialist_referrals": [
    {"type": "endocrinologist", "urgency": "within 1 week"}
  ],
  "warning_signs": [
    "Blood glucose >300 mg/dL → go to ER",
    "Chest pain or shortness of breath → call 911"
  ],
  "prevention_plan": "Regular monitoring, diet management, exercise routine...",
  "disclaimer": "This is informational only and does not replace professional medical advice. Please consult a licensed healthcare provider for diagnosis and treatment."
}

No markdown. No prose. Only valid JSON."""


class SolutionAgent(BaseAgent):
    agent_name = "Solution Agent"
    model = "gpt-4o"
    channel = "#solutions"
    timeout_key = "solution"

    async def run(self, context: dict) -> dict:
        """
        Generate actionable recommendations from the full case history.

        context keys:
            - band_context: str — Full Band channel history (all channels)
            - emergency: bool — Whether this is an emergency case
            - doctor_response: dict — Doctor's response if available (optional)
        """
        band_context = context.get("band_context", "")
        emergency = context.get("emergency", False)
        doctor_response = context.get("doctor_response")

        emergency_prefix = ""
        if emergency:
            emergency_prefix = (
                "⚠️ THIS IS AN EMERGENCY CASE. Lead with emergency action steps "
                "before anything else. Be clear and direct about immediate dangers.\n\n"
            )

        doctor_section = ""
        if doctor_response:
            doctor_section = f"""
=== DOCTOR RESPONSE (from specialist) ===
{json.dumps(doctor_response, indent=2)}

IMPORTANT: Incorporate the doctor's input prominently in your recommendations.
"""

        user_prompt = f"""{emergency_prefix}Generate comprehensive patient recommendations based on the full case analysis.

=== FULL BAND HISTORY ===
{band_context}
{doctor_section}

Provide clear, safe, actionable recommendations following the required structure."""

        result = await self.call_llm(
            system_prompt=SYSTEM_PROMPT,
            user_prompt=user_prompt,
        )

        # Ensure disclaimer is always present
        if "disclaimer" not in result:
            result["disclaimer"] = (
                "This is informational only and does not replace professional medical advice. "
                "Please consult a licensed healthcare provider for diagnosis and treatment."
            )

        return result
