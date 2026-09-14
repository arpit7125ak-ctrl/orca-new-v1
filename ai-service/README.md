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

## Current phase

**Phase A3 — mock adapters.** All seven agents return deterministic fake data derived from a hash of (lat, lon, parameter, hour), so the same point always yields the same reading and a demo is repeatable.

Two parameters deliberately come back unavailable (`tide_height_m` as `missing`, `tidal_current_ms` as `not_mapped`) so the never-fabricate path is exercised on every run rather than only in theory.

**Phase A4** swaps `app/adapters/mock.py` for real INCOIS / IMD / MOSDAC adapters. Nothing else in the pipeline changes — that isolation is the point of the adapter layer.

---

## Known gaps

- Route planning (`route_result`) and trend analysis (`trend_result`) are planned but not yet implemented; those intents currently fall through to the decision path
- The gazetteer in `planner/location.py` is a small hardcoded set of Indian coastal places — fine for the demo, replace with a real geocoder for production
- `is_on_land()` is a proximity heuristic, not a real land/sea mask
