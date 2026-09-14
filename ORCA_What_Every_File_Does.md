# ORCA — What Every File Does

One row per file, no file skipped. This is your map before we start writing code — when we build `analysis.service.js` next, you can come back here and see exactly where it sits and what touches it.

**Start with the Backend section** — that's what we're building first. AI Service is here too so nothing is missing, but it comes later.

---

## BACKEND — root

| File | What it does |
|---|---|
| `package.json` | Lists every npm package the backend needs (express, mongoose, ajv, dotenv...) and the commands to run it (`npm start`, `npm run dev`, `npm test`). The very first file you create. |
| `.env.example` | A template listing every secret/config value the app needs (`MONGO_URI`, `AI_SERVICE_URL`, `INTERNAL_SECRET`, `BHASHINI_KEY`...) with fake placeholder values. You copy this to a real `.env` file and fill in actual values — `.env` itself is never committed to git. |

## BACKEND — `src/` root

| File | What it does |
|---|---|
| `server.js` | The file you actually run to start the app. Starts the **public** web server (the one the Frontend talks to), listening on one port. |
| `internal-server.js` | Starts a **second**, separate web server on a different port — this one only understands `/internal/v1/...` calls from the AI Service. Kept apart from `server.js` so the public internet can never accidentally reach it. |
| `worker.js` | Not a web server at all — a background process that stays running and checks alert subscriptions on a timer (e.g. every 3 hours). |
| `app.js` | Builds the actual Express application: turns on JSON parsing, CORS, rate limiting, and plugs in every module's routes. Both `server.js` and `internal-server.js` use pieces of this. |

## BACKEND — `src/config/`

| File | What it does |
|---|---|
| `env.js` | Reads your `.env` file, checks nothing important is missing, and makes those values available to the rest of the app. |
| `limits.js` | A list of fixed numbers used everywhere — e.g. "warn when within 5km of a boundary", "grid radius is 5km by default". |
| `registry.js` | Loads `shared-config/activities.json`, `vessel-types.json`, `languages.json` once at startup so validators can check against them. |

## BACKEND — `src/db/`

| File | What it does |
|---|---|
| `connection.js` | Connects to your MongoDB database when the app starts. |
| `indexes.js` | Tells MongoDB which fields to index for speed (e.g. `analysis_id` must be unique, GIS layers need a geospatial index). |

### `src/db/models/` — one file per database table ("collection")

| File | Which real-world thing it stores | Matches this schema |
|---|---|---|
| `analysis.model.js` | Every analysis request and its result, start to finish | `contracts/db/AnalysesDocument.json` |
| `agentResult.model.js` | Raw output from each data agent (weather, ocean, gis...) | `contracts/AgentResult.json` |
| `riskResult.model.js` | Risk scores for all 9 points of an analysis | `contracts/db/RiskResultsDocument.json` |
| `decision.model.js` | The final recommendation for an analysis | `contracts/Decision.json` |
| `gisLayer.model.js` | Map boundary layers (EEZ, MPAs, ports...) | `contracts/db/GisLayerDocument.json` |
| `alertSubscription.model.js` | Who wants to be alerted about what | `contracts/api/AlertSubscriptionResponse.json` |
| `alertEvent.model.js` | A log of every alert that was checked/sent | `contracts/db/AlertEventDocument.json` |
| `geofenceEvent.model.js` | A log of every boundary check | `contracts/db/GeofenceEventDocument.json` |
| `conversation.model.js` | Chat history | `contracts/db/ConversationDocument.json` |
| `route.model.js` | Computed safe routes | `contracts/RouteResult.json` |
| `report.model.js` | Generated shareable advisories | `contracts/ReportContent.json` |
| `user.model.js` | User accounts and roles | `contracts/User.json` |

**A "model" file is always short** — it just describes the shape of one collection to Mongoose. This is usually the easiest kind of file to write.

## BACKEND — `src/modules/` (this is most of the actual work)

Each module = one folder = one feature area. Inside, the pattern repeats: **routes** (which URL goes where) → **controller** (reads the request, calls the service, sends the response) → **service** (the actual logic).

### `modules/analysis/` — the core feature

