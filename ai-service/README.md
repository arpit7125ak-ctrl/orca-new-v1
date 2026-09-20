# ORCA AI Service

**Team Nautilus · SIH 26176**

The agentic pipeline: Planner → data agents → Risk → Decision. Python + FastAPI, calling Gemini for the reasoning stages and deterministic Python for everything safety-critical.

---

## Quick start

```bash
cd ai-service
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS / Linux

pip install -r requirements.txt
copy .env.example .env           # then fill in GEMINI_API_KEY and INTERNAL_SECRET

uvicorn app.main:app --port 8000 --reload
```

`INTERNAL_SECRET` **must be byte-identical to the Backend's**. That shared secret is what signs the callback tokens in both directions; if it differs, every callback returns 401.

---

## Folder layout — keep it as a sibling

```
orca/
├── backend/          Node.js  (ports 4000 public, 4100 internal)
├── ai-service/       Python   (port 8000)          ← this service
├── contracts/        44 JSON Schema files, shared by BOTH services
└── shared-config/    activities, vessel types, languages, units — shared
```

`contracts/` and `shared-config/` are read by both services from these exact relative paths. Moving `ai-service/` elsewhere breaks that, and duplicate copies are what let the two sides drift apart.

---

## Verify before integrating

```bash
python scripts/verify_contracts.py
```

Runs the whole pipeline offline — no Gemini, no Backend, no network — and validates every payload against the real contracts. Currently **26/26 passing**, including the never-fabricate invariants:

- unavailable measurements carry `null` value **and** `null` source
- no final risk score ever sits below its constraint floor
- risk levels are UPPERCASE everywhere
- a GIS-prohibited point is never the recommended point

Run this after any change. It catches the class of bug that only shows up at integration time otherwise.

---

## Where the LLM is used, and where it deliberately is not

| Stage | LLM? | What it does |
|---|---|---|
| Planner | Yes | Intent classification, agent selection with reasons |
| Location / time / sampling | No | Pure deterministic Python |
| 7 data agents | No | Fetch + normalise only |
| Risk baseline | No | Arithmetic over published thresholds |
| Official warnings, hard rules | No | Rule checks that force a score floor |
| Risk interpretation | Yes, **bounded** | Explains findings, may nudge ±10 only |
| Decision — point selection | No | Rule-based exclusion and ranking |
| Decision — advisory text | Yes | Writes the prose only |

The guarantee that matters (Section 51.3):

```
constraint_floor = max(official_warning_floor, hard_rule_floor)
proposed         = baseline + llm_adjustment      # |adjustment| ≤ 10
final_score      = clamp(max(proposed, constraint_floor), 0, 100)
```

The floors are computed **before** the LLM sees anything, so it is arithmetically impossible for the model to make dangerous conditions look safe. It may raise a score freely; it may not lower one across a level boundary, and never below a floor.

---

## Degradation, not fabrication

Every external dependency can fail, and each has an honest fallback rather than an invented one:

| Missing | Behaviour |
|---|---|
| Gemini unavailable | Deterministic heuristic plan; risk explanation falls back to the baseline numbers; `llm_interpretation_unavailable: true` is recorded |
| A data agent fails | Pipeline continues; final status becomes `partial`; the gap is reported per point |
| No point scoreable | Honest `failed` result — never a guessed verdict |
| Location unresolvable | Hard stop with `unresolvable_place` — never a guessed location |
| Backend unreachable | Progress messages are dropped (logged); the final result is retried with backoff |

---

## Configuration

| Variable | Purpose |
|---|---|
| `INTERNAL_SECRET` | **Must match the Backend exactly.** Signs callback JWTs |
| `BACKEND_INTERNAL_URL` | Default `http://localhost:4100` — the internal port, not 4000 |
| `GEMINI_API_KEY` | Required unless `USE_MOCK_LLM=true` |
| `GEMINI_MODEL` | Default `gemini-3.5-flash-lite` |
| `USE_MOCK_LLM` | `true` skips all Gemini calls — useful offline and in CI |
| `ADAPTER_MODE` | `mock` (Phase A3) or `real` (Phase A4) |
| `LLM_ADJUSTMENT_BAND` | Default 10 — the ± bound on the Risk LLM's nudge |

