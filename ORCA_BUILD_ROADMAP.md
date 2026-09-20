# ORCA (SIH26176) — Full Build Roadmap

Every file, in the order it should actually be written, with why that order.
Checkboxes so you can track progress across sessions. Two files
(`ai-service/api/entry.py`, `backend/src/modules/auth/*`) are marked
**PROPOSED** — the architecture doc never specifies them; we're building them
anyway but you agreed to skip formally writing the resolution into the doc.

---

## PART 0 — Already Locked (no action needed)

- [x] `contracts/` — 44 JSON Schema files (shared/, api/, db/), zero broken `$ref`s, enums verified
- [x] `analysis_id` format resolved: `req_{YYYYMMDD}_{HHMM}_{hash6}`, written into §8.1
- [x] `geofence_events` (§99.11) and `users` (§99.12) spec gaps closed
- [x] Backend↔AI-Service internal contract (`POST /internal/v1/execute`) written into §103
- [x] `baseline_score` formula locked into §48.4.1
- [x] Canonical SI units rule written into §24.2 (`wind_speed` → m/s)
- [x] `Measurement.json` nullability bug fixed across all 44 files

---

## PART 1 — Backend (Node.js / Express / Mongoose)

### Phase B1 — Foundation
- [x] `package.json`
- [x] `.env.example`
- [x] `src/config/env.js`
- [x] `src/db/connection.js`
- [ ] `src/config/limits.js` — fixed numbers (geofence warning distance, grid radius, etc.)
- [ ] `src/config/registry.js` — loads `shared-config/activities.json`, `vessel-types.json`, `languages.json` at startup
- [ ] `src/db/indexes.js` — `analysis_id` uniqueness, `2dsphere` indexes for GIS/geofence

### Phase B2 — Models (`src/db/models/`, one per Mongo collection)
- [ ] `analysis.model.js` → `contracts/db/AnalysesDocument.json`
- [ ] `agentResult.model.js` → `contracts/AgentResult.json`
- [ ] `riskResult.model.js` → `contracts/db/RiskResultsDocument.json`
- [ ] `decision.model.js` → `contracts/Decision.json`
- [ ] `gisLayer.model.js` → `contracts/db/GisLayerDocument.json`
- [ ] `alertSubscription.model.js` → `contracts/api/AlertSubscriptionResponse.json`
- [ ] `alertEvent.model.js` → `contracts/db/AlertEventDocument.json`
- [ ] `geofenceEvent.model.js` → `contracts/db/GeofenceEventDocument.json`
- [ ] `conversation.model.js` → `contracts/db/ConversationDocument.json`
- [ ] `route.model.js` → `contracts/RouteResult.json`
- [ ] `report.model.js` → `contracts/ReportContent.json`
- [ ] `user.model.js` → `contracts/User.json`

### Phase B3 — Errors & Middleware (needed before any route exists)
- [ ] `src/errors/errorCategories.js` — mirrors `shared/ErrorInfo.json`'s `error_category` enum
- [ ] `src/errors/httpStatus.js` — error category → HTTP status mapping (§40)
- [ ] `src/middleware/cors.js`
- [ ] `src/middleware/rateLimit.js`
- [ ] `src/middleware/sanitize.js` — cleans free text before it hits any tool/LLM
- [ ] `src/middleware/validateContract.js` — **the** Ajv gate against `contracts/**/*.json`
- [ ] `src/middleware/internalAuth.js` — protects `/internal/v1/*`
- [ ] `src/middleware/roleGuard.js`
- [ ] `src/middleware/errorHandler.js`

### Phase B4 — Observability & Utils
- [ ] `src/observability/logger.js` — redacts secrets, caps GPS trail length
- [ ] `src/observability/trace.js` — writes `execution_trace` (§100)
- [ ] `src/utils/ids.js` — `analysis_id` generator, locked format
- [ ] `src/utils/time.js` — local ⇄ UTC window handling

### Phase B5 — Outbound Clients
- [ ] `src/clients/aiService.client.js` — signed short-lived tokens, sends `AnalysisExecutionRequest.json`
- [ ] `src/clients/bhashini.client.js`

### Phase B6 — i18n templates
- [ ] `src/i18n/templates/geofenceWarnings.json`
- [ ] `src/i18n/templates/alertMessages.json`