| File | What it does |
|---|---|
| `analysis.routes.js` | Declares the 3 URLs: `POST /analysis`, `GET /analysis/:id`, `GET /analysis/:id/status`. |
| `analysis.controller.js` | Handles the HTTP part — reads what the Frontend sent, calls `analysis.service.js`, sends the answer back. |
| `analysis.service.js` | The real logic: generate an `analysis_id`, save it to the database as "queued", tell the AI Service to start working on it. |
| `analysis.validator.js` | Checks the incoming request is well-formed (has a query/coordinate/place, valid lat/lon, etc.) before anything else happens. |
| `pointMerge.js` | When weather data and ocean data both come back for point P3, this matches them together by `point_id`. |
| `statusBuilder.js` | Builds the "how's it going" response for the polling endpoint. |
| `resultBuilder.js` | Builds the final full-result response once everything is done. |

### `modules/internal/` — receiving from the AI Service

| File | What it does |
|---|---|
| `internal.routes.js` | Declares `POST /internal/v1/progress` and `POST /internal/v1/result` — only the AI Service calls these. |
| `progress.controller.js` | Saves "agent X just finished" updates as they arrive. |
| `result.controller.js` | Saves the final answer once the whole AI pipeline is done. |

### `modules/chat/`

| File | What it does |
|---|---|
| `chat.routes.js` | `POST /chat/message`, `GET /chat/:id`, `GET /chat/:id/history`. |
| `chat.controller.js` | HTTP handling. |
| `chat.service.js` | Decides: can this be answered from what we already know, or do we need to ask the AI Service to do new work? |
| `contextBuilder.js` | Packages up "here's what we already found out" to send along with a chat question. |
| `conversationHistory.controller.js` | Handles the two "get past messages" endpoints. |

### `modules/geofence/`

| File | What it does |
|---|---|
| `geofence.routes.js` | `POST /geofence/check`. |
| `geofence.controller.js` | HTTP handling. |
| `geofence.service.js` | The actual "is this GPS point near a restricted zone" math — pure database geometry query, no AI involved. |
| `dedup.js` | Don't send the same warning twice within a few minutes. |
| `auditLogger.js` | Saves a record of every check for later review. |

### `modules/map/`

| File | What it does |
|---|---|
| `map.routes.js` | `GET /map/layers`. |
| `map.controller.js` | Fetches boundary layers from the database and sends them to the map. |

### `modules/route/`

| File | What it does |
|---|---|
| `route.routes.js` | `POST /route`, `GET /route/:id`. |
| `route.controller.js` | HTTP handling. |
| `route.service.js` | Asks the AI Service to compute a route, saves the result. |

### `modules/trend/`

| File | What it does |
|---|---|
| `trend.routes.js` | `POST /trend`. |
| `trend.controller.js` | HTTP handling. |
| `trend.service.js` | Asks the AI Service for historical analysis. |

### `modules/report/`

| File | What it does |
|---|---|
| `report.routes.js` | `GET /report/:analysis_id`. |
| `report.controller.js` | HTTP handling. |
| `report.service.js` | Fetches or generates a shareable advisory. |

### `modules/alerts/`

| File | What it does |
|---|---|
| `subscriptions.routes.js` | Create/read/update/delete alert subscriptions. |
| `subscriptions.controller.js` | HTTP handling. |
| `subscriptions.service.js` | Saves/reads subscriptions in the database. |
| `scheduler.js` | Only runs inside `worker.js` — periodically checks every subscription's conditions. |
| `dedup.js` | Only re-send an alert if things got worse since last time. |
| `eventLogger.js` | Records every alert check, sent or not. |
| `delivery/webPush.js` | Actually sends the browser push notification. |

### `modules/voice/`

| File | What it does |
|---|---|
| `voice.routes.js` | `POST /voice/query`. |
| `voice.controller.js` | HTTP handling. |
| `voice.service.js` | Sends audio to Bhashini for speech-to-text, then runs it through the same pipeline as a normal chat message. |

### `modules/auth/` — *(not in the original spec, added because `users` needs somewhere to live)*

| File | What it does |
|---|---|
| `auth.routes.js` | Proposed — login/register-style endpoints. |
| `auth.controller.js` | Proposed. |
| `user.service.js` | Proposed — reads/writes user accounts. |
| `inviteCode.js` | Checks an invite code is valid and assigns the matching role. |

## BACKEND — `src/clients/` (talking to the outside world)

| File | What it does |
|---|---|
| `aiService.client.js` | The only file that sends requests to the AI Service. |
| `bhashini.client.js` | The only file that talks to the Bhashini voice service. |

## BACKEND — `src/middleware/` (runs on every request, in order)

