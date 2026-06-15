"""
HealthBand — Pydantic v2 schemas for all agent I/O.
Every agent reads and writes strict JSON matching these models.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum
from typing import Optional, Any

from pydantic import BaseModel, Field


# ── Enums ──────────────────────────────────────────────────────────────────

class CaseStatus(str, Enum):
    pending = "pending"
    intake = "intake"
    diagnosis = "diagnosis"
    review = "review"
    liaison = "liaison"
    doctor_review = "DOCTOR_REVIEW"
    solution = "solution"
    pharmacy = "pharmacy"
    completed = "completed"
    error = "error"
    emergency = "emergency"


class EscalationLevel(str, Enum):
    normal = "normal"
    async_review = "async_review"
    emergency = "emergency"


class DoctorMode(str, Enum):
    async_mode = "async"
    on_call = "on-call"


class DoctorCaseStatus(str, Enum):
    sent = "sent"
    reviewing = "reviewing"
    responded = "responded"


# ── Intake Agent Schemas ───────────────────────────────────────────────────

class PatientContext(BaseModel):
    age_group: str = "unknown"
    symptoms: list[str] = Field(default_factory=list)
    duration_days: Optional[int] = None
    severity: int = 5


class IoTReadings(BaseModel):
    blood_glucose_mgdl: Optional[float] = None
    blood_pressure: Optional[str] = None
    spo2_percent: Optional[float] = None
    hba1c_percent: Optional[float] = None
    temperature_f: Optional[float] = None
    weight_kg: Optional[float] = None


class UploadedFile(BaseModel):
    type: str  # "lab_report" | "xray" | "mri" | "image"
    key_findings: list[str] = Field(default_factory=list)
    filename: Optional[str] = None


class HealthProfile(BaseModel):
    """Output of the Intake Agent — posted to #intake channel."""
    patient_context: PatientContext
    iot_readings: IoTReadings = Field(default_factory=IoTReadings)
    uploaded_files: list[UploadedFile] = Field(default_factory=list)
    emergency_keywords_detected: bool = False


# ── Diagnostic Agent Schemas ───────────────────────────────────────────────

class Condition(BaseModel):
    name: str
    confidence: float = Field(ge=0.0, le=1.0)
    icd_code: str = ""
    note: Optional[str] = None


class DiagnosticOutput(BaseModel):
    """Output of the Diagnostic Agent — posted to #diagnosis channel."""
    conditions: list[Condition] = Field(default_factory=list)
    red_flags: list[str] = Field(default_factory=list)
    emergency: bool = False
    recommended_specialist: Optional[str] = "general_practitioner"
    confidence_basis: Optional[str] = ""
    imaging_analysis: Optional[str] = None
    ordered_scans: list[str] = Field(default_factory=list)
    radiological_interpretation: Optional[str] = None


# ── Reviewer Agent Schemas ─────────────────────────────────────────────────

class ReviewerOutput(BaseModel):
    """Output of the Reviewer Agent — posted to #review channel."""
    review_verdict: Optional[str] = ""  # "validated" | "validated_with_additions" | "revised"
    validated_conditions: list[str] = Field(default_factory=list)
    added_conditions: list[Condition] = Field(default_factory=list)
    removed_conditions: list[str] = Field(default_factory=list)
    clinical_notes: Optional[str] = ""
    imaging_note: Optional[str] = ""
    escalation: EscalationLevel = EscalationLevel.normal
    specialist_needed: Optional[str] = "general_practitioner"
    emergency: bool = False


# ── Doctor Liaison Agent Schemas ───────────────────────────────────────────

class LiaisonOutput(BaseModel):
    """Output of the Doctor Liaison Agent — posted to #doctor-comms channel."""
    case_id: str
    assigned_doctor: Optional[str] = ""
    specialty_match: Optional[str] = ""
    mode: DoctorMode = DoctorMode.async_mode
    status: DoctorCaseStatus = DoctorCaseStatus.sent
    clinical_brief: Optional[str] = ""
    eta_hours: Optional[int] = None
    priority: Optional[str] = "normal"  # "normal" | "critical"