### Phase B7 — Core feature: `modules/analysis/` (the main pipeline entry point)
- [ ] `analysis.routes.js` — `POST /analysis`, `GET /:id`, `GET /:id/status`
- [ ] `analysis.controller.js`
- [ ] `analysis.service.js` — generates `analysis_id`, persists, dispatches to AI Service
- [ ] `analysis.validator.js`
- [ ] `pointMerge.js` — matches agent data by `point_id`
- [ ] `statusBuilder.js`
- [ ] `resultBuilder.js`

### Phase B8 — `modules/internal/` (receives callbacks from AI Service)
- [ ] `internal.routes.js` — `POST /internal/v1/progress`, `POST /internal/v1/result`
- [ ] `progress.controller.js`
- [ ] `result.controller.js`

### Phase B9 — App wiring (first point everything becomes runnable end-to-end)
- [ ] `src/app.js` — Express app, JSON parsing, CORS, rate limiting, mounts all module routes
- [ ] `src/server.js` — public server entrypoint
- [ ] `src/internal-server.js` — separate internal-only server
- [ ] `src/worker.js` — background alert-scheduler process

> **Checkpoint:** at this point `POST /analysis` → AI Service → `/internal/v1/result` round-trip is testable even with the AI Service stubbed out. Good place to pause and smoke-test before adding the remaining feature modules.

### Phase B10 — Remaining feature modules
- [ ] `modules/chat/`: `chat.routes.js`, `chat.controller.js`, `chat.service.js`, `contextBuilder.js`, `conversationHistory.controller.js`
- [ ] `modules/geofence/`: `geofence.routes.js`, `geofence.controller.js`, `geofence.service.js` (pure geometry, no LLM), `dedup.js`, `auditLogger.js`
- [ ] `modules/map/`: `map.routes.js`, `map.controller.js`
- [ ] `modules/route/`: `route.routes.js`, `route.controller.js`, `route.service.js`
- [ ] `modules/trend/`: `trend.routes.js`, `trend.controller.js`, `trend.service.js`
- [ ] `modules/report/`: `report.routes.js`, `report.controller.js`, `report.service.js`
- [ ] `modules/alerts/`: `subscriptions.routes.js`, `subscriptions.controller.js`, `subscriptions.service.js`, `scheduler.js` (used only by `worker.js`), `dedup.js`, `eventLogger.js`, `delivery/webPush.js`
- [ ] `modules/voice/`: `voice.routes.js`, `voice.controller.js`, `voice.service.js`
- [ ] `modules/auth/` **(PROPOSED — no §103 endpoints defined)**: `auth.routes.js`, `auth.controller.js`, `user.service.js`, `inviteCode.js`

### Phase B11 — Scripts (run manually / in CI, not part of the running app)
- [ ] `scripts/seed-gis-layers.js`
- [ ] `scripts/seed-ports.js`
- [ ] `scripts/create-indexes.js`
- [ ] `scripts/validate-schemas.js` — `ajv.compile()` on every contract, run in CI

### Phase B12 — Tests
- [ ] `tests/unit/pointMerge.test.js`, `dedup.test.js`, `ids.test.js`, `resultBuilder.test.js`
- [ ] `tests/integration/*.test.js` — lifecycle, `internalAuth`, geofence latency, alert dedup
- [ ] `tests/contract/everyResponse.test.js` — live responses vs. `contracts/**/*.json`

---

## PART 2 — AI Service (Python / FastAPI / LangGraph)

### Phase A1 — Schema sync (fully automated, do this first)
- [ ] Run `contracts/generate.sh` → produces all 44 files under `ai-service/schemas/` (mirrors `contracts/` folder-for-folder). Never hand-edit these; re-run the script when a contract changes.

### Phase A2 — Static configuration (no code depends on anything except this)
- [ ] `config/risk_thresholds.yaml` — §48.5 bands, illustrative until calibrated
- [ ] `config/official_warning_rules.yaml` — §49.2
- [ ] `config/gis_constraints.yaml` — §65.1
- [ ] `config/vessel_profiles.yaml` — validated against `schemas/shared/vessel_profile.py`
- [ ] `registry/agent_registry.yaml` — §22, single source of truth for agent capabilities
- [ ] `registry/registry_loader.py`
- [ ] `prompts/planner_prompt.md`, `risk_prompt.md`, `decision_prompt.md`, `trend_prompt.md`, `report_prompt.md`, `chat_prompt.md`

### Phase A3 — Mock adapters first (unblocks demo + parallel dev before real API access is sorted)
- [ ] `adapters/mock/mock_weather.py`, `mock_ocean.py`, `mock_gis.py`, `mock_pfz.py`, `mock_ecosystem.py`

