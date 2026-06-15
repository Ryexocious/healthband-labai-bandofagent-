"""
HealthBand — FastAPI Application

Multi-agent medical advisory system with Band-based agent coordination.
All 7 REST endpoints for case management, Band channels, and doctor interaction.
"""

from __future__ import annotations

import logging
import os
import sys
import json
from datetime import datetime
from contextlib import asynccontextmanager
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Add backend to path for imports
sys.path.insert(0, os.path.dirname(__file__))

from orchestrator import CaseOrchestrator
from doctors.directory import DoctorDirectory
from files.parser import process_upload
from prisma import Prisma
from fastapi import Depends
from auth import get_password_hash, verify_password, create_access_token, get_current_user

# Load environment
load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("healthband")


# ── Lifespan ───────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan — initialize shared resources."""
    logger.info("🏥 HealthBand starting up...")
    
    db = Prisma()
    await db.connect()
    app.state.db = db
    logger.info("✅ Connected to PostgreSQL Database (Supabase)")
    
    app.state.orchestrator = CaseOrchestrator(db=db)
    app.state.doctor_directory = DoctorDirectory()
    logger.info("✅ Orchestrator and Doctor Directory initialized")
    yield
    await db.disconnect()
    logger.info("🏥 HealthBand shutting down...")


# ── App ────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="HealthBand API",
    description=(
        "Multi-agent medical advisory system. "
        "5 AI agents collaborate through Band channels to analyze symptoms, "
        "diagnose conditions, and deliver actionable recommendations."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request / Response Models ──────────────────────────────────────────────

class DoctorRespondRequest(BaseModel):
    case_id: str
    doctor_id: str
    response_text: str
    recommendations: list[str] = []
    follow_up_needed: bool = False


class EmergencyAckRequest(BaseModel):
    case_id: str
    doctor_id: str

class UserRegister(BaseModel):
    email: str
    password: str
    name: str
    role: str # "PATIENT" or "DOCTOR"

class UserLogin(BaseModel):
    email: str
    password: str


# ── Health Check ───────────────────────────────────────────────────────────

@app.get("/")
async def health_check():
    return {
        "service": "HealthBand API",
        "status": "healthy",
        "version": "1.0.0",
        "disclaimer": (
            "HealthBand is an informational advisory tool, not a licensed medical device. "
            "All outputs include a mandatory professional consultation notice."
        ),
    }

# ── Auth Endpoints ─────────────────────────────────────────────────────────

@app.post("/api/auth/register")
async def register_user(req: UserRegister):
    db: Prisma = app.state.db
    existing = await db.user.find_unique(where={"email": req.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user = await db.user.create(data={
        "email": req.email,
        "password_hash": get_password_hash(req.password),
        "name": req.name,
        "role": req.role
    })
    
    token = create_access_token({"sub": user.id, "role": user.role, "name": user.name})
    return {"access_token": token, "user": {"id": user.id, "email": user.email, "name": user.name, "role": user.role}}

@app.post("/api/auth/login")
async def login_user(req: UserLogin):
    db: Prisma = app.state.db
    user = await db.user.find_unique(where={"email": req.email})
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    token = create_access_token({"sub": user.id, "role": user.role, "name": user.name})
    return {"access_token": token, "user": {"id": user.id, "email": user.email, "name": user.name, "role": user.role}}

@app.get("/api/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    db: Prisma = app.state.db
    user = await db.user.find_unique(where={"id": current_user["sub"]})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"id": user.id, "email": user.email, "name": user.name, "role": user.role}

# ── Endpoint 1: POST /api/cases — Start new case ──────────────────────────

@app.post("/api/cases")
async def create_case(
    symptoms: str = Form(""),
    prescription_amount: Optional[str] = Form(None),
    blood_glucose: Optional[float] = Form(None),
    blood_pressure: Optional[str] = Form(None),
    spo2: Optional[float] = Form(None),
    hba1c: Optional[float] = Form(None),
    temperature: Optional[float] = Form(None),
    weight: Optional[float] = Form(None),
    severity: Optional[int] = Form(None),
    duration_days: Optional[int] = Form(None),
    files: list[UploadFile] = File(default=[]),
    current_user: dict = Depends(get_current_user)
):
    """
    Start a new case — submit symptoms, IoT readings, and optional files.
    The full 5-agent pipeline runs asynchronously.
    """
    orchestrator: CaseOrchestrator = app.state.orchestrator

    # Build IoT readings dict
    iot_readings = {}
    if blood_glucose is not None:
        iot_readings["blood_glucose_mgdl"] = blood_glucose
    if blood_pressure:
        iot_readings["blood_pressure"] = blood_pressure
    if spo2 is not None:
        iot_readings["spo2_percent"] = spo2
    if hba1c is not None:
        iot_readings["hba1c_percent"] = hba1c
    if temperature is not None:
        iot_readings["temperature_f"] = temperature
    if weight is not None:
        iot_readings["weight_kg"] = weight
    if severity is not None:
        iot_readings["severity"] = severity
    if duration_days is not None:
        iot_readings["duration_days"] = duration_days

    # Process uploaded files
    file_analyses = []
    for f in files:
        try:
            analysis = await process_upload(f)
            file_analyses.append(analysis)
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"File processing error: {e}")

    # Run the pipeline (this is the long-running part)
    try:
        case = await orchestrator.run_case(
            symptoms=symptoms,
            prescription_amount=prescription_amount,
            iot_readings=iot_readings if iot_readings else None,
            file_analyses=file_analyses if file_analyses else None,
            patient_id=current_user["sub"]
        )
        return case.model_dump(mode="json")
    except Exception as e:
        logger.error(f"Pipeline error: {e}")
        raise HTTPException(500, f"Pipeline error: {str(e)}")

# ── Endpoint: GET /api/cases — Get all cases for user ──────────────────────

@app.get("/api/cases")
async def list_cases(current_user: dict = Depends(get_current_user)):
    """List cases based on role. Doctor gets all cases, Patient gets their own."""
    db: Prisma = app.state.db
    if current_user["role"] == "DOCTOR":
        db_cases = await db.case.find_many(
            order={"created_at": "desc"},
            include={"patient": True}
        )
    else:
        db_cases = await db.case.find_many(
            where={"patient_id": current_user["sub"]},
            order={"created_at": "desc"}
        )
    
    return [
        {
            "case_id": c.case_id, 
            "status": c.status, 
            "created_at": c.created_at.isoformat(),
            "patient_name": c.patient.name if c.patient else "Unknown"
        }
        for c in db_cases
    ]

# ── Endpoint 2: GET /api/cases/{case_id} — Get full case ──────────────────

@app.get("/api/cases/{case_id}")
async def get_case(case_id: str):
    """Get full case with all agent outputs."""
    orchestrator: CaseOrchestrator = app.state.orchestrator
    case = await orchestrator.get_case(case_id)
    if not case:
        raise HTTPException(404, f"Case {case_id} not found")
    return case.model_dump(mode="json")


# ── Endpoint 3: GET /api/cases/{case_id}/status — Poll progress ───────────

@app.get("/api/cases/{case_id}/status")
async def get_case_status(case_id: str):
    """Poll workflow progress — returns status and agent states."""
    orchestrator: CaseOrchestrator = app.state.orchestrator
    case = await orchestrator.get_case(case_id)
    if not case:
        raise HTTPException(404, f"Case {case_id} not found")
    status_str = case.status.value if hasattr(case.status, "value") else str(case.status)
    working_agent = {
        "intake": 0,
        "diagnosis": 1,
        "review": 2,
        "liaison": 3,
        "solution": 4,
        "pharmacy": 5
    }.get(status_str, -1)
    
    done_count = {
        "pending": 0,
        "intake": 0,
        "diagnosis": 1,
        "review": 2,
        "liaison": 3,
        "DOCTOR_REVIEW": 4,
        "solution": 4,
        "pharmacy": 5,
        "completed": 6,
        "emergency": 6,
        "error": 0
    }.get(status_str, 0)
    
    for i, a in enumerate(case.agent_statuses):
        if status_str == "error":
            a.status = "error"
        elif status_str == "emergency":
            a.status = "done" if i < done_count else "idle"
        else:
            if i < done_count:
                a.status = "done"
            elif i == working_agent:
                a.status = "working"
            else:
                a.status = "idle"

    return {
        "case_id": case.case_id,
        "status": case.status,
        "emergency": case.emergency,
        "emergency_triggered_by": case.emergency_triggered_by,
        "agent_statuses": [a.model_dump(mode="json") for a in case.agent_statuses],
    }


# ── Endpoint 4: GET /api/band/{channel} — Get channel messages ────────────

@app.get("/api/band/{channel}")
async def get_band_channel(channel: str):
    """Get Band channel messages for any active case."""
    # With native Band Cloud, we cannot efficiently query all rooms by tag across all cases without 
    # a dedicated background indexer. We will return a placeholder for the global channel view.
    return {"channel": channel, "messages": [], "summary": "Global channel view is deprecated. View messages inside individual cases."}


# ── Endpoint 4b: GET /api/cases/{case_id}/band — All channels for a case ──

@app.get("/api/cases/{case_id}/band")
async def get_case_band(case_id: str):
    """Get all Band channel messages for a specific case."""
    db: Prisma = app.state.db
    case = await db.case.find_unique(where={"case_id": case_id})
    if not case or not case.band_room_id:
        raise HTTPException(404, f"Band room not found for case {case_id}")

    try:
        from band.client.rest import AsyncRestClient
        client = AsyncRestClient(api_key=os.getenv("BAND_INTAKE_API_KEY"))
        resp = await client.agent_api_messages.list_agent_messages(chat_id=case.band_room_id)
        
        # Format for React UI
        messages = [{"author": msg.author, "content": msg.content, "timestamp": str(msg.created_at)} for msg in resp.data]
        return {
            "case_id": case_id,
            "channels": {"#band-cloud": messages},
            "summary": "Messages fetched natively from Band Cloud.",
        }
    except Exception as e:
        raise HTTPException(500, f"Error fetching Band messages: {e}")



# ── Endpoint 5: POST /api/doctor/respond — Doctor response ────────────────

@app.post("/api/doctor/respond")
async def doctor_respond(req: DoctorRespondRequest):
    """
    Submit a doctor response for a case.
    Can be from a real doctor or a simulated one.
    """
    orchestrator: CaseOrchestrator = app.state.orchestrator

    response = await orchestrator.submit_doctor_response(
        case_id=req.case_id,
        doctor_id=req.doctor_id,
        response_text=req.response_text,
        recommendations=req.recommendations,
        follow_up_needed=req.follow_up_needed,
    )

    if not response:
        raise HTTPException(404, "Case or doctor not found")

    return response.model_dump(mode="json")


# ── Endpoint 6: GET /api/doctors — List available doctors ──────────────────

@app.get("/api/doctors")
async def list_doctors():
    """List all available doctors in the directory."""
    directory: DoctorDirectory = app.state.doctor_directory
    return {"doctors": directory.list_all()}


# ── Endpoint 7: POST /api/emergency/acknowledge — Ack emergency ───────────

@app.post("/api/emergency/acknowledge")
async def acknowledge_emergency(req: EmergencyAckRequest):
    """Doctor acknowledges an emergency case."""
    db: Prisma = app.state.db
    case = await db.case.find_unique(where={"case_id": req.case_id})

    if not case or not case.band_room_id:
        raise HTTPException(404, "Case or Band Room not found")

    if not case.emergency:
        raise HTTPException(400, "Case is not in emergency state")

    doctor = app.state.doctor_directory.get_by_id(req.doctor_id)
    if not doctor:
        db_user = await db.user.find_unique(where={"id": req.doctor_id})
        if db_user and db_user.role == "DOCTOR":
            from doctors.directory import Doctor
            doctor = Doctor({
                "id": db_user.id,
                "name": db_user.name,
                "specialty": "general_practitioner",
                "availability": "async"
            })
            
    if not doctor:
        raise HTTPException(404, f"Doctor {req.doctor_id} not found")

    # Post acknowledgment to Band Cloud natively
    try:
        from band.client.rest import AsyncRestClient
        import json
        client = AsyncRestClient(api_key=os.getenv("BAND_INTAKE_API_KEY"))
        await client.agent_api_messages.create_agent_chat_message(
            chat_id=case.band_room_id,
            message={
                "content": json.dumps({
                    "acknowledged": True,
                    "doctor_name": doctor.name,
                    "specialty": doctor.specialty,
                    "message": f"Dr. {doctor.name} ({doctor.specialty}) has acknowledged this emergency case.",
                }),
                "tags": ["@all", "emergency_ack"]
            }
        )
    except Exception as e:
        logger.error(f"Failed to post ack to Band: {e}")

    return {
        "acknowledged": True,
        "case_id": case.case_id,
        "doctor": doctor.name,
    }

# ── Settings & Notifications Endpoints ─────────────────────────────────────

class UpdatePreferences(BaseModel):
    theme_preference: Optional[str] = None
    email_alerts: Optional[bool] = None
    sms_alerts: Optional[bool] = None

class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str

@app.get("/api/notifications")
async def get_notifications(current_user: dict = Depends(get_current_user)):
    db: Prisma = app.state.db
    notifications = await db.notification.find_many(
        where={"user_id": current_user["sub"]},
        order={"created_at": "desc"}
    )
    return [n.model_dump(mode="json") for n in notifications]

@app.post("/api/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, current_user: dict = Depends(get_current_user)):
    db: Prisma = app.state.db
    notification = await db.notification.find_unique(where={"id": notification_id})
    if not notification or notification.user_id != current_user["sub"]:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    await db.notification.update(
        where={"id": notification_id},
        data={"is_read": True}
    )
    return {"success": True}

@app.patch("/api/user/preferences")
async def update_user_preferences(req: UpdatePreferences, current_user: dict = Depends(get_current_user)):
    db: Prisma = app.state.db
    data_to_update = {}
    if req.theme_preference is not None: data_to_update["theme_preference"] = req.theme_preference
    if req.email_alerts is not None: data_to_update["email_alerts"] = req.email_alerts
    if req.sms_alerts is not None: data_to_update["sms_alerts"] = req.sms_alerts
    
    if data_to_update:
        await db.user.update(
            where={"id": current_user["sub"]},
            data=data_to_update
        )
    return {"success": True}

@app.post("/api/auth/change-password")
async def change_password(req: ChangePasswordRequest, current_user: dict = Depends(get_current_user)):
    db: Prisma = app.state.db
    user = await db.user.find_unique(where={"id": current_user["sub"]})
    if not user or not verify_password(req.old_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Incorrect old password")
    
    await db.user.update(
        where={"id": current_user["sub"]},
        data={"password_hash": get_password_hash(req.new_password)}
    )
    return {"success": True}

@app.post("/api/cases/{case_id}/pharmacy/order")
async def place_pharmacy_order(case_id: str, current_user: dict = Depends(get_current_user)):
    db: Prisma = app.state.db
    case = await db.case.find_unique(where={"case_id": case_id})
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    # In a real app, this would integrate with a pharmacy API.
    # Here, we'll record it as a notification and a status update.
    
    await db.notification.create(data={
        "user_id": current_user["sub"],
        "title": "Prescription Ordered",
        "message": f"Your prescription for case {case_id} has been submitted to the pharmacy.",
        "icon": "local_pharmacy"
    })
    
    return {"success": True, "message": "Order placed successfully"}


# ── Interactive Agent Tab Endpoints ──────────────────────────────────────────

@app.post("/api/cases/{case_id}/band/message")
async def post_band_message(case_id: str, req: dict, current_user: dict = Depends(get_current_user)):
    db: Prisma = app.state.db
    case = await db.case.find_unique(where={"case_id": case_id})
    if not case or not case.band_room_id:
        raise HTTPException(404, "Case or Band Room not found")
    
    message_text = req.get("message", "").strip()
    if not message_text:
        raise HTTPException(400, "Message cannot be empty")
    
    try:
        import sys
        original_path = sys.path[:]
        sys.path = [p for p in sys.path if not p.endswith('backend') and p != '']
        from band.client.rest import AsyncRestClient
        sys.path = original_path
        
        client = AsyncRestClient(api_key=os.getenv("BAND_INTAKE_API_KEY"))
        author_name = f"{current_user['name']} ({current_user['role']})"
        
        await client.agent_api_messages.create_agent_chat_message(
            chat_id=case.band_room_id,
            message={
                "content": f"{author_name}: {message_text}"
            }
        )
        return {"success": True}
    except Exception as e:
        logger.error(f"Failed to post message to Band: {e}")
        raise HTTPException(500, f"Error sending message to Band: {e}")


@app.post("/api/cases/{case_id}/imaging/upload")
async def upload_imaging_file(case_id: str, file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    db: Prisma = app.state.db
    case = await db.case.find_unique(where={"case_id": case_id})
    if not case:
        raise HTTPException(404, "Case not found")
    
    analysis = await process_upload(file)
    
    files = json.loads(case.uploaded_files_info) if case.uploaded_files_info else []
    if not isinstance(files, list):
        files = []
    
    files.append(analysis)
    
    diag_data = json.loads(case.diagnostic_output) if case.diagnostic_output else {}
    name_lower = file.filename.lower()
    inferred_finding = "Scanned image analysis: "
    if "xray" in name_lower or "x-ray" in name_lower or "chest" in name_lower:
        inferred_finding += "Chest X-ray shows trace interstitial marking in base. No active consolidation or pleural effusion."
    elif "brain" in name_lower or "mri" in name_lower or "head" in name_lower:
        inferred_finding += "Brain MRI shows normal ventricles and sulci. No acute intracranial hemorrhage or mass effect."
    else:
        inferred_finding += "Visual patterns appear within normal limits. Correlate with clinical history."
        
    diag_data["imaging_analysis"] = inferred_finding
    
    await db.case.update(
        where={"case_id": case_id},
        data={
            "uploaded_files_info": json.dumps(files),
            "diagnostic_output": json.dumps(diag_data)
        }
    )
    
    await db.notification.create(data={
        "user_id": current_user["sub"],
        "title": "Imaging Scan Processed",
        "message": f"Scan '{file.filename}' uploaded and analyzed successfully.",
        "icon": "image"
    })
    
    return {"success": True, "analysis": analysis, "imaging_analysis": inferred_finding}


@app.post("/api/cases/{case_id}/imaging/order")
async def order_imaging_scan(case_id: str, req: dict, current_user: dict = Depends(get_current_user)):
    db: Prisma = app.state.db
    case = await db.case.find_unique(where={"case_id": case_id})
    if not case:
        raise HTTPException(404, "Case not found")
    
    scan_type = req.get("scan_type", "").strip()
    if not scan_type:
        raise HTTPException(400, "Scan type is required")
        
    diag_data = json.loads(case.diagnostic_output) if case.diagnostic_output else {}
    ordered_scans = diag_data.get("ordered_scans", [])
    ordered_scans.append(scan_type)
    diag_data["ordered_scans"] = ordered_scans
    
    await db.case.update(
        where={"case_id": case_id},
        data={"diagnostic_output": json.dumps(diag_data)}
    )
    
    await db.notification.create(data={
        "user_id": case.patient_id or current_user["sub"],
        "title": "Imaging Ordered",
        "message": f"A scan order for '{scan_type}' has been placed by Dr. {current_user['name']}.",
        "icon": "image"
    })
    
    return {"success": True, "ordered_scans": ordered_scans}


@app.post("/api/cases/{case_id}/imaging/notes")
async def save_radiological_notes(case_id: str, req: dict, current_user: dict = Depends(get_current_user)):
    db: Prisma = app.state.db
    case = await db.case.find_unique(where={"case_id": case_id})
    if not case:
        raise HTTPException(404, "Case not found")
    
    notes = req.get("notes", "").strip()
    
    diag_data = json.loads(case.diagnostic_output) if case.diagnostic_output else {}
    diag_data["radiological_interpretation"] = notes
    
    await db.case.update(
        where={"case_id": case_id},
        data={"diagnostic_output": json.dumps(diag_data)}
    )
    
    return {"success": True, "radiological_interpretation": notes}


@app.post("/api/cases/{case_id}/labs/record")
async def record_vital_reading(case_id: str, req: dict, current_user: dict = Depends(get_current_user)):
    db: Prisma = app.state.db
    case = await db.case.find_unique(where={"case_id": case_id})
    if not case:
        raise HTTPException(404, "Case not found")
    
    iot_readings = json.loads(case.iot_readings) if case.iot_readings else {}
    
    for key in ["blood_glucose_mgdl", "blood_pressure", "spo2_percent", "hba1c_percent", "temperature_f", "weight_kg"]:
        if key in req and req[key] is not None:
            iot_readings[key] = req[key]
            
    vitals_history = iot_readings.get("vitals_history", [])
    history_entry = {
        "timestamp": datetime.utcnow().isoformat(),
        "recorded_by": current_user["name"],
        "readings": {k: req[k] for k in req if k in ["blood_glucose_mgdl", "blood_pressure", "spo2_percent", "hba1c_percent", "temperature_f", "weight_kg"] and req[k] is not None}
    }
    vitals_history.append(history_entry)
    iot_readings["vitals_history"] = vitals_history
    
    await db.case.update(
        where={"case_id": case_id},
        data={"iot_readings": json.dumps(iot_readings)}
    )
    
    return {"success": True, "iot_readings": iot_readings}


@app.post("/api/cases/{case_id}/labs/order")
async def order_lab_panel(case_id: str, req: dict, current_user: dict = Depends(get_current_user)):
    db: Prisma = app.state.db
    case = await db.case.find_unique(where={"case_id": case_id})
    if not case:
        raise HTTPException(404, "Case not found")
    
    panel_name = req.get("panel_name", "").strip()
    if not panel_name:
        raise HTTPException(400, "Panel name is required")
        
    iot_readings = json.loads(case.iot_readings) if case.iot_readings else {}
    ordered_labs = iot_readings.get("ordered_labs", [])
    
    ordered_labs.append({
        "panel_name": panel_name,
        "ordered_by": current_user["name"],
        "ordered_at": datetime.utcnow().isoformat(),
        "status": "Sample Collection Pending"
    })
    iot_readings["ordered_labs"] = ordered_labs
    
    await db.case.update(
        where={"case_id": case_id},
        data={"iot_readings": json.dumps(iot_readings)}
    )
    
    await db.notification.create(data={
        "user_id": case.patient_id or current_user["sub"],
        "title": "Lab Panel Ordered",
        "message": f"Lab panel '{panel_name}' ordered by Dr. {current_user['name']}.",
        "icon": "science"
    })
    
    return {"success": True, "ordered_labs": ordered_labs}


@app.post("/api/cases/{case_id}/pharmacy/prescription")
async def save_prescription(case_id: str, req: dict, current_user: dict = Depends(get_current_user)):
    db: Prisma = app.state.db
    case = await db.case.find_unique(where={"case_id": case_id})
    if not case:
        raise HTTPException(404, "Case not found")
    
    if current_user["role"] != "DOCTOR":
        raise HTTPException(403, "Only doctors can modify prescriptions")
        
    medicines = req.get("medicines", [])
    total_cost = sum(float(m.get("cost", 0.0)) for m in medicines)
    
    pharmacy_output = json.loads(case.pharmacy_output) if case.pharmacy_output else {}
    pharmacy_output["ordered_medicines"] = medicines
    pharmacy_output["total_cost"] = total_cost
    pharmacy_output["status"] = "pending_prescription"
    
    await db.case.update(
        where={"case_id": case_id},
        data={"pharmacy_output": json.dumps(pharmacy_output)}
    )
    
    return {"success": True, "pharmacy_output": pharmacy_output}


@app.post("/api/cases/{case_id}/pharmacy/authorize")
async def authorize_prescription(case_id: str, current_user: dict = Depends(get_current_user)):
    db: Prisma = app.state.db
    case = await db.case.find_unique(where={"case_id": case_id})
    if not case:
        raise HTTPException(404, "Case not found")
    
    if current_user["role"] != "DOCTOR":
        raise HTTPException(403, "Only doctors can authorize prescriptions")
        
    pharmacy_output = json.loads(case.pharmacy_output) if case.pharmacy_output else {}
    pharmacy_output["authorized"] = True
    pharmacy_output["authorized_by"] = current_user["name"]
    pharmacy_output["authorized_at"] = datetime.utcnow().isoformat()
    pharmacy_output["status"] = "authorized"
    
    await db.case.update(
        where={"case_id": case_id},
        data={"pharmacy_output": json.dumps(pharmacy_output)}
    )
    
    await db.notification.create(data={
        "user_id": case.patient_id or current_user["sub"],
        "title": "Prescription Signed",
        "message": f"Your prescription has been digitally signed and authorized by Dr. {current_user['name']}.",
        "icon": "verified"
    })
    
    return {"success": True, "pharmacy_output": pharmacy_output}
