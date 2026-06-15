# HealthBand — Multi-Agent Medical Advisory System
### Full Project Blueprint · AI/ML API + Band + Python + React

---

## 1. Project Overview

HealthBand is a **5-agent collaborative medical advisory system** built on top of Band as the agent communication layer. Users submit health data — symptoms, lab reports, X-rays, IoT device readings — and a chain of specialized AI agents analyzes, reviews, cross-validates, and delivers actionable recommendations.

The system is designed for **Track 3: Regulated & High-Stakes Workflows** and satisfies all multi-agent judging criteria: agents discover each other, divide work, review outputs, escalate emergencies, and coordinate state through Band channels.

> ⚠️ **Disclaimer:** HealthBand is an informational advisory tool, not a licensed medical device. All outputs include a mandatory professional consultation notice. Emergency conditions trigger immediate real-world guidance (call emergency services).

---

## 2. Problem Statement

Current health advisory tools are single-model chatbots — one AI making one pass at a diagnosis. This is unreliable for health contexts because:

- No cross-validation between perspectives
- No specialist routing by condition type
- No distinction between emergency and routine cases
- No structured handoff of clinical context between reasoning steps

HealthBand solves this by decomposing the problem across 5 agents, each owning a specific responsibility, collaborating through Band's message bus.

---

## 3. The 5-Agent Architecture

```
User Input (symptoms + files + IoT readings)
            │
            ▼
    ┌─────────────────┐
    │  Intake Agent   │──── #intake (Band)
    └────────┬────────┘
             │ Structured Health Profile JSON
             ▼
    ┌─────────────────────┐
    │  Diagnostic Agent   │──── #diagnosis (Band)
    └──────────┬──────────┘
               │ Conditions + Confidence Scores + Red Flags
               ▼
    ┌─────────────────────┐
    │  Reviewer Agent     │──── #review (Band)
    └──────────┬──────────┘
               │
        ┌──────┴──────────────────┐
        │ Emergency?              │ Normal?
        ▼                         ▼
  ┌───────────────┐    ┌──────────────────────┐
  │ EMERGENCY     │    │  Doctor Liaison Agent │──── #doctor-comms (Band)
  │ ALERT         │    └──────────┬───────────┘
  │ + On-call     │               │ Async specialist response
  │ page          │               ▼
  └───────────────┘    ┌──────────────────────┐
                       │  Solution Agent       │──── #solutions (Band)
                       └──────────────────────┘
                                  │
                                  ▼
                       Final Report → User
```

---

## 4. Agent Specifications

### Agent 1 — Intake Agent
**Band Channel:** `#intake`
**Model (AI/ML API):** `gpt-4o` (multimodal)

**Responsibilities:**
- Parse free-text symptom descriptions
- Read uploaded lab report PDFs via vision
- Analyze X-ray / MRI images (pattern recognition)
- Accept structured IoT readings: glucose, BP, SpO2, HbA1c, temperature, weight
- Produce a normalized **HealthProfile JSON** object

**Input:** Raw user input (text + files + numbers)

**Output posted to Band `#intake`:**
```json
{
  "patient_context": {
    "age_group": "adult",
    "symptoms": ["fatigue", "frequent urination", "blurred vision"],
    "duration_days": 14,
    "severity": 7
  },
  "iot_readings": {
    "blood_glucose_mgdl": 248,
    "blood_pressure": "138/88",
    "spo2_percent": 97
  },
  "uploaded_files": [
    { "type": "lab_report", "key_findings": ["HbA1c: 8.4%", "Cholesterol: 210"] }
  ],
  "emergency_keywords_detected": false
}
```

---

### Agent 2 — Diagnostic Agent
**Band Channel:** `#diagnosis`
**Model (AI/ML API):** `deepseek-r1` (reasoning-heavy)

**Responsibilities:**
- Reads structured HealthProfile from Band `#intake`
- Identifies 2–3 most likely conditions with confidence scores
- Flags any red-flag symptoms requiring urgent attention
- Suggests which specialist type is most relevant
- Does NOT suggest treatment — only diagnosis candidates

