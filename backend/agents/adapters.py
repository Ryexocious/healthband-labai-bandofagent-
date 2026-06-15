import json
import logging
import os
from typing import Any

from band.core.simple_adapter import SimpleAdapter
from band.core.types import PlatformMessage
from band.core.protocols import AgentToolsProtocol
from prisma import Prisma

from agents.intake import IntakeAgent
from agents.diagnostic import DiagnosticAgent
from agents.reviewer import ReviewerAgent
from agents.liaison import DoctorLiaisonAgent
from agents.solution import SolutionAgent
from agents.pharmacy import PharmacyAgent

logger = logging.getLogger(__name__)

# Map mention names to environment variable names for agent UUIDs
AGENT_ID_MAP = {
    "@IntakeAgent": "BAND_INTAKE_AGENT_ID",
    "@DiagnosticAgent": "BAND_DIAGNOSTIC_AGENT_ID",
    "@ReviewerAgent": "BAND_REVIEWER_AGENT_ID",
    "@DoctorLiaison": "BAND_LIAISON_AGENT_ID",
    "@SolutionAgent": "BAND_SOLUTION_AGENT_ID",
    "@PharmacyAgent": "BAND_PHARMACY_AGENT_ID",
}

class BaseHealthbandAdapter(SimpleAdapter[Any]):
    def __init__(self, db: Prisma, agent_instance: Any, next_agent_mention: str | None = None, output_field: str = ""):
        super().__init__()
        self.db = db
        self.agent_instance = agent_instance
        self.next_agent_mention = next_agent_mention
        self.output_field = output_field

    async def on_message(
        self,
        msg: PlatformMessage,
        tools: AgentToolsProtocol,
        history: Any,
        participants_msg: str | None,
        contacts_msg: str | None,
        *,
        is_session_bootstrap: bool,
        room_id: str,
    ) -> None:
        try:
            logger.info(f"[{self.agent_instance.agent_name}] Received message in room {room_id}")
            logger.info(f"Message attributes: {dir(msg)}")
            logger.info(f"Message content: {msg.content}")
            
            # Extract content. If it's the first message, it's JSON from orchestrator.
            # Otherwise it's from another agent.
            try:
                # Find the first { to gracefully ignore any @mentions at the beginning
                text = msg.content
                start_idx = text.find('{')
                if start_idx != -1:
                    context = json.loads(text[start_idx:])
                else:
                    context = json.loads(text)
            except Exception:
                # If not JSON, we can assume it's just plain text
                context = {"symptoms": msg.content}
            
            # The context must be merged with existing DB case to ensure we have all data
            # Or we can just let the orchestrator pass the full case data.
            # Wait, the DB lookup:
            case = await self.db.case.find_first(where={"band_room_id": room_id})
            if not case:
                logger.error(f"No case found for room {room_id}")
                return

            expected_status = {
                "intake_output": "intake",
                "diagnostic_output": "diagnosis",
                "reviewer_output": "review",
                "liaison_output": "liaison",
                "solution_output": "solution",
                "pharmacy_output": "pharmacy"
            }.get(self.output_field)
            
            if case.status != expected_status:
                logger.info(f"[{self.agent_instance.agent_name}] Ignoring message because case status is '{case.status}', expected '{expected_status}'.")
                return

            if isinstance(context, dict):
                # add what we have in DB
                if case.iot_readings and "iot_readings" not in context:
                    context["iot_readings"] = json.loads(case.iot_readings) if isinstance(case.iot_readings, str) else case.iot_readings
                if case.uploaded_files_info and "file_analyses" not in context:
                    context["file_analyses"] = json.loads(case.uploaded_files_info) if isinstance(case.uploaded_files_info, str) else case.uploaded_files_info
                
                # specific to agents
                def _safe_load(val):
                    if not val: return {}
                    return json.loads(val) if isinstance(val, str) else val

                # Dynamically construct band_context from case history
                history_parts = []
                if case.symptoms:
                    history_parts.append(f"Patient Reported Symptoms:\n{case.symptoms}")
                if case.iot_readings:
                    history_parts.append(f"IoT Readings:\n{json.dumps(_safe_load(case.iot_readings), indent=2)}")
                if case.intake_output:
                    history_parts.append(f"Intake Assessment (Health Profile):\n{json.dumps(_safe_load(case.intake_output), indent=2)}")
                if case.diagnostic_output:
                    history_parts.append(f"Diagnostic Assessment:\n{json.dumps(_safe_load(case.diagnostic_output), indent=2)}")
                if case.reviewer_output:
                    history_parts.append(f"Reviewer Assessment:\n{json.dumps(_safe_load(case.reviewer_output), indent=2)}")
                if case.liaison_output:
                    history_parts.append(f"Doctor Liaison Report:\n{json.dumps(_safe_load(case.liaison_output), indent=2)}")
                if case.doctor_response:
                    history_parts.append(f"On-Call Specialist Verdict:\n{json.dumps(_safe_load(case.doctor_response), indent=2)}")
                if case.solution_output:
                    history_parts.append(f"Solution Treatment Plan:\n{json.dumps(_safe_load(case.solution_output), indent=2)}")
                
                context["band_context"] = "\n\n".join(history_parts)

                if self.output_field == "diagnostic_output":
                    context["health_profile"] = _safe_load(case.intake_output)
                elif self.output_field == "reviewer_output":
                    context["diagnostic_output"] = _safe_load(case.diagnostic_output)
                elif self.output_field == "liaison_output":
                    context["reviewer_output"] = _safe_load(case.reviewer_output)
                    context["diagnostic_output"] = _safe_load(case.diagnostic_output)
                    context["health_profile"] = _safe_load(case.intake_output)
                elif self.output_field == "solution_output":
                    context["doctor_response"] = _safe_load(case.doctor_response)
                    context["diagnostic_output"] = _safe_load(case.diagnostic_output)
                    context["reviewer_output"] = _safe_load(case.reviewer_output)
                    context["health_profile"] = _safe_load(case.intake_output)
                    context["emergency"] = case.emergency
                elif self.output_field == "pharmacy_output":
                    context["solution_output"] = _safe_load(case.solution_output)
                    context["prescription_amount"] = case.prescription_amount

            # Run local logic
            result = await self.agent_instance.run(context)
            
            # Save to DB
            new_status = case.status
            if self.output_field == "intake_output":
                new_status = "diagnosis"
            elif self.output_field == "diagnostic_output":
                new_status = "review"
            elif self.output_field == "reviewer_output":
                new_status = "liaison"
            elif self.output_field == "liaison_output":
                new_status = "DOCTOR_REVIEW"
            elif self.output_field == "solution_output":
                new_status = "pharmacy"
            elif self.output_field == "pharmacy_output":
                new_status = "completed"

            await self.db.case.update(
                where={"id": case.id},
                data={
                    self.output_field: json.dumps(result),
                    "status": new_status
                }
            )
            
            # Broadcast to Band Chat using mentions with agent UUIDs
            if self.next_agent_mention:
                env_key = AGENT_ID_MAP.get(self.next_agent_mention)
                agent_id = os.getenv(env_key) if env_key else None
                if agent_id:
                    await tools.send_message(
                        content=json.dumps(result),
                        mentions=[{"id": agent_id}]
                    )
                else:
                    logger.warning(f"No agent ID found for {self.next_agent_mention}, sending without mention")
                    await tools.send_message(content=json.dumps(result))
            else:
                await tools.send_message(content=json.dumps(result))
            
        except Exception as e:
            logger.exception(f"Error in {self.agent_instance.agent_name} adapter: {e}")
            await tools.send_event(content=str(e), message_type="error")