---

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/v1/analysis/execute` | The Backend's handoff. Returns **202 immediately**, runs in background |
| GET | `/health` | Liveness |
| GET | `/health/ready` | Readiness — contracts loaded, Backend reachable, Gemini configured |

`/v1/analysis/execute` is idempotent: a retry for an `analysis_id` already in flight returns 200 and starts nothing.

---

## Current Status: Phase A4 (Live Cloud & Multi-Agent Telemetry)

- **Production Cloud Deployment**: Active on Render at **[`https://orca-ai-service-b0fx.onrender.com`](https://orca-ai-service-b0fx.onrender.com)**.
- **MongoDB Atlas Integration**: Queries remote `Cluster0` for 299 GIS maritime boundaries and 230 active INCOIS PFZ line features.
- **Multi-Activity Support**: Real-time risk modeling across all 7 marine sectors: `tourism`, `boating`, `diving`, `surfing`, `shipping`, `marine_research`, `fishing`.
- **Live Metocean Feeds**:
  - `open_meteo.py`: Real-time ECMWF/GFS wave, swell, and wind vectors.
  - `imd_cyclone.py`: Live NDMA SACHET Common Alerting Protocol (CAP) gateway parser.
  - `copernicus_ecosystem.py`: Ocean surface chlorophyll-a & dissolved oxygen upwelling model.
  - `mongo_gis.py`: Authoritative UNCLOS maritime zones, MPAs, and GEBCO bathymetry.
  - `incois_pfz.py`: Oceansat-3 OCM thermal front proximity and target pelagic species evaluation.
- **Contract Verification**: **26/26 automated tests passing** (`python scripts/verify_contracts.py`).

---

## Future AI Service Architecture & Enterprise Vision

To establish ORCA as a next-generation autonomous maritime intelligence system, the AI engine evolves across four core technological frontiers:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   ORCA FINAL ENTERPRISE AI ARCHITECTURE                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                     ORCA MULTI-MODAL INTENT AGENT                     │  │
│  │           Gemini 2.5 Flash + Dialect Voice Transcription Bridge       │  │
│  └───────────────────────────────────┬───────────────────────────────────┘  │
│                                      │                                      │
│        ┌─────────────────────────────┼─────────────────────────────┐        │
│        ▼                             ▼                             ▼        │
│  ┌───────────┐                 ┌───────────┐                 ┌───────────┐  │
│  │ 7 Live    │                 │ PINN Wave │                 │ Fine-Tuned│  │
│  │ Telemetry │                 │ Shoaling  │                 │ Marine LLM│  │
│  │ Adapters  │                 │ ML Model  │                 │(8B Domain)│  │
│  └─────┬─────┘                 └─────┬─────┘                 └─────┬─────┘  │
│        │                             │                             │        │
│        └─────────────────────────────┼─────────────────────────────┘        │
│                                      ▼                                      │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                 DETERMINISTIC MARITIME RISK GOVERNOR                  │  │
│  │   Official Warning Floors ──► GIS Exclusions ──► Bounded XAI Nudge   │  │
│  └───────────────────────────────────┬───────────────────────────────────┘  │
│                                      │                                      │
│                                      ▼                                      │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                 REINFORCEMENT LEARNING ROUTE OPTIMIZER                │  │
│  │         Autonomous Safe Corridor Pathfinding (A* / D* Lite)           │  │
│  └───────────────────────────────────┬───────────────────────────────────┘  │
│                                      │                                      │
│                                      ▼                                      │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                     EDGE ON-VESSEL DEPLOYMENT CORE                    │  │
│  │         Quantized GGUF / ONNX Model for Raspberry Pi 5 & Jetson       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1. Physics-Informed Neural Networks (PINN) for Nearshore Shoaling
- Deep learning neural operators trained on shallow-water wave equations (Boussinesq & SWAN models).
- Accurately models nonlinear wave amplification, harbor resonance, and rip current formation along complex reef bathymetry where traditional numerical grids lose resolution.

### 2. Fine-Tuned Domain Marine LLM (`ORCA-Marine-8B`)
- Open-weights SLM (Small Language Model) fine-tuned on historical IMD cyclone bulletins, INCOIS marine advisories, Admiralty Sailing Directions, and nautical colregs.
- Delivers hyper-contextual nautical reasoning in low-latency environments with zero hallucinations.

### 3. Reinforcement Learning Route Optimizer (Deep Q-Learning / PPO)
- Autonomous vessel routing agent that simulates 1,000 navigational paths across dynamic current and wave fields.
- Optimizes engine fuel economy by up to 22% by leveraging tidal assistance while strictly guaranteeing safety scores remain $< 35$ (GREEN).

### 4. Edge Embedded Deployment for Zero-Connectivity High Seas
- 4-bit quantized model runtime deployable onto an onboard **Raspberry Pi 5** or **NVIDIA Jetson Orin Nano** installed directly inside the vessel wheelhouse.
- Enables continuous real-time multi-agent safety evaluation thousands of nautical miles offshore with zero satellite data costs.