**Input:** HealthProfile JSON from `#intake`

**Output posted to Band `#diagnosis`:**
```json
{
  "conditions": [
    { "name": "Type 2 Diabetes", "confidence": 0.87, "icd_code": "E11" },
    { "name": "Hypertension", "confidence": 0.72, "icd_code": "I10" },
    { "name": "Diabetic Retinopathy (early)", "confidence": 0.41, "icd_code": "E11.3" }
  ],
  "red_flags": [],
  "emergency": false,
  "recommended_specialist": "endocrinologist",
  "confidence_basis": "HbA1c 8.4%, fasting glucose 248 mg/dL, classic triad symptoms"
}
```

---

### Agent 3 — Reviewer Agent
**Band Channel:** `#review`
**Model (AI/ML API):** `claude-3-5-sonnet` (clinical nuance + critique)

**Responsibilities:**
- Reads BOTH `#intake` and `#diagnosis` from Band (full context)
- Actively challenges the Diagnostic Agent's findings
- Looks for missed conditions, contradictions, or over-confidence
- Validates or revises the diagnosis
- Sets the escalation flag: `normal`, `async_review`, or `emergency`
- This is the **accuracy layer** — the system's quality gate

**Input:** Full Band context from `#intake` + `#diagnosis`

**Output posted to Band `#review`:**
```json
{
  "review_verdict": "validated_with_additions",
  "validated_conditions": ["Type 2 Diabetes", "Hypertension"],
  "added_conditions": [
    { "name": "Metabolic Syndrome", "confidence": 0.65, "note": "Missed by Diagnostic Agent" }
  ],
  "removed_conditions": [],
  "clinical_notes": "HbA1c + glucose readings are strongly convergent. BP reading warrants independent cardio assessment.",
  "imaging_note": "No imaging uploaded. Blurred vision symptom warrants ophthalmology referral.",
  "escalation": "async_review",
  "specialist_needed": "endocrinologist",
  "emergency": false
}
```

---

### Agent 4 — Doctor Liaison Agent
**Band Channel:** `#doctor-comms`
**Model (AI/ML API):** `gpt-4o-mini` (fast, structured routing)

**Responsibilities:**
- Reads escalation flag from Band `#review`
- Queries the **Doctor Directory** to find the right specialist
- Formats a clean clinical brief (not raw chat logs)
- Posts the case to `#doctor-comms` with specialist assignment
- Manages two paths:

**Path A — Async (normal escalation):**
- Assigns case to available specialist
- User receives preliminary results immediately
- Doctor reviews async and responds via Band
- User gets push notification when doctor responds
- Status tracked: `sent → reviewing → responded`

**Path B — Emergency (real-time override):**
- Triggered when `emergency: true` in any prior agent output
- Pages on-call doctor immediately
- Shows user emergency alert with real-world action steps
- Keeps channel open until human doctor acknowledges

**Doctor Directory Schema:**
```json
{
  "doctors": [
    {
      "id": "dr_001",
      "name": "Dr. Sarah Rahman",
      "specialty": "endocrinologist",
      "availability": "async",
      "response_sla_hours": 4,
      "languages": ["en", "bn"]
    },
    {
      "id": "dr_002",
      "name": "Dr. James Okonkwo",
      "specialty": "cardiologist",
      "availability": "on-call",
      "response_sla_hours": 1,
      "languages": ["en"]
    }
  ]
}
```

**Output posted to Band `#doctor-comms`:**
```json
{
  "case_id": "HC-20260602-0041",
  "assigned_doctor": "dr_001",
  "specialty_match": "endocrinologist",
  "mode": "async",
  "status": "sent",
  "clinical_brief": "...",
  "eta_hours": 4
}
```

---

### Agent 5 — Solution Agent
**Band Channel:** `#solutions`
**Model (AI/ML API):** `claude-3-5-sonnet` (empathetic, actionable writing)

