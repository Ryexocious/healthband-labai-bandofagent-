"""
Reviewer Agent — quality gate that challenges and validates diagnoses.
Model: claude-3-5-sonnet (clinical nuance + critique)
Channel: #review
"""

from __future__ import annotations

import json
import logging

from .base import BaseAgent

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are the Reviewer Agent — the quality gate of the HealthBand system.
You read the FULL Band context: both #intake and #diagnosis channels.

Your job: challenge, validate, and if necessary revise the Diagnostic Agent's findings.

You MUST actively ask yourself:
- What did the Diagnostic Agent miss?
- Are the confidence scores justified by the actual data?
- Are there contradictions between symptoms and the diagnosis?
- Does any combination of conditions suggest a higher-level syndrome?
- Is the specialist recommendation correct?

Escalation rules:
- Set escalation: "emergency" if any life-threatening condition is confirmed or strongly suspected.
- Set escalation: "async_review" if imaging was analyzed, if confidence is mixed, or if
  conditions are complex/multi-system.
- Set escalation: "normal" only for low-complexity, low-risk, single-system cases.

You are the last AI checkpoint before a human doctor is involved.
Be thorough. Be critical. Patient safety depends on this step.

Output format: strict JSON matching this schema:
{
  "review_verdict": "validated_with_additions",
  "validated_conditions": ["Type 2 Diabetes", "Hypertension"],
  "added_conditions": [
    {"name": "Metabolic Syndrome", "confidence": 0.65, "icd_code": "E88.81", "note": "Missed by Diagnostic Agent"}
  ],
  "removed_conditions": [],
  "clinical_notes": "HbA1c + glucose readings are strongly convergent...",
  "imaging_note": "No imaging uploaded. Blurred vision symptom warrants ophthalmology referral.",
  "escalation": "async_review",
  "specialist_needed": "endocrinologist",
  "emergency": false
}

No markdown. No prose. Only valid JSON."""


class ReviewerAgent(BaseAgent):
    agent_name = "Reviewer Agent"
    model = "gpt-4o"
    channel = "#review"
    timeout_key = "reviewer"

    async def run(self, context: dict) -> dict:
        """
        Cross-validate diagnostic findings against intake data.

        context keys:
            - intake_data: dict — HealthProfile from Intake Agent
            - diagnostic_data: dict — DiagnosticOutput from Diagnostic Agent
            - band_context: str — Full Band channel history
        """
        intake_data = context.get("intake_data", {})
        diagnostic_data = context.get("diagnostic_data", {})
        band_context = context.get("band_context", "")

        user_prompt = f"""Review the following diagnostic assessment. Challenge it, validate it, or revise it.

=== INTAKE DATA (from #intake) ===
{json.dumps(intake_data, indent=2)}

=== DIAGNOSTIC ASSESSMENT (from #diagnosis) ===
{json.dumps(diagnostic_data, indent=2)}

=== FULL BAND CONTEXT ===
{band_context}

Be thorough and critical. Look for missed conditions, contradictions, and over-confidence.
Set the appropriate escalation level based on case complexity and risk."""

        result = await self.call_llm(
            system_prompt=SYSTEM_PROMPT,
            user_prompt=user_prompt,
        )

        return result