# ── Solution Agent Schemas ─────────────────────────────────────────────────

class SpecialistReferral(BaseModel):
    type: str
    urgency: str


class SolutionOutput(BaseModel):
    """Output of the Solution Agent — posted to #solutions channel."""
    primary_assessment: Optional[str] = ""
    immediate_actions: list[str] = Field(default_factory=list)
    lifestyle_changes: list[str] = Field(default_factory=list)
    specialist_referrals: list[SpecialistReferral] = Field(default_factory=list)
    warning_signs: list[str] = Field(default_factory=list)
    prevention_plan: Optional[str] = ""
    disclaimer: str = (
        "This is informational only and does not replace professional medical advice. "
        "Please consult a licensed healthcare provider for diagnosis and treatment."
    )


# ── Pharmacy Agent Schemas ─────────────────────────────────────────────────

class OrderedMedicine(BaseModel):
    name: str
    quantity: str
    cost: float
    site_url: str


class PharmacyOutput(BaseModel):
    """Output of the Pharmacy Agent — posted to #pharmacy channel."""
    ordered_medicines: list[OrderedMedicine] = Field(default_factory=list)
    total_cost: float = 0.0
    estimated_delivery: Optional[str] = ""
    status: Optional[str] = "pending"  # "ordered" | "pending_prescription" | "error"
    pharmacy_name: Optional[str] = "Mock Pharmacy Online"
    authorized: bool = False
    authorized_by: Optional[str] = None
    authorized_at: Optional[str] = None


# ── Doctor Response Schema ─────────────────────────────────────────────────

class DoctorResponse(BaseModel):
    """A doctor's response — either simulated or from a real doctor."""
    doctor_id: str
    doctor_name: str
    specialty: str
    response_text: str
    recommendations: list[str] = Field(default_factory=list)
    follow_up_needed: bool = False
    is_simulated: bool = True
    timestamp: datetime = Field(default_factory=datetime.utcnow)


# ── Case (aggregate root) ─────────────────────────────────────────────────

class AgentStatus(BaseModel):
    name: str
    status: str = "idle"  # "idle" | "working" | "done" | "error"
    model: str = ""
    channel: str = ""
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None


class Case(BaseModel):
    """Full case state — aggregates all agent outputs."""
    case_id: str = Field(default_factory=lambda: f"HC-{datetime.utcnow().strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}")
    status: CaseStatus = CaseStatus.pending
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Raw input
    symptoms: str = ""
    prescription_amount: Optional[str] = None
    iot_readings: Optional[dict] = None
    uploaded_files_info: list[Any] = Field(default_factory=list)

    # Agent outputs
    intake_output: Optional[HealthProfile] = None
    diagnostic_output: Optional[DiagnosticOutput] = None
    reviewer_output: Optional[ReviewerOutput] = None
    liaison_output: Optional[LiaisonOutput] = None
    solution_output: Optional[SolutionOutput] = None
    pharmacy_output: Optional[PharmacyOutput] = None

    # Doctor interaction
    doctor_response: Optional[DoctorResponse] = None

    # Emergency state
    emergency: bool = False
    emergency_triggered_by: Optional[str] = None

    # Agent statuses
    agent_statuses: list[AgentStatus] = Field(default_factory=lambda: [
        AgentStatus(name="Intake Agent", model="gpt-4o", channel="#intake"),
        AgentStatus(name="Diagnostic Agent", model="deepseek-r1", channel="#diagnosis"),
        AgentStatus(name="Reviewer Agent", model="claude-3-5-sonnet", channel="#review"),
        AgentStatus(name="Doctor Liaison", model="gpt-4o-mini", channel="#doctor-comms"),
        AgentStatus(name="Solution Agent", model="claude-3-5-sonnet", channel="#solutions"),
        AgentStatus(name="Pharmacy Agent", model="gpt-4o", channel="#pharmacy"),
    ])