**Responsibilities:**
- Activates only after Reviewer Agent clears and Doctor Liaison has dispatched
- Reads the full Band context from ALL prior channels
- Generates practical, tiered recommendations
- Always includes a "See a doctor if..." warning section
- Outputs a structured final report

**Output posted to Band `#solutions`:**
```json
{
  "primary_assessment": "Likely Type 2 Diabetes with concurrent Hypertension",
  "immediate_actions": [
    "Reduce refined carbohydrate intake today",
    "Monitor blood glucose every 6 hours and log readings",
    "Avoid strenuous exercise until assessed"
  ],
  "lifestyle_changes": [
    "Mediterranean-style diet with <50g net carbs/day",
    "30-minute walks daily, building to 5x/week",
    "Target 7-8 hours sleep — poor sleep worsens insulin resistance"
  ],
  "specialist_referrals": [
    { "type": "endocrinologist", "urgency": "within 1 week" },
    { "type": "ophthalmologist", "urgency": "within 2 weeks (blurred vision)" }
  ],
  "warning_signs": [
    "Blood glucose >300 mg/dL → go to ER",
    "Chest pain or shortness of breath → call 999/911",
    "Vision sudden worsening → emergency ophthalmology"
  ],
  "prevention_plan": "...",
  "disclaimer": "This is informational only and does not replace professional medical advice."
}
```

---

## 5. Tech Stack

### Backend
| Component | Technology | Purpose |
|---|---|---|
| Web framework | **FastAPI** (Python 3.11+) | REST API + async support |
| Agent orchestration | **asyncio** + custom Band bus | Agent coordination layer |
| AI engine | **AI/ML API** (OpenAI-compatible) | All 5 agent LLM calls |
| File parsing | **PyMuPDF** + **Pillow** | PDF and image processing |
| Base64 encoding | Python stdlib | Vision input preparation |
| Data validation | **Pydantic v2** | Agent handoff schemas |
| State management | In-memory dict (session) | Band channel message store |
| Doctor directory | JSON file + Python class | Specialist lookup + matching |

### Frontend
| Component | Technology | Purpose |
|---|---|---|
| UI framework | **React** (JSX) | Single-page application |
| Styling | **Tasteskill** design system | Unique, production-grade UI |
| File upload | HTML5 File API + drag-and-drop | Report and image uploads |
| Real-time updates | Polling (GET /status) | Live agent progress |
| Band workspace UI | Custom component | Channel feed + agent cards |

### AI/ML API — Model Assignment
| Agent | Model | Reason |
|---|---|---|
| Intake | `gpt-4o` | Multimodal — reads images + PDFs + text |
| Diagnostic | `deepseek-r1` | Best-in-class reasoning for differential diagnosis |
| Reviewer | `claude-3-5-sonnet` | Strong at critique + clinical nuance |
| Doctor Liaison | `gpt-4o-mini` | Fast, structured routing — no heavy reasoning needed |
| Solution | `claude-3-5-sonnet` | Empathetic, actionable, safe recommendations |

> Using **different models per agent** is a deliberate creative choice. Each agent gets the model best suited for its cognitive task, rather than one model doing everything.

---

## 6. Project Structure

```
healthband/
├── backend/
│   ├── main.py                    # FastAPI app, routes, CORS
│   ├── orchestrator.py            # Workflow runner, agent chaining
│   ├── agents/
│   │   ├── base.py                # BaseAgent class (AI/ML API client)
│   │   ├── intake.py              # Intake Agent
│   │   ├── diagnostic.py          # Diagnostic Agent
│   │   ├── reviewer.py            # Reviewer Agent
│   │   ├── liaison.py             # Doctor Liaison Agent
│   │   └── solution.py            # Solution Agent
│   ├── band/
│   │   ├── channel.py             # Band message bus (in-memory pub/sub)
│   │   └── schemas.py             # Channel message schemas
│   ├── doctors/
│   │   ├── directory.py           # Doctor registry class
│   │   └── doctors.json           # Specialist database
│   ├── files/
│   │   ├── parser.py              # PDF + image → base64 + metadata
│   │   └── vision.py              # Vision prompt builder
│   └── models/
│       └── schemas.py             # Pydantic models for all agent I/O
├── frontend/
│   ├── src/
│   │   ├── App.jsx                # Root component
│   │   ├── components/
│   │   │   ├── BandWorkspace.jsx  # Band channel UI
│   │   │   ├── AgentStatus.jsx    # Right panel — agent cards
│   │   │   ├── HealthIntakeForm.jsx # Symptom + IoT input
│   │   │   ├── FileUploader.jsx   # Drag-drop lab reports / X-rays
│   │   │   ├── EmergencyAlert.jsx # Red alert overlay
│   │   │   └── FinalReport.jsx    # Downloadable summary
│   │   └── styles/
│   │       └── tasteskill.css     # Tasteskill design tokens
│   └── package.json
├── requirements.txt
├── .env.example                   # AIML_API_KEY placeholder
└── README.md
```