| File | What it does |
|---|---|
| `internalAuth.js` | Blocks anyone without the correct secret from hitting `/internal/v1/...`. |
| `roleGuard.js` | Blocks users from accessing routes their role doesn't allow. |
| `rateLimit.js` | Stops one person from spamming the API. |
| `cors.js` | Controls which websites are allowed to call this API from a browser. |
| `sanitize.js` | Cleans up free-text input before it's used anywhere risky. |
| `validateContract.js` | Checks incoming/outgoing data actually matches the JSON schema it's supposed to. **This is the file that enforces everything we spent all that time building.** |
| `errorHandler.js` | Catches any error from anywhere in the app and turns it into a proper error response. |

## BACKEND — `src/errors/`

| File | What it does |
|---|---|
| `errorCategories.js` | The list of possible error types, matching `shared/ErrorInfo.json`. |
| `httpStatus.js` | Maps each error type to the right HTTP status code (404, 422, 500...). |

## BACKEND — `src/i18n/templates/`

| File | What it does |
|---|---|
| `geofenceWarnings.json` | Pre-written warning messages in every supported language. |
| `alertMessages.json` | Pre-written alert messages in every supported language. |

## BACKEND — `src/observability/`

| File | What it does |
|---|---|
| `logger.js` | Prints logs to the console/file, hiding secrets automatically. |
| `trace.js` | Records the step-by-step history of what happened during one analysis. |

## BACKEND — `src/utils/`

| File | What it does |
|---|---|
| `ids.js` | Generates a new `analysis_id` in the agreed format. |
| `time.js` | Helper functions for converting between local time and UTC. |

## BACKEND — `scripts/` (run manually, not part of the running app)

| File | What it does |
|---|---|
| `seed-gis-layers.js` | One-time script: downloads and saves boundary map layers. |
| `seed-ports.js` | One-time script: adds ~40 Indian harbours to the database. |
| `create-indexes.js` | One-time script: sets up database indexes. |
| `validate-schemas.js` | Checks every schema file itself is valid — run this in CI. |

## BACKEND — `tests/`

| File | What it does |
|---|---|
| `unit/*.test.js` | Tests for small individual functions. |
| `integration/*.test.js` | Tests that run a real request through the whole app. |
| `contract/everyResponse.test.js` | Confirms real responses actually match the schema files. |

**Backend total: 79 files.**

---

## AI SERVICE (Python) — for later, listed here for completeness

| File | What it does |
|---|---|
| `main.py` | Starts the Python web server (FastAPI). |
| `api/entry.py` | *(proposed)* Receives the request from the Backend and kicks off the whole AI pipeline. |

### `graph/` — wiring the pipeline together

| File | What it does |
|---|---|
| `state.py` | Defines what information gets passed from step to step as the pipeline runs. |
| `build_graph.py` | Connects all the steps in order (Planner → Agents → Risk → Decision), including which steps to skip for simple questions. |
| `nodes/planner_node.py` | Pipeline step wrapper for the Planner. |
| `nodes/risk_node.py` | Pipeline step wrapper for Risk scoring. |
| `nodes/decision_node.py` | Pipeline step wrapper for the Decision. |
| `nodes/route_node.py` | Pipeline step wrapper for route planning. |
| `nodes/trend_node.py` | Pipeline step wrapper for trend analysis. |
| `nodes/report_node.py` | Pipeline step wrapper for report generation. |
| `nodes/chat_node.py` | Pipeline step wrapper for chat. |

### `planner/`

| File | What it does |
|---|---|
| `planner_llm.py` | Asks the AI model to decide intent, which agents to run, and why. |
| `language_detector.py` | Figures out what language the question was asked in. |
| `intent_classifier.py` | Figures out what kind of question it is (safety check, route, trend...). |
| `geocoder.py` | Turns a place name into coordinates. |
| `land_sea_mask.py` | Checks if a coordinate is on land or in the sea. |
| `offshore_snapping.py` | Moves a land coordinate to the nearest valid sea point. |
| `time_parser.py` | Turns "tomorrow morning" into an actual date/time range. |
| `spatial_sampling.py` | Generates the 9-point grid around the center location. |

### `agents/` — one file per data source type

| File | What it does |
|---|---|
| `weather_agent.py` | Fetches wind, rain, visibility, etc. |
| `ocean_agent.py` | Fetches waves, tide, temperature, salinity. |
| `tide_agent.py` | Fetches tide times and levels. |
| `cyclone_agent.py` | Fetches cyclone and official warnings. |
| `ecosystem_agent.py` | Fetches chlorophyll, oxygen levels. |
| `pfz_agent.py` | Fetches potential fishing zone advisories. |
| `gis_agent.py` | Fetches boundary/restriction info. |

### `adapters/` — translating each real data source into ORCA's common format