class IntakeBandAdapter(BaseHealthbandAdapter):
    def __init__(self, db: Prisma):
        super().__init__(db, IntakeAgent(), "@DiagnosticAgent", "intake_output")

class DiagnosticBandAdapter(BaseHealthbandAdapter):
    def __init__(self, db: Prisma):
        super().__init__(db, DiagnosticAgent(), "@ReviewerAgent", "diagnostic_output")

class ReviewerBandAdapter(BaseHealthbandAdapter):
    def __init__(self, db: Prisma):
        super().__init__(db, ReviewerAgent(), "@DoctorLiaison", "reviewer_output")

class LiaisonBandAdapter(BaseHealthbandAdapter):
    def __init__(self, db: Prisma):
        super().__init__(db, DoctorLiaisonAgent(), None, "liaison_output")

    async def on_message(self, msg, tools, history, participants_msg, contacts_msg, *, is_session_bootstrap, room_id):
        # Call base logic to run liaison agent
        await super().on_message(msg, tools, history, participants_msg, contacts_msg, is_session_bootstrap=is_session_bootstrap, room_id=room_id)
        
        # After liaison runs, check if we need to simulate doctor response
        import os
        import asyncio
        if os.getenv("SIMULATE_DOCTOR_RESPONSE", "true").lower() == "true":
            try:
                case = await self.db.case.find_first(where={"band_room_id": room_id})
                if case and case.liaison_output:
                    liaison_result = json.loads(case.liaison_output) if isinstance(case.liaison_output, str) else case.liaison_output
                    doctor_id = liaison_result.get("assigned_doctor", "")
                    from doctors.directory import DoctorDirectory
                    directory = DoctorDirectory()
                    doctor = directory.get_by_id(doctor_id)

                    if doctor:
                        logger.info(f"Simulating 3s doctor response delay...")
                        await asyncio.sleep(3)
                        
                        context = {"band_context": ""} # In native band, they see it anyway
                        sim_result = await self.agent_instance.simulate_doctor_response(
                            doctor_name=doctor.name,
                            specialty=doctor.specialty,
                            clinical_brief=liaison_result.get("clinical_brief", ""),
                            case_context=context
                        )

                        # Create doctor response object dict
                        doc_res = {
                            "doctor_id": doctor.id,
                            "doctor_name": doctor.name,
                            "specialty": doctor.specialty,
                            "response_text": sim_result.get("response_text", ""),
                            "recommendations": sim_result.get("recommendations", []),
                            "follow_up_needed": sim_result.get("follow_up_needed", False),
                            "is_simulated": True,
                        }
                        
                        await self.db.case.update(
                            where={"id": case.id},
                            data={
                                "doctor_response": json.dumps(doc_res),
                                "status": "solution"
                            }
                        )

                        solution_agent_id = os.getenv("BAND_SOLUTION_AGENT_ID")
                        if solution_agent_id:
                            await tools.send_message(
                                content=json.dumps(doc_res),
                                mentions=[{"id": solution_agent_id}]
                            )
                        else:
                            await tools.send_message(content=json.dumps(doc_res))
                        logger.info(f"Simulated response from {doctor.name} sent to Band")
            except Exception as e:
                logger.error(f"Doctor simulation failed: {e}")
        else:
            logger.info("Pipeline paused at DOCTOR_REVIEW. Awaiting manual specialist assessment.")

class SolutionBandAdapter(BaseHealthbandAdapter):
    def __init__(self, db: Prisma):
        super().__init__(db, SolutionAgent(), "@PharmacyAgent", "solution_output")

class PharmacyBandAdapter(BaseHealthbandAdapter):
    def __init__(self, db: Prisma):
        super().__init__(db, PharmacyAgent(), None, "pharmacy_output")