---

## 7. Band Message Bus Design

Band is the **central collaboration layer** — not a notification wrapper. Every agent publishes to and subscribes from Band channels. This is what makes the system genuinely multi-agent rather than a linear pipeline.

### Channel Architecture
| Channel | Publisher | Subscribers | Purpose |
|---|---|---|---|
| `#intake` | Intake Agent | Diagnostic, Reviewer | Normalized health profile |
| `#diagnosis` | Diagnostic Agent | Reviewer, Liaison | Condition candidates |
| `#review` | Reviewer Agent | Liaison, Solution | Validated diagnosis + escalation |
| `#doctor-comms` | Doctor Liaison | Solution, UI | Case assignment + doctor response |
| `#solutions` | Solution Agent | UI | Final recommendations |
| `#emergency` | Any agent | All agents + UI | Red alert broadcast |

### Key Properties
- **Any agent can subscribe to any channel** — Reviewer reads both `#intake` and `#diagnosis` for full context
- **Emergency broadcast** — any agent posting to `#emergency` wakes the entire system
- **Persistent within session** — full channel history = shared agent memory
- **Doctor responses feed back in** — `#doctor-comms` receives both outbound and inbound messages

### Band Channel Message Schema
```python
class BandMessage(BaseModel):
    id: str                    # UUID
    channel: str               # e.g. "#intake"
    author: str                # Agent name or "doctor:{id}"
    timestamp: datetime
    message_type: str          # "handoff" | "alert" | "response" | "status"
    content: dict              # Agent-specific payload
    tags: list[str]            # e.g. ["@DiagnosticAgent", "urgent"]
    thread_id: Optional[str]   # For async doctor reply threads
```

---

## 8. API Endpoints

```
POST   /api/cases                    # Start new case (multipart: text + files)
GET    /api/cases/{case_id}          # Get full case + agent outputs
GET    /api/cases/{case_id}/status   # Poll workflow progress
GET    /api/band/{channel}           # Get Band channel messages
POST   /api/doctor/respond           # Simulate doctor response (async)
GET    /api/doctors                  # List available doctors
POST   /api/emergency/acknowledge    # Doctor acknowledges emergency
```

---

## 9. Multi-Agent Collaboration Criteria — Mapping

This section directly maps to the hackathon judging rubric.

| Criterion | Implementation |
|---|---|
| **Beyond a chatbot** | 5 agents with distinct roles, different models, different reasoning tasks |
| **Agents discover each other** | Doctor Liaison dynamically selects specialist by condition type from directory |
| **Coordinate & divide work** | Each agent owns one Band channel + one cognitive responsibility |
| **Review outputs** | Reviewer Agent explicitly challenges Diagnostic Agent via Band |
| **Escalate issues** | Emergency path bypasses queue — any agent can trigger `#emergency` |
| **Collaborate across frameworks** | Multi-model: GPT-4o, DeepSeek-R1, Claude 3.5 Sonnet, GPT-4o-mini |
| **Multimodal** | Vision (X-rays/reports) + text (symptoms) + structured data (IoT) |
| **Async coordination** | Doctor Liaison manages async review queue with status tracking |
| **Real-time override** | Emergency mode: on-call paging, blocks async queue |
| **Traceability** | Full Band channel history = complete audit trail per case |