| File | What it does |
|---|---|
| `weather/imd_adapter.py` | Converts IMD's raw format into ORCA's standard fields. |
| `weather/open_meteo_adapter.py` | Same, for the Open-Meteo fallback. |
| `ocean/incois_osf_adapter.py` | Converts INCOIS's raw format. |
| `ocean/copernicus_adapter.py` | Converts Copernicus fallback data. |
| `ecosystem_mosdac_adapter.py` | Converts MOSDAC satellite data. |
| `gis_bhuvan_adapter.py` | Converts Bhuvan/Bhoonidhi map data. |
| `pfz_incois_adapter.py` | Converts INCOIS fishing zone advisories. |
| `mock/mock_weather.py`, `mock_ocean.py`, `mock_gis.py`, `mock_pfz.py`, `mock_ecosystem.py` | Fake versions of each adapter, used for demos so you don't need real API access to show the system working. |

### `risk/`

| File | What it does |
|---|---|
| `baseline.py` | The math that turns raw weather/ocean numbers into a 0-100 risk score. |
| `official_warning_override.py` | Forces the score up if an official warning applies. |
| `hard_rules.py` | Forces the score up if a hard safety rule is triggered. |
| `risk_llm.py` | Lets the AI explain the score and make a small (±10) adjustment. |
| `risk_validator.py` | Double-checks the AI's output is actually valid before trusting it. |

### `decision/`

| File | What it does |
|---|---|
| `point_selector.py` | Picks the safest allowed point, excluding dangerous/restricted ones. |
| `best_time.py` | Works out the safest time window. |
| `decision_llm.py` | Writes the actual recommendation text. |
| `decision_validator.py` | Checks the AI's decision output is valid. |

### `route/`

| File | What it does |
|---|---|
| `cost_grid.py` | Builds a map of "cost" to cross each area (distance + risk). |
| `pathfinder.py` | Finds the cheapest safe path across that map. |

### `trend/`

| File | What it does |
|---|---|
| `anomaly_calc.py` | Calculates monthly averages and how unusual recent data is. |
| `trend_llm.py` | Explains the trend in plain language. |

### `report/`, `visualization/`, `chat/`, `data_discovery/`

| File | What it does |
|---|---|
| `report/report_agent.py` | Builds the shareable advisory document. |
| `visualization/viz_spec_builder.py` | Decides how results should be shown (map/chart/route). |
| `chat/chat_agent.py` | Handles chat conversation. |
| `chat/followup_decider.py` | Decides if a follow-up question needs new data or can reuse what's already known. |
| `data_discovery/data_catalog.py` | The list of what data comes from where. |
| `data_discovery/data_plan_builder.py` | Decides which sources to actually use for this request. |

### `registry/`, `prompts/`, `config/`

| File | What it does |
|---|---|
| `registry/agent_registry.yaml` | The master list of every agent and what it can do (not code — a config file). |
| `registry/registry_loader.py` | Reads that config file. |
| `prompts/*.md` (6 files) | The actual instructions given to each AI step — kept as plain text so they're easy to edit without touching code. |
| `config/risk_thresholds.yaml` | The actual numbers used for risk scoring per vessel type. |
| `config/official_warning_rules.yaml` | Which warnings force which minimum score. |
| `config/gis_constraints.yaml` | Which zones are prohibited vs just a warning. |
| `config/vessel_profiles.yaml` | Safety thresholds per vessel type. |

### `schemas/` — 44 files, all auto-generated, never hand-written

Every file in here is created automatically by running `contracts/generate.sh` — one Python file per JSON schema file, in the same folder shape (`shared/`, `api/`, `db/`). You never write or edit these by hand; if a schema changes, you re-run the script.

### `internal_api/`, `security/`

| File | What it does |
|---|---|
| `internal_api/progress.py` | Sends "still working" updates back to the Backend. |
| `internal_api/result.py` | Sends the final answer back to the Backend. |
| `security/internal_auth.py` | Proves to the Backend this request really came from the AI Service. |

### `tests/`

11 files, one per major piece (planner, each agent, risk, decision, route, trend, report, chat, and a validation round-trip test).

**AI Service total: 105 files (44 generated + 61 hand-written).**

---

## Where we're headed next

Your very next step is going to be, in this order:
1. `package.json` — set up the project
2. `.env` — your local secrets
3. `src/db/connection.js` — connect to MongoDB
4. `src/db/models/analysis.model.js` — your first model
5. `src/modules/analysis/` — your first real feature

We'll write these one at a time, and you'll run each one before moving to the next so you actually see it working.