### Phase A4 — Real source adapters
- [ ] `adapters/weather/imd_adapter.py`, `open_meteo_adapter.py`
- [ ] `adapters/ocean/incois_osf_adapter.py`, `copernicus_adapter.py`
- [ ] `adapters/ecosystem_mosdac_adapter.py`
- [ ] `adapters/gis_bhuvan_adapter.py`
- [ ] `adapters/pfz_incois_adapter.py`

### Phase A5 — Data agents (call adapters, output canonical `PointObservation`/`Measurement`)
- [ ] `agents/weather_agent.py`
- [ ] `agents/ocean_agent.py`
- [ ] `agents/tide_agent.py`
- [ ] `agents/cyclone_agent.py`
- [ ] `agents/ecosystem_agent.py`
- [ ] `agents/pfz_agent.py`
- [ ] `agents/gis_agent.py`

### Phase A6 — Planner building blocks
- [ ] `planner/language_detector.py` (§11)
- [ ] `planner/intent_classifier.py` (§12)
- [ ] `planner/geocoder.py` (§13.1)
- [ ] `planner/land_sea_mask.py` (§13.2)
- [ ] `planner/offshore_snapping.py` (§13.3)
- [ ] `planner/time_parser.py` (§14)
- [ ] `planner/spatial_sampling.py` (§15–17, nine-point grid)
- [ ] `planner/planner_llm.py` — ties the above together, validates → `ExecutionPlan.json`

### Phase A7 — Data discovery
- [ ] `data_discovery/data_catalog.py` (§19.1)
- [ ] `data_discovery/data_plan_builder.py`

### Phase A8 — Risk engine (deterministic first, LLM last, exactly per §47.2 stage order)
- [ ] `risk/baseline.py` (§48)
- [ ] `risk/official_warning_override.py` (§49)
- [ ] `risk/hard_rules.py` (§50)
- [ ] `risk/risk_llm.py` (§51, bounded adjustment only)
- [ ] `risk/risk_validator.py` (§56.2)

### Phase A9 — Decision engine
- [ ] `decision/point_selector.py` (§59)
- [ ] `decision/best_time.py` (§63)
- [ ] `decision/decision_llm.py`
- [ ] `decision/decision_validator.py` (§56.3)

### Phase A10 — Secondary capabilities
- [ ] `route/cost_grid.py`, `route/pathfinder.py` (A*/Dijkstra)
- [ ] `trend/anomaly_calc.py`, `trend/trend_llm.py`
- [ ] `report/report_agent.py`
- [ ] `visualization/viz_spec_builder.py` (§32.5)
- [ ] `chat/chat_agent.py`, `chat/followup_decider.py` (§90.1)

### Phase A11 — Graph wiring (LangGraph ties every phase above together)
- [ ] `graph/state.py`
- [ ] `graph/nodes/planner_node.py`, `risk_node.py`, `decision_node.py`, `route_node.py`, `trend_node.py`, `report_node.py`, `chat_node.py`
- [ ] `graph/build_graph.py` — full edge wiring, including which nodes to skip for simple queries

### Phase A12 — Service boundary
- [ ] `security/internal_auth.py`
- [ ] `internal_api/progress.py` — POST to Backend's `/internal/v1/progress`
- [ ] `internal_api/result.py` — POST to Backend's `/internal/v1/result`
- [ ] `api/entry.py` **(PROPOSED — §103 never names this path)** — receives `AnalysisExecutionRequest.json` from Backend
- [ ] `main.py` — FastAPI entrypoint, wires `api/entry.py` → `build_graph.py`

> **Checkpoint:** this is the first point the full Backend↔AI-Service round trip is real end-to-end (still fine to run agents against mocks from Phase A3).

### Phase A13 — Tests
- [ ] `tests/test_planner.py`, `test_weather_agent.py`, `test_ocean_agent.py`, `test_gis_agent.py`
- [ ] `tests/test_risk.py`, `test_decision.py`, `test_route.py`, `test_trend.py`, `test_report.py`, `test_chat.py`
- [ ] `tests/test_validation.py` — round-trips every `schemas/**/*.py` against `contracts/**/*.json`

---

## PART 3 — Frontend Delivery & Production Deployment (COMPLETED)

- [x] **React 19 + Vite Frontend**: High-contrast Sunlight Deck Mode, Web Speech API in 6 Indian languages, 9-point spatial matrix, XAI score waterfall.
- [x] **MongoDB Atlas Cloud Migration**: Seamless migration from local daemon to `Cluster0` replica set with 299 GIS layers and 230 INCOIS PFZ line features.
- [x] **1-Click Render Cloud Blueprint (`render.yaml`)**:
  - `orca-frontend` Static Site on Global Edge CDN
  - `orca-backend` Node.js Express API Gateway
  - `orca-ai-service` Python 3.11 FastAPI Multi-Agent Engine