---

## 10. Emergency Detection Logic

Any agent in the pipeline can trigger an emergency. Detection runs at every step.

### Trigger Conditions
| Signal | Source | Action |
|---|---|---|
| Keywords: "chest pain", "can't breathe", "stroke", "unconscious" | Intake Agent | Immediate emergency path |
| Blood glucose < 50 or > 400 mg/dL | Intake Agent (IoT) | Immediate emergency path |
| SpO2 < 90% | Intake Agent (IoT) | Immediate emergency path |
| Confidence > 0.8 on life-threatening condition | Diagnostic Agent | Emergency path |
| Reviewer overrides to emergency | Reviewer Agent | Emergency path |

### Emergency Response Sequence
1. Post to `#emergency` channel (all agents subscribe)
2. Show full-screen red alert to user with immediate action steps
3. Page on-call doctor via `#doctor-comms` with `priority: critical`
4. Bypass async queue — solution delivered with emergency framing
5. Keep case open until doctor acknowledges

---

## 11. Accuracy Safeguards

| Layer | Safeguard |
|---|---|
| Intake | Structured parsing — reduces misinterpretation of symptoms |
| Diagnostic | Confidence scores shown — user sees uncertainty, not false certainty |
| Reviewer | Explicit cross-validation step — catches what Diagnostic Agent missed |
| Doctor Liaison | Human specialist loop — AI never final word on serious cases |
| Solution | Tiered warnings + "see a doctor if..." in every output |
| UI | Disclaimer on every screen — not a replacement for medical advice |

---

## 12. Honest Limitations

| Limitation | Detail |
|---|---|
| X-ray reading is pattern-based | Not a licensed radiologist — always flagged for radiologist review |
| Doctor responses are simulated | No real doctor API — simulated by a Claude call acting as the specialist |
| No persistent storage | Session only — no patient records saved to disk |
| Not a medical device | Regulatory compliance (FDA, CE) not claimed |
| IoT readings are manually entered | No direct device SDK integration in v1 |

---

## 13. RAG Knowledge Layer (Optional Enhancement)

No training is needed — agents are powered by prompt engineering. However, attaching a **Retrieval-Augmented Generation (RAG)** layer to the Diagnostic and Reviewer Agents significantly improves accuracy by giving them access to authoritative medical references at query time.

### What RAG Adds

| Without RAG | With RAG |
|---|---|
| Agent reasons from model's training data | Agent retrieves live, authoritative reference docs |
| Generic condition descriptions | ICD-10 codes, WHO guidelines, normal lab ranges |
| May hallucinate rare conditions | Grounded in retrieved clinical evidence |
| One model knowledge cutoff | Always up-to-date knowledge base |

### Knowledge Sources to Index

```
knowledge_base/
├── icd10/                    # ICD-10 condition codes + descriptions
├── lab_ranges/               # Normal ranges for 200+ biomarkers
├── who_guidelines/           # WHO clinical practice guidelines (PDFs)
├── drug_interactions/        # Common drug-drug and drug-condition interactions
├── emergency_protocols/      # Red flag symptom criteria
└── specialist_mapping/       # Condition → specialist type lookup
```

### RAG Implementation (Python)

```python
# Using AI/ML API embeddings + simple vector store
from openai import OpenAI
import numpy as np

client = OpenAI(
    api_key=os.getenv("AIML_API_KEY"),
    base_url="https://api.aimlapi.com/v1"
)

class MedicalRAG:
    def __init__(self):
        self.documents = []      # Chunked knowledge base
        self.embeddings = []     # Precomputed vectors

    def retrieve(self, query: str, top_k: int = 3) -> list[str]:
        """Retrieve top-k relevant medical guidelines for a query."""
        query_embedding = client.embeddings.create(
            model="text-embedding-ada-002",
            input=query
        ).data[0].embedding

        # Cosine similarity search
        scores = [
            np.dot(query_embedding, doc_emb) /
            (np.linalg.norm(query_embedding) * np.linalg.norm(doc_emb))
            for doc_emb in self.embeddings
        ]
        top_indices = np.argsort(scores)[-top_k:][::-1]
        return [self.documents[i] for i in top_indices]
```

