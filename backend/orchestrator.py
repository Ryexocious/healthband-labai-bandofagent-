"""
Case Orchestrator — manages case lifecycle via Band Cloud natively.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from datetime import datetime
from typing import Optional

from doctors.directory import DoctorDirectory
from models.schemas import (
    Case,
    CaseStatus,
    DoctorResponse,
)
from prisma import Prisma

logger = logging.getLogger(__name__)

class CaseOrchestrator:
    def __init__(self, db: Prisma):
        self.doctor_directory = DoctorDirectory()
        self.db = db

    async def get_case(self, case_id: str) -> Optional[Case]:
        db_case = await self.db.case.find_unique(where={"case_id": case_id})
        if not db_case:
            return None
        return Case.model_validate(db_case.model_dump())

    async def list_cases(self) -> list[dict]:
        db_cases = await self.db.case.find_many(order={"created_at": "desc"})
        return [
            {"case_id": c.case_id, "status": c.status, "created_at": c.created_at.isoformat()}
            for c in db_cases
        ]

    async def run_case(
        self,
        symptoms: str,
        prescription_amount: Optional[str] = None,
        iot_readings: Optional[dict] = None,
        file_analyses: Optional[list[dict]] = None,
        patient_id: Optional[str] = None,
    ) -> Case:
        """
        Create a new case, open a Band Cloud Chat Room, post the context, and exit.
        The 5 agents (running via band_runner.py) will pick it up automatically.
        """
        case = Case(
            symptoms=symptoms,
            prescription_amount=prescription_amount,
            iot_readings=iot_readings,
            uploaded_files_info=[f.get("filename", "unknown") for f in (file_analyses or [])],
        )

        import sys
        original_path = sys.path[:]
        sys.path = [p for p in sys.path if not p.endswith('backend') and p != '']
        from band.client.rest import AsyncRestClient
        sys.path = original_path

        # Use Pharmacy key to post the initial message so IntakeAgent actually receives it
        # (Agents typically don't receive their own messages)
        client = AsyncRestClient(
            api_key=os.getenv("BAND_PHARMACY_API_KEY"),
            base_url="https://app.band.ai"
        )

        try:
            # Create the chat room
            chat = await client.agent_api_chats.create_agent_chat(chat={})
            room_id = chat.data.id
            
            # Add all 5 agents as participants so they join the room
            agent_ids = {
                "intake": os.getenv("BAND_INTAKE_AGENT_ID"),
                "diagnostic": os.getenv("BAND_DIAGNOSTIC_AGENT_ID"),
                "reviewer": os.getenv("BAND_REVIEWER_AGENT_ID"),
                "liaison": os.getenv("BAND_LIAISON_AGENT_ID"),
                "solution": os.getenv("BAND_SOLUTION_AGENT_ID"),
            }
            for name, agent_id in agent_ids.items():
                if agent_id:
                    try:
                        await client.agent_api_participants.add_agent_chat_participant(
                            chat_id=room_id,
                            participant={"participant_id": agent_id, "role": "member"}
                        )
                        logger.info(f"Added {name} agent ({agent_id}) to room {room_id}")
                    except Exception as ex:
                        logger.warning(f"Could not add {name} agent to room: {ex}")
            
            create_data = {
                "case_id": case.case_id,
                "status": CaseStatus.intake,
                "symptoms": case.symptoms,
                "prescription_amount": case.prescription_amount,
                "iot_readings": json.dumps(case.iot_readings) if case.iot_readings is not None else None,
                "uploaded_files_info": json.dumps(case.uploaded_files_info) if case.uploaded_files_info is not None else None,
                "agent_statuses": json.dumps([a.model_dump(mode="json") for a in case.agent_statuses]),
                "band_room_id": room_id
            }
            if patient_id:
                create_data["patient"] = {"connect": {"id": patient_id}}

            await self.db.case.create(data=create_data)

            # Post the first message to trigger the pipeline
            content = {
                "symptoms": symptoms,
                "iot_readings": iot_readings or {},
                "file_analyses": file_analyses or []
            }
            intake_agent_id = agent_ids["intake"]
            await client.agent_api_messages.create_agent_chat_message(
                chat_id=room_id,
                message={"content": json.dumps(content), "mentions": [{"id": intake_agent_id}]}
            )

            case.status = CaseStatus.intake
            logger.info(f"Started case {case.case_id} in Band Room {chat.data.id}")

            return case

        except Exception as e:
            logger.error(f"Failed to start case pipeline via Band API: {e}")
            raise

    async def submit_doctor_response(
        self,
        case_id: str,
        doctor_id: str,
        response_text: str,
        recommendations: list[str] | None = None,
        follow_up_needed: bool = False,
    ) -> Optional[DoctorResponse]:
        """
        Submit a real doctor's response to a case natively on Band Cloud.
        """
        db_case = await self.db.case.find_unique(where={"case_id": case_id})
        if not db_case or not db_case.band_room_id:
            return None

        doctor = self.doctor_directory.get_by_id(doctor_id)
        if not doctor:
            db_user = await self.db.user.find_unique(where={"id": doctor_id})
            if db_user and db_user.role == "DOCTOR":
                from doctors.directory import Doctor
                doctor = Doctor({
                    "id": db_user.id,
                    "name": db_user.name,
                    "specialty": "general_practitioner",
                    "availability": "async"
                })
        
        if not doctor:
            return None

        response = DoctorResponse(
            doctor_id=doctor.id,
            doctor_name=doctor.name,
            specialty=doctor.specialty,
            response_text=response_text,
            recommendations=recommendations or [],
            follow_up_needed=follow_up_needed,
            is_simulated=False,
        )

        # Update Database
        await self.db.case.update(
            where={"id": db_case.id},
            data={
                "doctor_response": json.dumps(response.model_dump(mode="json")),
                "status": "solution"
            }
        )

        # Post to Band Cloud!
        try:
            import sys
            original_path = sys.path[:]
            sys.path = [p for p in sys.path if not p.endswith('backend') and p != '']
            from band.client.rest import AsyncRestClient
            sys.path = original_path
            
            client = AsyncRestClient(
                api_key=os.getenv("BAND_SOLUTION_API_KEY"),
                base_url="https://app.band.ai"
            ) # using any agent key is fine
            solution_agent_id = os.getenv("BAND_SOLUTION_AGENT_ID")
            await client.agent_api_messages.create_agent_chat_message(
                chat_id=db_case.band_room_id,
                message={"content": json.dumps(response.model_dump(mode='json')), "mentions": [{"id": solution_agent_id}]}
            )
        except Exception as e:
            logger.error(f"Failed to submit doctor response to Band Cloud: {e}")

        logger.info(f"Real doctor response received from {doctor.name}")
        return response
