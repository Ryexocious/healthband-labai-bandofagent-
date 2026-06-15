# 🏥 HealthBand — Multi-Agent Medical Advisory System

> **5 AI agents collaborate through Band to analyze symptoms, diagnose conditions, and deliver actionable health recommendations.**

Built for **Track 3: Regulated & High-Stakes Workflows** using [Band (Thenvoi)](https://band.ai) as the agent communication layer.

⚠️ **Disclaimer:** HealthBand is an informational advisory tool, not a licensed medical device. All outputs include a mandatory professional consultation notice.

---

## 🎯 What It Does

Users submit health data — symptoms, lab reports, X-rays, IoT device readings — and a chain of 5 specialized AI agents analyzes, reviews, cross-validates, and delivers actionable recommendations.

```
User Input → Intake Agent → Diagnostic Agent → Reviewer Agent → Doctor Liaison → Solution Agent → Report
```

## 🤖 The 5 Agents

| Agent | Model | Role | Band Channel |
|-------|-------|------|-------------|
| **Intake Agent** | gpt-4o | Parse symptoms, IoT, images into structured JSON | `#intake` |
| **Diagnostic Agent** | deepseek-r1 | Identify conditions with ICD-10 codes + confidence | `#diagnosis` |
| **Reviewer Agent** | claude-3-5-sonnet | Quality gate — challenge and validate diagnosis | `#review` |
| **Doctor Liaison** | gpt-4o-mini | Route to specialist + format clinical brief | `#doctor-comms` |
| **Solution Agent** | claude-3-5-sonnet | Generate actionable patient recommendations | `#solutions` |

## 🎵 Band Integration

HealthBand uses [Band (Thenvoi)](https://band.ai) as its agent communication infrastructure:

- **Rooms as Channels** — Each agent publishes to Band rooms (`#intake`, `#diagnosis`, etc.)
- **Agent Discovery** — Agents discover and communicate with each other through Band's platform
- **Persistent History** — Band manages conversation records so agents have full context
- **@Mention Routing** — Agents use `@mentions` to coordinate handoffs
- **Audit Trail** — Complete agent interaction history via Band rooms

### Running Band Agents

1. Create 5 agents at [app.band.ai/agents](https://app.band.ai/agents)
2. Copy UUIDs and API keys to `.env`
3. Run the Band agent runner:

```bash
cd backend
python band_runner.py
```

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- AI/ML API key ([aimlapi.com](https://aimlapi.com))

### Setup

```bash
# Clone
git clone <repo-url>
cd healthband

# Backend
cd backend
pip install -r ../requirements.txt
cp ../.env.example ../.env
# Edit .env with your API keys

# Frontend
cd ../frontend
npm install
```

### Run

```bash
# Terminal 1 — Backend
cd backend
uvicorn main:app --reload --port 8000

# Terminal 2 — Frontend
cd frontend
npm run dev
# → http://localhost:5173

# Terminal 3 — Band Agents (optional, for Band platform integration)
cd backend
python band_runner.py
```

## 📂 Project Structure

```
healthband/
├── backend/
│   ├── main.py                    # FastAPI app, routes, CORS
│   ├── orchestrator.py            # Workflow runner, agent chaining
│   ├── band_runner.py             # Band platform agent connector
│   ├── agents/
│   │   ├── base.py                # BaseAgent class (AI/ML API client)
│   │   ├── intake.py              # Intake Agent (gpt-4o, multimodal)
│   │   ├── diagnostic.py          # Diagnostic Agent (deepseek-r1)
│   │   ├── reviewer.py            # Reviewer Agent (claude-3-5-sonnet)
│   │   ├── liaison.py             # Doctor Liaison (gpt-4o-mini)
│   │   └── solution.py            # Solution Agent (claude-3-5-sonnet)
│   ├── band/
│   │   ├── channel.py             # Band message bus (in-memory pub/sub)
│   │   └── schemas.py             # Channel message schemas
│   ├── doctors/
│   │   ├── directory.py           # Doctor registry + specialist matching
│   │   └── doctors.json           # 6 specialist doctors
│   ├── files/
│   │   ├── parser.py              # PDF + image processing
│   │   └── vision.py              # Vision prompt builder
│   └── models/
│       └── schemas.py             # Pydantic models for all agent I/O
├── frontend/
│   ├── src/
│   │   ├── App.jsx                # Root component (3-column layout)
│   │   ├── components/
│   │   │   ├── BandWorkspace.jsx  # Band channel feed UI
│   │   │   ├── AgentStatus.jsx    # Agent pipeline status panel
│   │   │   ├── HealthIntakeForm.jsx # Symptom + IoT input form
│   │   │   ├── EmergencyAlert.jsx # Full-screen emergency overlay
│   │   │   └── FinalReport.jsx    # Structured recommendation report
│   │   └── styles/
│   │       └── tasteskill.css     # Tasteskill design system
│   └── package.json
├── requirements.txt
├── .env.example
└── README.md
```

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/register` | Register new user with Patient or Doctor role |
| `POST` | `/api/auth/login` | Login user and obtain JWT token |
| `GET` | `/api/auth/me` | Fetch active user information |
| `POST` | `/api/cases` | Start new case (multipart: text + files) |
| `GET` | `/api/cases/{id}` | Get full case + all agent outputs |
| `GET` | `/api/cases/{id}/status` | Poll workflow progress |
| `GET` | `/api/cases/{id}/band` | Get all Band channel messages |
| `POST` | `/api/cases/{id}/band/message` | Post message directly into Band room |
| `POST` | `/api/cases/{id}/imaging/upload` | Upload scan image file for mock pattern analysis |
| `POST` | `/api/cases/{id}/imaging/order` | Place scan order (X-ray, MRI, CT, etc.) |
| `POST` | `/api/cases/{id}/imaging/notes` | Save radiological interpretation notes (Doctor) |
| `POST` | `/api/cases/{id}/labs/record` | Log patient vitals (Glucose, BP, SpO2, Temp, etc.) |
| `POST` | `/api/cases/{id}/labs/order` | Place order for specialized lab panels |
| `POST` | `/api/cases/{id}/pharmacy/prescription` | Edit medication list on prescription (Doctor) |
| `POST` | `/api/cases/{id}/pharmacy/authorize` | Digitally sign and authorize prescription (Doctor) |
| `POST` | `/api/cases/{id}/pharmacy/order` | Place final pharmacy order (Patient) |
| `POST` | `/api/doctor/respond` | Submit specialist clinician verdict (real or sim) |
| `GET` | `/api/doctors` | List available specialist doctors |
| `POST` | `/api/emergency/acknowledge` | Doctor acknowledges emergency case |

## ⚡ Interactive Clinical Workspaces

We upgraded the four agent workspace tabs to support real-time clinical workflows:

1. **Diagnostic Hub (`band` tab)**
   - **Interactive Board**: View differential diagnoses, ICD-10 codes, and live confidence levels.
   - **Direct Referrals**: Doctor can place referrals to specialists (Routine, Urgent, Stat) directly from the hub.
   - **Live Queries**: Input console allowing users to query AI agents directly by posting to the Band room.

2. **Imaging Agent (`imaging` tab)**
   - **DICOM Simulator**: Premium interactive viewer featuring real-time Brightness, Contrast, Zoom, and Color Inversion controls.
   - **Clinical Overlays**: Toggles highlighted consolidation/ischemic areas using custom-drawn SVG vectors.
   - **Interpretation Log**: Form for doctors to document radiological reports.
   - **Scan Ordering**: Request scans (Chest X-ray, Brain MRI, CT, etc.) directly.

3. **Labs Agent (`labs` tab)**
   - **Biomarker Dashboard**: Visual display of Blood Glucose, BP, SpO2, Temp, HbA1c, Weight with range checks.
   - **Vitals Logger**: Log new patient readings and record them in the trends history log.
   - **Lab Assays**: Order panels (CBC, BMP, Lipid Panel, HbA1c) directly.

4. **Pharmacy Agent (`pharmacy` tab)**
   - **Prescription Formulator**: Allows doctors to add/remove drugs, set quantities, dosages, and costs.
   - **Digital Signing**: Doctors sign to authorize prescriptions. Patient orders are locked until signature verification is complete.
   - **Safety Screen**: Interactive checklist screening for drug-drug interactions.

## 🚨 Emergency Detection

Any agent can trigger an emergency. Detection runs at every step:

| Signal | Source | Trigger |
|--------|--------|---------|
| Keywords: "chest pain", "stroke", "unconscious" | Intake Agent | Immediate |
| Blood glucose < 50 or > 400 mg/dL | Intake Agent (IoT) | Immediate |
| SpO2 < 90% | Intake Agent (IoT) | Immediate |
| BP > 180/120 | Intake Agent (IoT) | Immediate |
| High-confidence life-threatening condition | Diagnostic Agent | Immediate |
| Reviewer escalation override | Reviewer Agent | Immediate |

## 🏗️ Tech Stack

| Component | Technology |
|-----------|-----------|
| Backend | FastAPI (Python 3.11+) |
| Database & ORM | PostgreSQL (Supabase) + Prisma ORM |
| Authentication | JSON Web Tokens (JWT) + HTTP Bearer |
| Agent Communication | Band (Thenvoi SDK) |
| AI Engine | AI/ML API (OpenAI-compatible, multi-model) |
| Data Validation | Pydantic v2 |
| Frontend | React (Vite) |
| Design System | Custom dark medical theme |

## 📝 License

MIT