### How Agents Use RAG

```python
# In diagnostic.py — before calling AI/ML API
relevant_guidelines = rag.retrieve(
    f"differential diagnosis for: {symptoms_summary}"
)

system_prompt = f"""
You are the Diagnostic Agent...

Relevant medical guidelines retrieved from knowledge base:
{chr(10).join(relevant_guidelines)}

Use these guidelines to support your diagnosis. Cite them in your confidence_basis field.
"""
```

### RAG vs Fine-tuning Decision

```
Use RAG when:         ✅ Domain knowledge needs to stay current
                      ✅ You need source citations for credibility
                      ✅ Fast to build (hours not months)
                      ✅ No labeled training data available

Use Fine-tuning when: ⚠️  You have 10k+ high-quality labeled examples
                      ⚠️  Very narrow, repetitive output format needed
                      ⚠️  Latency is critical (fine-tuned = fewer tokens)
```

For HealthBand v1 (hackathon): **RAG only.** Fine-tuning is a v2 consideration.

---

## 14. Agent Prompt Engineering Templates

Each agent has a carefully structured system prompt. These are the exact templates used.

### Intake Agent Prompt
```
You are the Intake Agent in the HealthBand multi-agent medical advisory system.
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
- Severity: ask user to rate 1-10 if not provided; default to 5 if not available.

Output format: strict JSON matching the HealthProfile schema. No markdown. No prose.
```

### Diagnostic Agent Prompt
```
You are the Diagnostic Agent in the HealthBand multi-agent medical advisory system.
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

Output format: strict JSON matching DiagnosticOutput schema. No markdown. No prose.
```

### Reviewer Agent Prompt
```
You are the Reviewer Agent — the quality gate of the HealthBand system.
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

Output format: strict JSON matching ReviewerOutput schema. No markdown. No prose.
```

### Doctor Liaison Agent Prompt
```
You are the Doctor Liaison Agent in HealthBand.
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

Output format: strict JSON matching LiaisonOutput schema. No markdown. No prose.
```

### Solution Agent Prompt
```
You are the Solution Agent — the final voice the patient hears.
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

Output format: strict JSON matching SolutionOutput schema. No markdown. No prose.
```

---

## 15. Agent Memory & Shared Context

Agents have no built-in memory between sessions. HealthBand solves this at two levels:

### Within-Session Memory (Band Channel History)
The Band message bus acts as the shared memory for the entire workflow. Every agent receives the full history of all relevant channels before generating its output. This means:

- Reviewer Agent sees everything Intake and Diagnostic posted
- Solution Agent has the complete clinical story from all 4 prior agents
- No context is lost between agent handoffs

```python
# In orchestrator.py — building agent context from Band history
def build_agent_context(channel_names: list[str]) -> str:
    """Aggregate Band channel history into a single context string."""
    context_parts = []
    for channel in channel_names:
        messages = band.get_channel_history(channel)
        for msg in messages:
            context_parts.append(
                f"[{msg.channel} | {msg.author} | {msg.timestamp}]\n"
                f"{json.dumps(msg.content, indent=2)}"
            )
    return "\n\n---\n\n".join(context_parts)
```

### Cross-Session Memory (v2 Consideration)
For a production system, patient history across visits adds significant value:

```
v2 additions:
├── PostgreSQL — persistent case storage
├── Patient profile — anonymized health history per user ID
├── Trend analysis — glucose trends over time, BP patterns
└── Returning patient context — Intake Agent reads prior cases
```

For hackathon v1: in-memory session only. No data persists between browser reloads.

---

## 16. Security & Privacy Design

Health data is among the most sensitive data in existence. Even for a hackathon demo, these principles must be built in from day one.