- [x] **Contract Verification**: 15/15 Backend checks + 26/26 AI Service verification tests passing.

---

## PART 4 — Strategic Future Enterprise Roadmap & Final Target Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                 ORCA FINAL ENTERPRISE MARITIME ARCHITECTURE                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│               ┌──────────────────────────────────────────────┐              │
│               │   MULTI-STAKEHOLDER INTERFACE ECOSYSTEM      │              │
│               │  React 19 PWA · Deck Glare Mode · Voice Mic  │              │
│               │ 7 Activities: Tourism/Boating/Diving/Fishing │              │
│               └──────────────────────┬───────────────────────┘              │
│                                      │                                      │
│                                      ▼                                      │
│               ┌──────────────────────────────────────────────┐              │
│               │     KONG / CLOUDFLARE EDGE API GATEWAY       │              │
│               │    mTLS · Rate Limiting · Global Anycast     │              │
│               └──────────────────────┬───────────────────────┘              │
│                                      │                                      │
│        ┌─────────────────────────────┼─────────────────────────────┐        │
│        ▼                             ▼                             ▼        │
│  ┌───────────┐                 ┌───────────┐                 ┌───────────┐  │
│  │  Backend  │                 │  Kafka /  │                 │ AI Service│  │
│  │ Core API  │                 │   NATS    │                 │Multi-Agent│  │
│  │(Express 5)│                 │Event Mesh │                 │7 Telemetry│  │
│  └─────┬─────┘                 └─────┬─────┘                 └─────┬─────┘  │
│        │                             │                             │        │
│        │        ┌────────────────────┴────────────────────┐        │        │
│        ▼        ▼                                         ▼        ▼        │
│  ┌───────────────┐                                   ┌───────────────┐      │
│  │ MongoDB Atlas │                                   │  Edge AI Core │      │
│  │Cluster0 Multi-│                                   │Quantized PINNs│      │
│  │Region 2dsphere│                                   │Onboard Pi/Jet │      │
│  └───────────────┘                                   └───────────────┘      │
│        │                                                     │              │
│        ▼                                                     ▼              │
│  ┌───────────────────────────────────────────────────────────────────┐      │
│  │           NATIONAL MARITIME DEFENSE & RESCUE DISPATCH             │      │
│  │   Indian Coast Guard MRCC · INCOIS SAMUDRA · NDMA CAP Gateway     │      │
│  └───────────────────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Milestone 1: Multi-Activity Expansion & Offline PWA Tile Engine
- **Full Offline Operation**: Vector `.mbtiles` covering India's 7,516 km coastline cached via ServiceWorker and IndexedDB.
- **Deep Activity Profiles**: Custom mathematical risk formulations for high-speed tourism speedboats, SCUBA diver bottom times, and surfing break heights.

### Milestone 2: High-Throughput Telemetry Event Mesh (Apache Kafka)
- **100,000+ Concurrent Vessels**: Scaled event streaming ingesting real-time coordinates, speed, and heading from transponders across all Indian maritime zones.
- **Sub-Second Geofence Alarms**: Automated boundary intrusion detection triggering siren alerts before international boundary crossings.

### Milestone 3: Physics-Informed Neural Networks (PINNs) & Marine LLM
- **Nonlinear Wave Shoaling**: AI physics models predicting nearshore wave amplification and breaking over shallow coral reefs.
- **Domain Fine-Tuned Marine LLM (`ORCA-Marine-8B`)**: Hyper-localized nautical advisory generation in 6 Indian languages with strictly verified zero-hallucination bounds.

### Milestone 4: Edge On-Vessel Hardware Sensor Integration
- **Direct NMEA 0183 / 2000 Transducer Bridge**: Connects via Web Bluetooth/Serial to vessel depth sounders and anemometers.
- **Offline Wheelhouse Appliance**: Complete AI engine running on Raspberry Pi 5 / NVIDIA Jetson inside the vessel without cellular or satellite data.

### Milestone 5: National Emergency & Search-and-Rescue (SAR) Dispatch
- **Automated Distress Escalation**: Common Alerting Protocol (CAP) and SOS packet generation forwarded directly to Indian Coast Guard Maritime Rescue Coordination Centres (MRCC).

