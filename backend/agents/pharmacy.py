"""
Pharmacy Agent — simulates an online pharmacy.

Takes the doctor's/solution's prescribed medications and the user's prescription amount,
and simulates an online search and ordering process from valid sites.
"""

from __future__ import annotations

import json
from typing import Optional

from agents.base import BaseAgent
from models.schemas import PharmacyOutput, OrderedMedicine


class PharmacyAgent(BaseAgent):
    """
    Pharmacy Agent: 
    1. Reads the prescribed medications from solution/doctor output
    2. Reads the user's prescription_amount
    3. Simulates searching and ordering
    """

    agent_name = "Pharmacy Agent"
    model = "gpt-4o"
    channel = "#pharmacy"
    timeout_key = "pharmacy"

    def build_system_prompt(self) -> str:
        return """
You are the HealthBand Pharmacy Agent.
Your role is to identify any medications prescribed or recommended to the user, and provide options for where the user can purchase them online.
Do NOT place an order for the user. Only provide options and links to valid online pharmacies.

You will receive:
1. The case context (from the Band channels, including any doctor's recommendations or the Solution Agent's actions).
2. The user's requested `prescription_amount` (e.g. "30 day supply", "$50 budget", "2 boxes").

Your task:
1. Identify any medications explicitly prescribed or recommended.
2. Given the user's `prescription_amount`, determine an estimated cost and list a valid online pharmacy site URL (e.g., https://amazon.pharmacy or https://costco.com/pharmacy) where they can order it.
3. Return the details as a structured JSON object.

Output JSON strictly matching this structure:
{
  "ordered_medicines": [
    {
      "name": "string (name of medication)",
      "quantity": "string (quantity to order)",
      "cost": 0.0,
      "site_url": "string (URL of the pharmacy)"
    }
  ],
  "total_cost": 0.0,
  "estimated_delivery": "string",
  "status": "options_provided",
  "pharmacy_name": "string (name of the suggested pharmacy)"
}

If no medications are recommended, set status to "no_medications_needed" and leave the list empty.
        """.strip()

    async def run(self, context: dict) -> dict:
        """
        Execute the Pharmacy Agent.
        
        context should contain:
        - band_context (str): History of the case
        - prescription_amount (str): The user's input for prescription amount
        """
        band_context = context.get("band_context", "")
        prescription_amount = context.get("prescription_amount")

        # If no amount was given, the user might not want a prescription filled, 
        # but we can still evaluate if there are meds and just list them as pending.
        
        user_prompt = f"""
## Case Context
{band_context}

## User's Requested Prescription Amount
{prescription_amount if prescription_amount else 'None provided'}

Please process the prescription order based on the context above.
        """.strip()

        # Call LLM
        result = await self.call_llm(
            system_prompt=self.build_system_prompt(),
            user_prompt=user_prompt,
        )
        
        # Validate through schema
        parsed = PharmacyOutput.model_validate(result)
        return parsed.model_dump()