### Data Handling Rules
| Rule | Implementation |
|---|---|
| No PII stored | No names, DOBs, or identifiers saved anywhere |
| No file persistence | Uploaded files processed in memory, never written to disk |
| Session isolation | Each case gets a UUID; no cross-case data leakage |
| API key protection | AIML_API_KEY in `.env`, never in frontend code |
| HTTPS only | All API calls over TLS (enforced in production) |

### What Is and Isn't Sent to AI/ML API
```
Sent to AI/ML API:   Symptom descriptions (anonymized)
                     IoT readings (numbers only)
                     Lab report text (no patient name)
                     Image data (base64, no metadata)

NOT sent:            Patient names
                     Dates of birth
                     Insurance or ID numbers
                     Location data
```

### CORS Configuration (FastAPI)
```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Frontend dev server
    allow_credentials=False,                  # No cookies/sessions
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)
```

### File Upload Security
```python
ALLOWED_MIME_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/dicom"   # X-ray/MRI format
}
MAX_FILE_SIZE_MB = 10

def validate_upload(file: UploadFile) -> bool:
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(400, "Unsupported file type")
    if file.size > MAX_FILE_SIZE_MB * 1024 * 1024:
        raise HTTPException(400, "File too large")
    return True
```

---

## 17. Error Handling & Resilience

### Agent Failure Strategy
Each agent can fail independently. The system degrades gracefully:

```
If Intake Agent fails:     → Return error to user immediately (cannot proceed)
If Diagnostic Agent fails: → Reviewer gets empty diagnosis, escalates to doctor directly
If Reviewer Agent fails:   → System uses raw Diagnostic output + flags for mandatory doctor review
If Doctor Liaison fails:   → Solution Agent proceeds with disclaimer "doctor review unavailable"
If Solution Agent fails:   → Return raw Reviewer output with disclaimer
```

### Retry Logic
```python
import asyncio

async def call_agent_with_retry(
    agent_fn,
    max_retries: int = 3,
    backoff_seconds: float = 1.5
):
    last_error = None
    for attempt in range(max_retries):
        try:
            return await agent_fn()
        except Exception as e:
            last_error = e
            if attempt < max_retries - 1:
                await asyncio.sleep(backoff_seconds * (attempt + 1))
    raise last_error
```

### Timeout Configuration
```python
AGENT_TIMEOUTS = {
    "intake":     30,   # seconds — multimodal parsing can be slow
    "diagnostic": 45,   # seconds — deep reasoning model
    "reviewer":   30,   # seconds
    "liaison":    10,   # seconds — fast routing model
    "solution":   30,   # seconds
}
```

---

## 18. Testing Strategy

### Unit Tests — Per Agent
```python
# tests/test_intake_agent.py
import pytest
from agents.intake import IntakeAgent

@pytest.mark.asyncio
async def test_emergency_detection():
    agent = IntakeAgent()
    result = await agent.run("I have severe chest pain and can't breathe")
    assert result["emergency_keywords_detected"] == True

@pytest.mark.asyncio
async def test_iot_normalization():
    agent = IntakeAgent()
    result = await agent.run("my sugar is 248 mg/dL and BP is 138/88")
    assert result["iot_readings"]["blood_glucose_mgdl"] == 248
    assert result["iot_readings"]["blood_pressure"] == "138/88"
```

### Integration Tests — Full Pipeline
```python
# tests/test_pipeline.py
@pytest.mark.asyncio
async def test_full_workflow_routine():
    """End-to-end test for a routine (non-emergency) case."""
    case = await orchestrator.run_case(
        symptoms="mild fatigue and occasional headache for 3 days",
        iot_readings={"blood_glucose_mgdl": 95, "blood_pressure": "118/76"}
    )
    assert case.status == "completed"
    assert case.emergency is False
    assert case.solution is not None
    assert "disclaimer" in case.solution

@pytest.mark.asyncio
async def test_emergency_path():
    """Emergency path bypasses async queue."""
    case = await orchestrator.run_case(
        symptoms="chest pain radiating to left arm",
        iot_readings={"blood_glucose_mgdl": 95, "spo2_percent": 88}
    )
    assert case.emergency is True
    assert case.escalation_path == "emergency"
    assert case.doctor_liaison.mode == "on-call"
```

### Demo Scenario Tests
```python
# tests/test_scenarios.py
SCENARIOS = [
    {
        "name": "Diabetic Emergency",
        "input": {"glucose": 420, "bp": "160/100"},
        "expected_path": "emergency"
    },
    {
        "name": "Routine Wellness",
        "input": {"symptoms": "fatigue, mild headache"},
        "expected_path": "async_review"
    },
    {
        "name": "Imaging Upload",
        "input": {"file": "chest_xray.jpg", "symptoms": "persistent cough"},
        "expected_path": "async_review",
        "expected_specialist": "radiologist"
    }
]
```

---

## 19. Deployment Guide

### Development (Local)
```bash
# Terminal 1 — Backend
cd healthband/backend
uvicorn main:app --reload --port 8000

# Terminal 2 — Frontend
cd healthband/frontend
npm run dev
# → http://localhost:5173
```

### Production (Docker)
```dockerfile
# Dockerfile.backend
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

```yaml
# docker-compose.yml
version: "3.9"
services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.backend
    ports:
      - "8000:8000"
    environment:
      - AIML_API_KEY=${AIML_API_KEY}
      - AIML_API_BASE=https://api.aimlapi.com/v1
    restart: unless-stopped

  frontend:
    build:
      context: ./frontend
    ports:
      - "3000:3000"
    depends_on:
      - backend
    restart: unless-stopped
```

```bash
# Run everything
docker-compose up --build
# → Frontend: http://localhost:3000
# → Backend:  http://localhost:8000
# → API docs: http://localhost:8000/docs
```

### Environment Variables
```bash
# .env.example
AIML_API_KEY=your_aiml_api_key_here
AIML_API_BASE=https://api.aimlapi.com/v1

# Optional RAG
ENABLE_RAG=false
KNOWLEDGE_BASE_PATH=./knowledge_base

# Optional doctor simulation
SIMULATE_DOCTOR_RESPONSE=true
DOCTOR_RESPONSE_DELAY_SECONDS=10
```

---

## 20. Complete Build Order (Updated)

```
Phase 1 — Backend Foundation
  ├── FastAPI scaffold + CORS + error handlers
  ├── AI/ML API base client (OpenAI-compatible wrapper)
  ├── Band message bus (in-memory pub/sub + channel schemas)
  ├── Pydantic schemas for all 5 agent I/O types
  └── Case state machine (pending → running → completed → error)

Phase 2 — Agents (in pipeline order)
  ├── Intake Agent (multimodal: text + PDF + image + IoT)
  ├── Diagnostic Agent (reasoning: deepseek-r1 + RAG optional)
  ├── Reviewer Agent (critique: claude-3-5-sonnet)
  ├── Doctor Liaison Agent (routing + async queue + emergency path)
  └── Solution Agent (recommendations: claude-3-5-sonnet)

Phase 3 — Orchestrator
  ├── Sequential agent chaining via Band
  ├── Emergency detection hook at every agent step
  ├── Retry logic + timeout handling
  ├── Async doctor queue management
  └── Graceful degradation on agent failure

Phase 4 — Frontend (Tasteskill design)
  ├── Band workspace UI (6 channels, live feed)
  ├── Health intake form (symptoms + IoT readings)
  ├── File uploader (PDF + image drag-and-drop + type detection)
  ├── Agent status panel (right sidebar, live pills)
  ├── Emergency alert overlay (full-screen takeover)
  ├── Doctor async status tracker (badge + eta)
  └── Final report view (structured + downloadable)

Phase 5 — Integration & Polish
  ├── Frontend ↔ Backend wiring (REST + polling)
  ├── Doctor response simulation (timed async callback)
  ├── Error states + loading skeletons
  ├── Three preset demo scenarios
  └── Disclaimer layer on every screen

Phase 6 — Testing & Deployment
  ├── Unit tests per agent
  ├── Integration tests for full pipeline
  ├── Emergency path tests
  ├── Docker setup
  └── README + demo video prep
```

---

