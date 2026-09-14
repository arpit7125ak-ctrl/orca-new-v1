# ORCA — SIH26176 Detailed System Architecture & Feature Specification

## Marine EcOsystem Reasoning with Collaborative Agents

**Problem Statement ID:** 26176
**Organization:** Indian Space Research Organisation (ISRO)
**Theme:** Space Technology
**Document Revision:** 2.0 — Consolidated Final

---

# 1. Purpose

This document defines the consolidated ORCA system architecture for SIH26176.

It merges the original architecture with every later improvement into one consistent specification.

Where older text conflicted with newer decisions, the older text has been rewritten instead of being left beside an addendum.

The architecture is strictly based on three major parts:

1. **Frontend**
2. **Backend**
3. **AI Service**

The core execution flow is preserved:

**User → Frontend → Backend → Planner/Orchestrator → Selected Agents → Risk Agent → Decision Agent → Backend → Frontend**

The flow is now **intent-aware**.

A simple information request such as "What is the tide tomorrow?" runs only the minimum sufficient part of the flow.

A safety request runs the complete Planner → Agents → Risk → Decision pipeline.

The architecture is intentionally generalized so future agents, data fields, data sources, activities, vessel types, languages, sampling algorithms, features and user capabilities can be added without redesigning the complete system.

---

# 2. Three Major Parts

ORCA has exactly three major parts.

Every capability — alerts, geofencing, routing, voice, reports, charts and trends — lives inside one of these three parts.

No fourth architectural part is created.

| Part | Core Role | Summary |
|---|---|---|
| Frontend | User-facing application | Collect → Display → Interact |
| Backend | Gateway and system-of-record | Receive → Validate → Persist → Track → Serve |
| AI Service | Multi-agent intelligence | Detect → Plan → Select → Fetch → Calculate → Reason → Validate → Decide |

---

## 2.1 Frontend

The Frontend is the user-facing application.

It is a mobile-friendly, PWA-capable web application.

### 2.1.1 User Inputs

The user can provide:

- Natural-language query (typed or spoken)
- Coordinates
- Place name
- Date
- Time range
- Activity
- Vessel type
- Origin and destination (when route planning is requested)
- Optional language override
- Future optional parameters

Most structured fields are optional.

A single natural-language query is enough.

Example:

> "kal subah Chennai ke paas fishing safe hai kya?"

From this query the AI Service extracts:

- Location — Chennai
- Time — tomorrow morning
- Activity — fishing
- Language — Hindi (Romanized, code-mixed)

If the user also fills structured form fields, the structured values take precedence over values extracted from text.

### 2.1.2 Automatic Language Detection

The user is **not required to select a language**.

ORCA automatically detects the language from the query text.

The language selector remains available only as an explicit **override**.

Detection supports:

- English
- Indian languages in native script
- Romanized Indian languages
- Hinglish / Tanglish / other code-mixed text
- Mixed-language queries

The detected language and any override are stored with the analysis and reused by:

- Chat
- Decision output
- Reports
- Alerts
- Voice output

Details are defined in Section 11.

### 2.1.3 What the Frontend Displays

The Frontend displays:

- Interpreted request summary (location used, time window, activity, vessel, language)
- Analysis progress
- Selected agent status with the Planner's selection reason
- Nine analysis points, or intent-appropriate spatial results
- Interactive map
- Agent data
- Risk score for every applicable point
- Risk reasoning
- Key findings
- GIS information and restrictions
- PFZ/fishing information
- Ecosystem information
- Official warnings
- Final recommendation (detailed and one-line)
- Recommended safer time windows
- Hourly charts where available
- Route where requested
- Trend charts where requested
- Data quality
- Confidence
- Evidence and sources
- Shareable advisory report
- Geofence warnings
- Alert notifications
- Chatbot

### 2.1.4 Frontend Rules

The Frontend communicates **only with the Backend**.

It must never directly communicate with:

- AI Service
- LLM providers
- Bhashini or any speech/translation service requiring credentials
- External data providers

The Frontend does not:

- Decide which agents run
- Classify intent
- Calculate risk
- Decide geofence status
- Compute routes

It renders what the Backend returns.

---

# 3. Backend

The Backend is the central gateway and system-of-record.

## 3.1 Backend Responsibilities

1. Receive the user's analysis, chat, route, voice and alert requests.
2. Perform structural validation of the input.
3. Create a unique `analysis_id`.
4. Create the MongoDB analysis record.
5. Send the request to the AI Service.
6. Receive progress updates from the AI Service.
7. Store individual agent results.
8. Store selected agents, selection reasons and execution status.
9. Match agent data using `point_id`.
10. Merge point-level data.
11. Preserve future/unknown agent fields.
12. Store the final Decision Agent response.
13. Track the analysis lifecycle.
14. Handle errors and partial failures.
15. Protect internal AI Service endpoints.
16. Provide versioned APIs to the Frontend.
17. Store chatbot conversations.
18. Provide analysis context to the chatbot.
19. Maintain alert subscriptions and trigger scheduled alert checks.
20. Deduplicate and deliver alert notifications.
21. Provide a lightweight live-GPS geofence endpoint using deterministic spatial geometry.
22. Store and serve GIS reference layers with geospatial indexes.
23. Serve route-planning requests and results.
24. Serve hourly chart data and trend data.
25. Serve shareable advisory reports.
26. Proxy voice requests to the speech service using server-side credentials.
27. Preserve interpreted time windows in both local time and UTC.
28. Preserve original and snapped locations.

## 3.2 Backend Does NOT

- Calculate risk scores.
- Decide whether a location is safe for an activity.
- Generate the final recommendation.
- Replace the Risk Agent.
- Replace the Decision Agent.
- Compute routes.
- Classify intent or select agents.
- Expose LLM, Bhashini, data-provider or database credentials to the Frontend.

## 3.3 Deterministic Checks vs Safety Judgement

Two Backend functions may look like decisions but are not safety judgements:

### Live Geofencing

The Backend checks whether a GPS position is inside or near a boundary polygon.

This is pure geometry.

It answers:

> "Is this point inside or within X km of a restricted polygon?"

It does not answer:

> "Is it safe to be here?"

### Alerts

The Backend scheduler only **triggers** alert checks and **delivers** results.

The alert decision itself is produced by the AI Service using official warnings, hard safety rules and the risk pipeline.

In simple terms:

**Backend receives → validates → sends → receives → stores → serves.**

---

# 4. AI Service

The AI Service contains the intelligent multi-agent pipeline.

## 4.1 AI Service Responsibilities

1. Receive the analysis request from Backend.
2. Detect or confirm the query language.
3. Classify the request intent.
4. Execute the Planner/Orchestrator.
5. Resolve and validate the actual location.
6. Snap valid coastal places to a suitable offshore point when required.
7. Interpret date and time into an explicit window.
8. Select the appropriate spatial sampling mode.
9. Generate the nine-point grid when local analysis is required.
10. Discover required data and sources.
11. Use the Planner LLM to select required agents.
12. Execute only selected agents.
13. Execute independent selected agents in parallel.
14. Send progress and data to Backend.
15. Calculate a deterministic safety baseline for safety requests.
16. Apply official-warning overrides and hard safety rules.
17. Use the Risk Agent LLM for controlled, bounded interpretation.
18. Validate every structured LLM output against a schema.
19. Send Risk + GIS + PFZ + Ecosystem data to the Decision Agent when a decision stage is required.
20. Apply GIS hard constraints during point selection.
21. Calculate best-time windows from hourly data.
22. Run Trend, Route, Report and Visualization capabilities when the intent requires them.
23. Evaluate alert checks requested by the Backend scheduler.
24. Generate the final recommendation using the Decision Agent LLM when required.
25. Produce output in the response language.
26. Send the final result to Backend.

## 4.2 AI Service Components

| Component | Type | Role |
|---|---|---|
| Planner / Orchestrator | LLM + Python tools | Language, intent, location, time, sampling, agent selection |
| Weather Agent | Data agent | Weather parameters and warnings |
| Ocean Agent | Data agent | Waves, currents, SST, salinity |
| Tide Agent | Data agent | Tide levels and times |
| Cyclone Agent | Data agent | Cyclones and official marine warnings |
| Ecosystem Agent | Data agent | Chlorophyll, oxygen, nutrients, sensitivity |
| Fishing/PFZ Agent | Data agent | Potential Fishing Zone evidence |
| GIS Agent | Data agent | Boundaries, MPAs, depth, ports, restrictions |
| Data Discovery | Capability | Dataset catalog and source selection |
| Risk Agent | Deterministic + LLM | Safety scoring per point |
| Decision Agent | LLM + rules | Final recommendation |
| Trend Agent | Calculation + LLM | Historical analysis and anomalies |
| Route Tool | Deterministic | Safe route pathfinding |
| Report Agent | LLM + template | Shareable marine advisory |
| Visualization | Capability | Chooses map/chart/route/trend presentation |
| User Interaction (Chat) Agent | LLM | Conversation, context, follow-ups |

All of these are internal to the AI Service.

They are registered in the Agent Registry (Section 22).

---

# 5. Complete Analysis Flow

The complete analysis lifecycle is intent-driven.

**User**

↓

**Frontend**

↓

**Backend — structural validation**

↓

**Create `analysis_id` + MongoDB record**

↓

**AI Service**

↓

**Planner / Orchestrator**

↓

**Automatic Language Detection**

↓

**Intent Classification**

↓

**Location Resolution and Validation**

↓

**If invalid → stop + 422 error**

↓

**If valid coastal place on land → offshore snapping**

↓

**Time Interpretation (local + UTC)**

↓

**Select Local / Regional / Route / Historical Sampling**

↓

**Python Spatial Sampling Tool**

↓

**Land points marked `not_applicable`**

↓

**Data Discovery**

↓

**Planner LLM — select agents with reasons**

↓

**Plan validation**

↓

**Run only selected agents**

↓

**Parallel independent agent execution**

↓

**Agent status/data → Backend → Frontend**

↓

**Intent-specific stage:**

- **Quick Information** → validated information result
- **Point Safety / Regional** → Risk (Official Warning → Hard Rules → Baseline → Bounded LLM) → Decision (GIS hard constraints)
- **Route** → Risk-cost grid → Route Tool → Decision/explanation
- **Historical/Trend** → Trend calculations → explanation
- **Report** → Report Agent

↓

**Schema validation of outputs**

↓

**Backend**

↓

**MongoDB**

↓

**Frontend Dashboard / Chat / Map / Charts / Route / Report**

---

# 6. Stage 1 — User Input

The user enters any combination of:

- Natural-language query
- Coordinate OR place name
- Date
- Time range
- Activity
- Vessel type
- Origin/destination
- Optional language override

Examples of different intents:

> "Is fishing safe near Chennai tomorrow morning and which point is safest?"

> "What is the tide at Paradip tomorrow?"

> "Where is the nearest PFZ today?"

> "Safest route from Kochi harbour to the PFZ for a motorized boat?"

> "Why has fish catch reduced near Ratnagiri this year?"

> "कल सुबह विशाखापत्तनम के पास समुद्र में जाना सुरक्षित है?"

The Frontend sends the request to the Backend.

The Frontend does not decide:

- Language
- Intent
- Which agents run

---

# 7. Stage 2 — Backend Validation

The Backend performs **structural validation** before sending the request to the AI Service.

Semantic validation (marine applicability, land/sea, supported region) is done by the Planner.

## 7.1 Minimum Input

At least one of these must exist:

- Non-empty query
- Coordinate
- Place name

Otherwise the Backend returns **400 — Bad Request**.

## 7.2 Coordinate Validation

If coordinates are supplied:

- Latitude must be numeric.
- Latitude must be between -90 and +90.
- Longitude must be numeric.
- Longitude must be between -180 and +180.

## 7.3 Place Name

If a place name is provided:

- It must not be empty.
- It must be within a configured maximum length.
- It is passed to the Planner's location-resolution stage.

## 7.4 Date

If an explicit date is supplied, validate:

- Format (ISO 8601)
- Usability
- Supported forecast or historical data period

Natural-language dates inside the query ("tomorrow") are interpreted by the Planner (Section 14).

## 7.5 Time Range

If an explicit time range is supplied, validate:

- Start time
- End time
- Valid time format
- Start must not be later than end, except for configured overnight windows

## 7.6 Activity

Activities are configuration-driven.

Examples:

- Fishing
- Boating
- Marine research
- Diving
- Surfing
- Tourism
- Shipping/transport

An unknown activity value returns **400**.

More activities can be added in configuration later.

## 7.7 Vessel Type

Vessel type must be captured when safety is relevant, because safe environmental limits differ by vessel.

Vessel types are configuration-driven.

Examples:

- Traditional non-motorized craft
- Motorized country craft (outboard engine)
- Mechanized fishing vessel (trawler/gillnetter)
- Recreational/tourism boat
- Research vessel
- Large commercial vessel

If vessel type is missing for a safety request, the Planner applies the most conservative configured vessel profile for the activity and states this assumption in the result.

## 7.8 Language Override

Language is detected automatically.

If the user supplies an override, it must be a supported language code.

Supported languages remain configurable.

Initial list:

- English
- Hindi
- Bengali
- Tamil
- Telugu
- Odia
- Marathi
- Malayalam
- Kannada
- Gujarati

## 7.9 Origin and Destination

For route requests:

- Both origin and destination must exist.
- Each must be a valid coordinate or non-empty place name.

## 7.10 What the Backend Does Not Validate

The Backend does not decide:

- Whether a place is marine or land
- Whether a region is supported
- Whether a coastal place should be snapped
- What "tomorrow morning" means

These belong to the Planner.

---

# 8. Analysis ID

Backend creates a unique `analysis_id`.

## 8.1 Format

`req_{YYYYMMDD}_{HHMM}_{hash6}`

The date/time embedded is the **request-receipt time** (when the Backend accepts the request), not the target analysis window. This is deliberate: for natural-language requests ("tomorrow morning"), the target window is often unresolved at the moment the Backend must assign an ID — only the Planner resolves it later. Using receipt time avoids that dependency.

Example: `req_20260912_0915_f4e9d1`

The `analysis_id` identifies the complete analysis lifecycle.

It is used by:

- Backend
- AI Service
- Agent progress messages
- MongoDB
- Frontend polling
- Final result
- Chatbot context
- Reports
- Logs
- Debugging

Related analyses are linked with:

- `conversation_id` — the chat conversation the analysis belongs to
- `parent_analysis_id` — the earlier analysis a follow-up or scenario was derived from
- `alert_subscription_id` — when the analysis was triggered by the alert scheduler

Every result must be traceable to its analysis.

---

# 9. Analysis Lifecycle States

Recommended analysis states:

- `queued`
- `running`
- `completed`
- `partial`
- `failed`

## queued

Analysis accepted but processing has not started.

## running

AI Service is processing.

## completed

The pipeline required by the classified intent completed successfully.

## partial

A usable result exists, but one or more selected data sources/agents returned incomplete results.

## failed

The analysis could not produce a usable result.

Every `failed` analysis stores an `error_category`:

- `invalid_location`
- `unsupported_region`
- `unresolvable_place`
- `unsupported_time`
- `planner_failure`
- `risk_failure`
- `validation_failure`
- `upstream_unavailable`
- `timeout`
- `internal_error`

---

# 10. Planner / Orchestrator Agent

The Planner/Orchestrator is the first intelligent component.

Every request — dashboard analysis, chat message, route request or scheduled alert check — enters the AI Service through the Planner.

It performs these jobs:

1. Detect or confirm the language.
2. Classify the intent.
3. Resolve and validate the location.
4. Interpret the date and time.
5. Select the sampling mode and generate points.
6. Discover required data.
7. Select the required agents and capabilities.
8. Produce a validated execution plan.

The Planner contains:

- LLM (a fast, low-latency model)
- Editable system prompt
- Python tools:
  - Language detector
  - Geocoder
  - Land/sea mask
  - Offshore snapping tool
  - Spatial sampling tool
  - Time-expression parser
- Agent Registry access
- Data Catalog access
- Configuration

Deterministic tools are used wherever possible.

The LLM is used for interpretation and selection, not for mathematics or geometry.

The Planner system prompt is stored separately from application code so it can be changed easily.

---

# 11. Automatic Language Detection

The problem statement requires ORCA to automatically identify the language of the query and respond in the same language.

## 11.1 Detection Steps

1. Detect script (Latin, Devanagari, Tamil, Bengali, etc.).
2. Run a language-identification model that supports native and Romanized Indian languages (for example, an IndicLID-class model).
3. If the text is code-mixed or confidence is low, use the Planner LLM as a secondary check.
4. Apply the user's override if one exists.

## 11.2 Output Fields

- `detected_language`
- `script`
- `is_romanized`
- `is_code_mixed`
- `detection_confidence`
- `override_language`
- `response_language`

## 11.3 Rules

- `response_language` = override if present, otherwise detected language.
- In a conversation, a low-confidence message keeps the previous `response_language`.
- For a first message with low confidence, respond in English and offer the detected alternative.
- Scientific values, units and point IDs remain language-independent.
- All user-facing text (recommendation, findings, chat, alerts, reports, voice) uses `response_language`.

---

# 12. Intent Classification and Pipeline Routing

The Planner classifies the request before selecting agents.

Intent decides the sampling mode, agents, Risk stage, Decision stage and output type.

This prevents simple queries from triggering the full expensive pipeline.

## 12.1 Intents

| Intent | Example | Sampling | Risk | Decision | Main Output |
|---|---|---|---|---|---|
| `quick_information` | "What is the tide tomorrow?" | Single point (P0) | No | No | Focused answer + chart |
| `point_safety` | "Is fishing safe tomorrow morning?" | Local nine-point grid | Yes | Yes | Scores + recommendation |
| `regional_search` | "Where is the nearest PFZ?" / "Which regions show high chlorophyll?" | Regional scan | Optional | Yes | Map of ranked zones |
| `route_planning` | "Safest route to the PFZ?" | Route corridor | Yes (as cost) | Explanation | Route + advisory |
| `historical_trend` | "Why has fish productivity declined?" | Historical sampling | No | Explanation | Trend charts + explanation |
| `alert_check` | "Any cyclone or lightning alerts in my area?" | Local or regional | Warning rules | Short | Alert status |
| `report_advisory` | "Give me an advisory I can share" | Uses existing analysis | Reuse | Reuse | Advisory document |
| `conversational_followup` | "Why is P3 unsafe?" | None or re-plan | Reuse or rerun | Reuse or rerun | Chat answer |

## 12.2 Compound Requests

A query can contain more than one intent.

Example:

> "Is it safe to go out tomorrow and where is the PFZ?"

The Planner produces:

- `primary_intent` = `point_safety`
- `secondary_intents` = [`regional_search`]

The execution plan merges the requirements of both.

## 12.3 Ambiguous Requests

If a required parameter cannot be resolved (for example, no location in query, form or conversation), the Planner returns a clarification request through Chat instead of guessing.

---

# 13. Location Resolution and Validation

The Planner validates the actual analysis location before expensive agent execution.

## 13.1 Resolution

The location can come from:

- Coordinates
- Place names (Chennai, Paradip, Kochi)
- Ports and harbours
- Coastal landmarks
- Previous conversation context
- Live GPS (for geofence and alerts)

Ambiguous place names (for example, a name that exists in two states) trigger a clarification question.

## 13.2 Validation Checks

- Coordinate validity
- Place resolution success
- Marine applicability
- Supported geographic region (configurable geofence of ORCA's service area)
- Land/sea distinction using a land/sea mask
- Minimum depth for marine analysis (configurable)

## 13.3 Coastal Place Snapping

A coastal place such as Chennai may resolve to a land coordinate in the city centre.

If the place itself is a valid coastal analysis location, ORCA does not reject it.

Instead:

1. Find the nearest suitable offshore point.
2. Respect configurable limits:
   - `SNAP_OFFSHORE_KM` (for example 3 km from the coastline)
   - `SNAP_MAX_SEARCH_KM` (for example 25 km)
   - Minimum depth
3. Use the snapped point as the analysis centre.
4. Store both `original_location` and `snapped_location`.
5. Tell the user clearly.

Example:

> "Chennai resolves to a land location. The analysis uses the nearest offshore point, 3.1 km east of Marina Beach (13.05°N, 80.31°E)."

## 13.4 Land Points Inside a Valid Grid

A valid marine grid can contain points that fall on land (for example, near a coastline or island).

Such points are:

- Marked `point_status = not_applicable`
- Excluded from marine agents
- Excluded from risk scoring
- Shown on the map as land points

They do **not** fail the analysis.

## 13.5 Invalid Location

If the coordinate or place is genuinely invalid, unsupported or unresolvable:

**The execution flow stops.**

The system does not invoke:

- Weather Agent
- Ocean Agent
- Tide Agent
- Cyclone Agent
- Ecosystem Agent
- Fishing/PFZ Agent
- GIS Agent

Backend receives the error.

Frontend displays the reason in the response language.

Recommended semantic error:

**422 — Invalid or unsupported analysis location**

Example:

> "The provided location could not be validated as a supported marine analysis location."

---

# 14. Time Interpretation

Expressions such as "tomorrow morning" must be converted to an explicit window.

## 14.1 Default Time Buckets

Configurable defaults:

| Expression | Local Window |
|---|---|
| Early morning / dawn | 04:00–07:00 |
| Morning | 05:00–11:00 |
| Afternoon | 12:00–16:00 |
| Evening | 16:00–19:00 |
| Night | 19:00–04:00 (next day) |
| Today | Now → 23:59 |
| Tomorrow | 00:00–23:59 next day |

## 14.2 Rules

- Use the timezone of the analysis location (IST for Indian waters).
- Store the window in both local time and UTC.
- Echo the interpreted window to the user.

Example:

> "Interpreted as 12 Sep 2026, 05:00–11:00 IST (11 Sep 2026, 23:30 – 12 Sep 2026, 05:30 UTC)."

- If the window is beyond the supported forecast horizon, say so. Never extrapolate forecast data.
- If the requested time is in the past, route to `historical_trend` or explain that forecasts are not available for past periods.
- If no time is given, use the current time plus a configurable default horizon (for example, next 12 hours).

---

# 15. Spatial Sampling Tool — Nine-Point Grid

After successful location validation, the Planner invokes an independent Python sampling tool.

For `point_safety`, the default mode generates **nine points**.

The **validated analysis coordinate** is the centre.

The validated coordinate is:

- The input coordinate, if it was valid marine
- The snapped offshore coordinate, if snapping occurred

Current structure:

- P0 — Centre
- P1 — North
- P2 — North-East
- P3 — East
- P4 — South-East
- P5 — South
- P6 — South-West
- P7 — West
- P8 — North-West

Layout:

```
P8   P1   P2
P7   P0   P3
P6   P5   P4
```

The surrounding points are generated according to a configurable kilometre variable.

For example:

`GRID_RADIUS_KM = 5`

can later be changed to:

`GRID_RADIUS_KM = 10`

without redesigning the system.

`GRID_SHAPE` decides whether diagonal points lie on the same radius (circular) or at the square grid corners (square).

## 15.1 Sampling Tool Output

For every point:

- `point_id`
- Latitude
- Longitude
- Bearing from centre
- Distance from centre (km)
- `point_status` (`applicable` / `not_applicable`)
- Land/sea flag

The Planner LLM does not contain the mathematical implementation of grid generation.

---

# 16. Intent-Aware Sampling Modes

The nine-point grid remains the default local safety mode.

Other intents use other sampling modes.

| Mode | Used For | Default Behaviour |
|---|---|---|
| Single point | `quick_information` | P0 only |
| Local grid | `point_safety`, `alert_check` | Nine points, `GRID_RADIUS_KM` |
| Regional scan | `regional_search`, PFZ/ecosystem search | Wider configurable grid (for example 60 km radius, 10 km spacing) because PFZs and chlorophyll patterns extend tens of kilometres |
| Route corridor | `route_planning` | Grid covering origin, destination and a configurable buffer |
| Historical | `historical_trend` | Same fixed points across all historical periods for consistent comparison |

All counts, radii, spacings and shapes remain configurable.

---

# 17. Future Sampling Flexibility

Nine points are the current local implementation.

The architecture allows future changes to:

- Number of points
- Grid shape
- Radius
- Sampling distance
- Sampling algorithm
- Point distribution
- Activity-specific sampling
- Adaptive sampling

Possible future algorithms:

- 3×3 grid
- 5×5 grid
- Circular sampling
- Adaptive hazard-based sampling
- PFZ-focused sampling
- Route-based sampling

## 17.1 Generic Point ID Scheme

`point_id` must be unique within an analysis.

| Mode | Point IDs |
|---|---|
| Local grid | `P0`–`P8` |
| Regional scan | `R0001`, `R0002`, … |
| Route corridor | `C0001`, … (grid cells) and `W0001`, … (route waypoints) |
| Historical | Reuses the fixed IDs of the sampled points |

Every point-level agent returns data keyed by these IDs.

---

# 18. Activity- and Vessel-Aware Configuration

## 18.1 Activity-Aware Grid Radius

The local grid distance can depend on activity.

Configuration examples:

- Fishing — 5 km
- Boating — 10 km
- Marine research — 10 km
- Diving — 2 km
- Surfing — 2 km
- Tourism — 5 km
- Shipping — 15 km

These are configuration examples, not fixed permanent values.

## 18.2 Vessel Profiles

Vessel type affects:

- Safe thresholds for wind, waves, visibility and current (Section 48)
- Route constraints — maximum range, cruising speed, minimum depth
- Whether distance from coast is a safety factor

Each vessel profile is a configuration entry.

The number of points, radius and vessel profiles can all change later without code redesign.

---

# 19. Data Discovery Capability

The problem statement requires ORCA to autonomously discover, retrieve and integrate relevant datasets.

Data Discovery identifies, for each request:

- Required parameters
- Agents that provide them
- Preferred source
- Fallback sources
- Spatial resolution
- Temporal resolution
- Freshness requirement
- Historical availability

## 19.1 Data Catalog

The Data Catalog is a registry of datasets.

Each catalog entry contains:

- Dataset ID
- Parameters provided
- Source/provider
- Access method (API, file, WMS/WFS)
- Spatial coverage
- Spatial resolution
- Temporal resolution
- Update frequency
- Maximum acceptable age for safety use
- Historical range
- Authority level (official / scientific / model / fallback)
- Fallback dataset IDs
- Access status (available, pending approval, unavailable)

## 19.2 Example Catalog Entries

| Parameter | Preferred Source | Fallback | Freshness |
|---|---|---|---|
| Wind, precipitation, visibility | IMD products where accessible | Open-Meteo | Hourly |
| Wave height and period | INCOIS Ocean State Forecast | Open-Meteo Marine / Copernicus Marine | 3–6 hours |
| SST, chlorophyll | MOSDAC (Oceansat-3 and related products) | Copernicus Marine | Daily |
| PFZ | INCOIS PFZ advisory | Derived SST + chlorophyll indicators (labelled as derived) | Daily |
| Cyclone and marine warnings | IMD / INCOIS | None — marked unavailable | Latest bulletin |
| Tide | Tide-prediction source for Indian ports | Model-based tide | Daily |
| Boundaries, MPAs | Marine Regions, WDPA, official notifications | Cached layers | Versioned |

## 19.3 Output

Data Discovery produces a **data plan** that is stored in the execution trace and shown in the evidence panel.

---

# 20. Planner LLM

The Planner LLM decides which agents and capabilities are required.

It considers:

- User query
- Detected language
- Classified intent
- Validated location
- Activity
- Vessel type
- Interpreted time window
- Available agent capabilities from the Registry
- Data plan from Data Discovery
- Required evidence
- Conversation context
- Registered future agents

The Planner produces an **execution plan**.

The Backend does not make this decision.

## 20.1 Execution Plan Example

```json
{
  "analysis_id": "req_20260912_0530_a1b2c3",
  "response_language": "hi",
  "primary_intent": "point_safety",
  "secondary_intents": ["regional_search"],
  "location": {
    "original": {"name": "Chennai", "lat": 13.0827, "lon": 80.2707},
    "validated": {"lat": 13.05, "lon": 80.31, "snapped": true}
  },
  "time_window": {
    "local": "2026-09-12T05:00/2026-09-12T11:00 IST",
    "utc": "2026-09-11T23:30Z/2026-09-12T05:30Z"
  },
  "activity": "fishing",
  "vessel_type": "motorized_country_craft",
  "sampling": {"mode": "local_grid", "radius_km": 5, "points": 9},
  "selected_agents": [
    {"agent": "weather", "reason": "Query asks about safety; wind and visibility required"},
    {"agent": "ocean", "reason": "Wave height is a primary safety factor"},
    {"agent": "cyclone", "reason": "Official warnings must be checked for every safety request"},
    {"agent": "gis", "reason": "Recommended point must respect boundaries and MPAs"},
    {"agent": "pfz", "reason": "User also asked about fishing opportunity"}
  ],
  "skipped_agents": [
    {"agent": "tide", "reason": "Not needed for offshore fishing safety in this window"},
    {"agent": "ecosystem", "reason": "Not requested"}
  ],
  "stages": ["risk", "decision"]
}
```

## 20.2 Mandatory Selections

Some selections are enforced by configuration, not left to the LLM:

- Every safety intent must include the Cyclone/official-warning check.
- Every safety intent that recommends a point or route must include GIS.
- Every safety intent must include at least Weather and Ocean.

If the LLM omits a mandatory agent, plan validation adds it and records `reason = "mandatory_by_policy"`.

---

# 21. Dynamic Agent Selection

The specialized data agents are:

1. Weather Agent
2. Ocean Agent
3. Tide Agent
4. Cyclone Agent
5. Ecosystem Agent
6. Fishing/PFZ Agent
7. GIS Agent

The registered system capabilities are:

- Data Discovery
- Trend Agent
- Route Tool
- Report Agent
- Visualization
- User Interaction (Chat) Agent

The architecture is not limited to these.

If Planner selects only:

- Weather
- Ocean
- Tide

then only those agents execute.

If Planner selects every available agent:

> All selected agents execute.

If a future agent is registered:

> Planner can select it according to its capabilities.

Every selection and every skip is stored with a reason.

---

# 22. Generalized Agent Registry

Every agent and capability has metadata describing:

- Agent name
- Description
- Capabilities
- Supported intents
- Required inputs
- Output fields
- Output validation schema
- Data sources (preferred and fallback)
- Execution mode (point / regional / historical)
- Live and/or historical capability
- Dependencies
- Whether it can run in parallel
- Timeout
- Freshness requirement
- Safety-critical role (Risk input / Decision input / hard constraint / none)
- Version
- Availability

The registry is the capability directory for the Planner.

## 22.1 Example Registry Entry

```yaml
name: ocean
description: Wave, current, SST and salinity at sampled points
supported_intents: [quick_information, point_safety, regional_search, route_planning, historical_trend]
inputs: [points, time_window]
outputs: [wave_height_m, wave_period_s, current_speed_ms, current_direction_deg, sst_c, salinity_psu]
schema: schemas/ocean_output.json
sources:
  preferred: incois_osf
  fallback: [open_meteo_marine, copernicus_marine]
execution_mode: point
historical: true
parallel: true
depends_on: []
timeout_s: 10
freshness_max_hours: 6
safety_role: risk_input
version: 1.2.0
available: true
```

---

# 23. Adding a Future Agent

To add a new agent:

1. Create the agent.
2. Define its capabilities and supported intents.
3. Define its inputs.
4. Define its outputs and validation schema.
5. Create a source adapter for its data source.
6. Define its safety role.
7. Register it.
8. Make its capability visible to the Planner.
9. Add mock data for demo mode.
10. Add tests.

The core pipeline does not need to be rewritten.

Possible future agents:

- Water Quality Agent
- Biodiversity Agent
- Marine Traffic Agent
- Pollution Agent
- Species Agent
- Sediment Agent
- Navigation Agent
- Oil Spill Agent
- Shipping Agent

---

# 24. Specialized Agent Principle

Each agent is responsible for its own data domain.

It fetches and normalizes its data.

It does not make the final safety decision.

This gives ORCA clear separation between:

**Data Collection**

and

**AI Reasoning**

## 24.1 Source Adapter Pattern

Every data agent reads through adapters:

**Source → Adapter → Canonical ORCA Data → Agent**

The adapter converts the provider's format, units and names into ORCA's canonical fields.

This allows mock, primary and fallback sources to be swapped without changing the Planner, Risk or Decision stages.

## 24.2 Canonical Units and Unit Enforcement (resolved)

`Measurement.unit` (Section 43) is a free string. Without enforcement, nothing stops one adapter from emitting a parameter in a different unit than another adapter for the same parameter — for example, wind speed in `m/s` from one source and `kn` from another — which would silently corrupt any threshold comparison downstream. This is a real gap, not a hypothetical one, and is closed as follows.

**Canonical units use world/SI standards, not vessel-threshold-convenience units:**

| Parameter | Canonical unit | Standard |
|---|---|---|
| Wind speed / gust | `m/s` | WMO/SI |
| Wave height / significant wave | `m` | SI |
| Current speed | `m/s` | SI |
| Sea surface temperature | `°C` | Universal oceanographic practice |
| Salinity | `PSU` | International oceanographic standard |
| Pressure | `hPa` | WMO |
| Visibility | `km` | SI |
| Precipitation | `mm` | SI |
| Distance / bearing | `km` / `deg` | SI |

This table lives in `shared-config/canonical-units.json` and is the single source of truth for which unit each parameter must be stored in.

**Enforcement point:** at the adapter stage, immediately after Source → Adapter conversion and before the value is wrapped in `Measurement` and handed to the agent. A shared utility (`enforceCanonicalUnit(parameter, unit)`) checks the outgoing unit against the table.

- **Match:** proceeds normally.
- **Mismatch:** the field is excluded from Risk scoring, exactly as a `missing` field would be — this preserves the never-fabricate principle. Unlike genuine data unavailability, a unit mismatch is additionally logged and flagged as an **adapter bug**, since it is fixable at the source rather than a true data-availability gap.

**Consequence for vessel thresholds:** `VesselProfile`'s wind threshold field, previously named `wind_kn`, must be renamed to `wind_ms` and its values converted to m/s, so the field name and its canonical unit agree (see Section 48.5, updated). Frontend/voice display to fishermen may still present wind speed in knots — that is a presentation-layer conversion applied at render time, not a change to canonical storage or scoring.

---

# 25. Weather Agent

The Weather Agent works only on weather parameters.

Potential fields:

- Temperature
- Wind speed
- Wind gust
- Wind direction
- Precipitation
- Cloud cover
- Visibility
- Lightning / thunderstorm risk
- Weather warnings and nowcasts

Returns hourly values across the interpreted time window where available.

Role: **Risk input**.

It does not calculate the final risk.

---

# 26. Ocean Agent

The Ocean Agent works only on ocean parameters.

Potential fields:

- Significant wave height
- Maximum wave height
- Wave period
- Wave direction
- Swell height
- Sea surface temperature
- Salinity
- Current speed
- Current direction
- Other marine parameters

Returns hourly values where available.

Role: **Risk input**.

It provides evidence to downstream reasoning.

---

# 27. Tide Agent

The Tide Agent owns tide-related information.

Potential fields:

- Tide level
- Tide phase
- High tide time
- Low tide time
- Tide trend
- Tidal range

Regional tide information can be fetched once when the data source supports it and localized to points.

Role: **Risk input** (especially near shore, harbour entry and shallow water).

---

# 28. Cyclone Agent and Official Warnings

The Cyclone Agent owns cyclone and official marine warning information.

Potential fields:

- Cyclone presence
- Cyclone name and category
- Distance from analysis point
- Forecast track and movement
- Alert level
- Expected influence
- Forecast timing
- Official fishermen warnings (for example, "fishermen advised not to venture")
- High-wave and swell-surge alerts
- Warning validity period
- Warning area polygon or named coastal segment
- Issuing authority and bulletin ID

Unavailable cyclone or warning data must be explicitly marked `unavailable`, never assumed as "no warning".

Role: **Risk input** and **source of official-warning overrides** (Section 49).

---

# 29. Ecosystem Agent

The Ecosystem Agent owns ecological information.

Potential fields:

- Chlorophyll concentration
- Sea surface temperature fronts
- Dissolved oxygen
- Nitrate
- Algal bloom indicators
- Ecological sensitivity
- Biodiversity indicators
- Other ecosystem measurements

Role: **Decision input**.

Ecosystem data goes to the Decision Agent and is excluded from Risk Agent input.

---

# 30. Fishing/PFZ Agent

The Fishing/PFZ Agent owns fishing opportunity information.

Potential fields:

- PFZ presence
- PFZ distance
- PFZ direction/bearing
- PFZ depth
- PFZ validity period
- Advisory source and date
- SST indicators
- Chlorophyll indicators
- Other fishing evidence

Role: **Decision input**.

Important distinction:

**Fishing opportunity ≠ safety.**

A PFZ may indicate a good fishing opportunity while the location is unsafe.

The Decision Agent combines both concepts.

If an official PFZ advisory is unavailable and a derived indicator is used, it must be labelled "derived, not official advisory".

---

# 31. GIS Agent

The GIS Agent owns spatial information.

Potential fields:

- Coast distance
- Water depth
- Nearest port
- Port distance
- Marine Protected Area (inside / distance)
- Ecologically sensitive zone (inside / distance)
- Restricted or prohibited zone
- International maritime boundary distance
- EEZ relationship
- Territorial waters
- Contiguous zone
- Seasonal fishing ban applicability
- Other geospatial constraints

Role: **Decision input** and **hard constraint** (Section 59).

GIS is essential for geofencing and legally valid recommendations.

---

# 32. Registered System Capabilities

These are capabilities inside the AI Service.

They do not create a fourth major architectural part.

## 32.1 Data Discovery

Selects datasets and sources (Section 19).

## 32.2 Trend Agent

Calculates historical values, anomalies and trends, then explains them (Section 72).

## 32.3 Route Tool

Deterministic pathfinding over a risk-cost grid (Section 71).

## 32.4 Report Agent

Creates a shareable marine advisory from stored evidence (Section 73).

## 32.5 Visualization Capability

Chooses the presentation for each result:

- Map layers
- Hourly charts
- Per-point risk bar chart
- Route display
- Trend charts

It returns a **visualization specification**.

The Frontend performs the rendering.

## 32.6 User Interaction (Chat) Agent

Handles conversation, memory, follow-up detection and re-planning (Sections 86–92).

---

# 33. Parallel Agent Execution

After the Planner selects the agents, independent agents run in parallel whenever possible.

Example:

Planner selects:

- Weather
- Ocean
- Tide
- Cyclone
- GIS

These execute concurrently because they have no dependencies.

This reduces total analysis time.

The system distinguishes:

### Independent Agents

Can run simultaneously.

### Dependent Agents

Must wait for required upstream data.

The core dependency is:

**Planner → Data Agents → Risk → Decision**

For routes:

**Planner → Data Agents → Risk-cost grid → Route Tool → Decision/Explanation**

---

# 34. Latency and Timeout Plan

Planner, Risk and Decision are sequential LLM stages, so latency is actively managed.

## 34.1 Target Response Times

| Intent | Target |
|---|---|
| `quick_information` | Under 10 seconds |
| `point_safety` | Under 30 seconds |
| `regional_search` | Under 40 seconds |
| `route_planning` | Under 45 seconds |
| `historical_trend` | Under 45 seconds |
| Live geofence check | Under 1 second |

Targets are configurable and measured.

## 34.2 Techniques

- Fast, low-cost model for Planner and language/intent tasks.
- Stronger model only for Risk interpretation and Decision.
- Deterministic tools run before the LLM, not inside it.
- Per-agent timeout (default 10 seconds, configurable in registry).
- One retry for transient upstream errors.
- A timed-out agent is marked `failed` with `error_category = timeout`; the pipeline continues with available evidence.
- Regional data fetched once and localized.
- Cached GIS layers.
- Compact LLM context (summaries plus required values, not raw datasets).
- Structured output mode to reduce repair retries.

---

# 35. Live Agent Status

ORCA shows the user what is happening.

Example:

- Planner — Completed
  - Intent: Point safety
  - Language: Tamil
- Weather — Completed
- Ocean — Running
- Tide — Completed
- Cyclone — Running
- GIS — Completed
- Risk — Waiting
- Decision — Waiting

Only agents selected by the Planner are shown as active analysis cards.

Each card can show the Planner's selection reason:

> "Ocean Agent — selected because wave height is a primary safety factor for motorized country craft."

---

# 36. Dynamic Status Cards

Before the Planner finishes:

> Planning analysis...

After the Planner finishes:

> Backend knows which agents were selected.

Frontend creates status cards only for those selected agents.

Example:

Planner selects:

- Weather
- Ocean
- GIS

Frontend shows:

- Weather Agent
- Ocean Agent
- GIS Agent

It does not show unnecessary agent cards.

Skipped agents can be listed in a collapsed "Not needed for this query" section with their skip reasons.

---

# 37. Agent and Point Status Values

## 37.1 Agent Status Values

- `queued`
- `running`
- `completed`
- `partial`
- `failed`
- `skipped`

### queued

Selected but not started.

### running

Currently executing.

### completed

Finished successfully.

### partial

Finished but some fields/sources were unavailable.

### failed

Execution failed (including timeout, with `error_category`).

### skipped

Not selected by the Planner.

Frontend can hide skipped agents.

## 37.2 Point Status Values

- `applicable` — marine point, included in analysis
- `not_applicable` — land or otherwise unsuitable point, excluded from marine agents and risk
- `prohibited` — marine point inside a GIS-prohibited area; data and risk may be shown, but it can never be recommended

---

# 38. AI Service → Backend Progress

Whenever an important stage changes, the AI Service sends progress to the Backend.

The progress message contains:

- `analysis_id`
- Agent/stage name
- Status code
- Status
- Timestamp
- Selection reason (for Planner output)
- Data when appropriate
- Error information when applicable
- Optional metadata

Example:

```json
{
  "analysis_id": "req_20260911_1030_a1b2c3",
  "agent": "ocean",
  "status": "completed",
  "status_code": 200,
  "timestamp": "2026-09-11T10:42:07Z",
  "data_ref": "agent_results/ocean",
  "error": null
}
```

The Backend authenticates the internal request.

The Backend stores the progress.

---

# 39. Backend → Frontend Progress

Frontend never receives progress directly from the AI Service.

Instead:

**AI Service → Backend → Frontend**

Recommended first implementation:

**Frontend polling**

Frontend polls:

`GET /api/v1/analysis/:analysis_id/status`

approximately every 1–2 seconds while the analysis is running.

Advantages:

- Simple
- Reliable
- Easy to debug
- Easy to implement for SIH

Future implementation can use:

- Server-Sent Events
- WebSockets
- Push notifications

without changing the AI pipeline.

---

# 40. Status Code Design

Recommended HTTP status codes:

### 200 — Success

Request/result successfully returned.

### 201 — Created

Resource created synchronously (for example, an alert subscription).

### 202 — Accepted

Analysis accepted for asynchronous execution.

### 206 — Partial Content

Partial result is available.

### 400 — Bad Request

Malformed input.

### 401 — Unauthorized

Authentication missing/invalid.

### 403 — Forbidden

Client not permitted.

### 404 — Not Found

Analysis/resource does not exist.

### 409 — Conflict

Conflicting operation/state (for example, duplicate subscription).

### 422 — Unprocessable Entity

Input is structurally valid but semantically invalid.

Examples:

- Unsupported marine location
- Unresolvable place
- Time window beyond forecast horizon

### 429 — Too Many Requests

Rate limit exceeded.

### 500 — Internal Server Error

Unexpected internal failure.

### 502 — Bad Gateway

Upstream AI/data service failure.

### 503 — Service Unavailable

Required service unavailable.

### 504 — Gateway Timeout

Upstream service did not respond within the configured time.

---

# 41. Partial Failure

ORCA preserves successful agent results even when another agent fails.

Example:

- Weather — Completed
- Ocean — Completed
- Tide — Failed
- GIS — Completed
- PFZ — Completed

Successful results remain stored.

The Risk/Decision pipeline receives the available evidence and knows Tide data is unavailable.

The final analysis becomes:

`partial`

instead of losing the entire result.

Exception: if a **mandatory** safety agent fails (Weather, Ocean or the official-warning check), no point may be rated SAFE (Section 50).

---

# 42. Missing Data

The system must never fabricate missing scientific data.

A field can be:

- Available
- Partial
- Missing
- Not mapped
- Stale
- Cached
- Near-real-time
- Derived (not official)

The reason for unavailable data is preserved.

This prevents the LLM from treating invented numbers as evidence.

Missing data:

- Reduces confidence
- Is listed in data quality
- Is mentioned in the recommendation when it matters
- Never silently becomes zero or "no hazard"

---

# 43. Data Provenance

Important scientific data retains:

- Source
- Dataset/product identifier
- Retrieval time
- Valid time (forecast/observation time)
- Unit
- Freshness
- Status
- Forecast or observation type
- Optional confidence

Example:

> Wind speed = 8.2 m/s
> Source = weather provider
> Valid time = 12 Sep 2026, 06:00 IST
> Retrieved = analysis time
> Status = available

## 43.1 Official Source Authority

For safety-critical warnings, additionally preserve:

- Issuing authority (for example, IMD, INCOIS)
- Bulletin/product identifier
- Issue time
- Validity period
- Affected area
- Warning level

Official-warning provenance remains visible to all downstream safety processing and to the user.

This improves explainability and auditability.

---

# 44. Point ID Matching

Every point-level agent uses the common `point_id` defined by the sampling tool (Section 17.1).

For the local grid:

- P0
- P1
- P2
- P3
- P4
- P5
- P6
- P7
- P8

If Weather returns P3 and Ocean returns P3, the Backend associates both with P3.

This allows point-wise merging.

The Backend performs association and storage.

It does not interpret scientific meaning.

Data returned for a `not_applicable` point is ignored and logged.

---

# 45. Flexible Data Storage

The Backend preserves two major layers.

## Agent Results

Stores complete individual agent outputs.

This preserves:

- Original data
- Agent metadata
- Errors
- Provenance
- Future fields

## Final Result

Stores the authoritative Decision Agent (or intent-specific) response.

This provides:

- Final dashboard result
- Chat context
- Report source
- Audit trail
- Historical record

This structure makes future agents and fields easy to add without schema redesign.

---

# 46. Risk Agent

After the selected data agents finish, the Risk Agent receives:

**All relevant selected agent data except:**

- PFZ
- GIS
- Ecosystem

Therefore, examples of Risk input include:

- Weather
- Ocean
- Tide
- Cyclone and official warnings
- Future safety-related agents

The exact selected set depends on the Planner.

The Risk Agent also receives:

- Activity
- Vessel profile
- Interpreted time window
- Point list with `point_status`
- Data quality and provenance

## 46.1 Why GIS, PFZ and Ecosystem Are Excluded

- **PFZ** describes opportunity, not danger. Mixing it into risk would make "good fishing" look "safe".
- **Ecosystem** describes ecological state, not immediate physical danger.
- **GIS** restrictions are legal/spatial constraints. They are applied as **hard constraints** in the Decision stage (Section 59), not blended into an environmental score.

This keeps the environmental risk score clean and interpretable.

---

# 47. Hybrid Risk Architecture

Risk is **not** a free-form LLM score.

An LLM alone can score the same evidence 58 in one run and 66 in the next.

ORCA therefore uses a layered, reproducible design.

## 47.1 Authority Hierarchy

**Official Warning → Hard Safety Rules → Deterministic Baseline → Controlled LLM Interpretation**

A higher layer always wins over a lower layer.

## 47.2 Stages

1. **Deterministic baseline** — reproducible score from configured thresholds (Section 48).
2. **Official warning override** — applicable IMD/INCOIS warnings set a minimum score (Section 49).
3. **Hard safety rules** — configured rules set further minimum scores (Section 50).
4. **Controlled LLM interpretation** — explains the evidence and may adjust within a narrow band (Section 51).
5. **Validation** — schema and constraint checks (Section 56).

The same evidence always produces the same baseline and the same floors.

---

# 48. Deterministic Safety Baseline

The baseline is calculated by Python code inside the Risk Agent, not by the LLM.

## 48.1 Inputs

- Wind speed and gusts
- Significant wave height
- Visibility
- Lightning/thunderstorm indicators
- Cyclone proximity
- Tide and current (where relevant)
- Activity
- Vessel profile thresholds

## 48.2 Factor Sub-Scores

Each factor has three thresholds from the vessel profile:

- `caution`
- `unsafe`
- `dangerous`

The factor value is mapped to a 0–100 sub-score by linear interpolation inside each band:

| Factor value | Sub-score band |
|---|---|
| Below `caution` | 0–34 |
| `caution` to `unsafe` | 35–64 |
| `unsafe` to `dangerous` | 65–84 |
| At or above `dangerous` | 85–100 |

For factors where lower is worse (for example, visibility), the direction is inverted.

## 48.3 Combining Factors

```
dominant   = max(factor sub-scores)
elevated   = number of other factors with sub-score >= 35
uplift     = min(3 × elevated, 10)
baseline   = min(dominant + uplift, 100)
```

The dominant hazard drives the score.

Several moderate hazards together raise it slightly.

## 48.4 Time Window

- A baseline is computed for every hour with data.
- The point's window score is the **highest hourly score** inside the requested window (conservative).
- Hourly scores are retained for best-time analysis and charts (Section 63).

### 48.4.1 baseline_score Definition (resolved)

The `baseline_score` field in `RiskResult` **is** the window score defined above:

```
baseline_score = max(hourly_scores[].score)
```

taken only over hours with a computable score. Hours where the underlying data is `missing`/`not_mapped` are excluded from the max, not treated as 0.

If zero hours have a computable score, `baseline_score` is `null` (never fabricated as 0 or any other number), and `confidence` is reduced accordingly.

This is deliberately conservative: a single bad hour inside the window sets the point's baseline, rather than being averaged away by calmer hours. `llm_adjustment` and `constraint_floor` continue to apply on top of this value exactly as shown in the worked example (Section 121-equivalent), unchanged.

## 48.5 Example Vessel Thresholds (Illustrative)

> **Illustrative placeholder values only.** They must be calibrated against IMD/INCOIS guidance and domain experts before operational use. They live in `config/risk_thresholds.yaml`.
>
> **Unit note (per Section 24.2):** thresholds are stored and compared in canonical **m/s**, not knots. The field is `wind_ms`, not `wind_kn` — the earlier `wind_kn` name implied knots while the rest of the pipeline could not guarantee the measurement actually arrived in knots. Values below are the same physical thresholds as before, converted from the original knot values. Fishermen-facing displays may still render knots at read time.

| Vessel profile | Wind (m/s) caution / unsafe / dangerous | Significant wave (m) caution / unsafe / dangerous | Visibility (km) caution / unsafe / dangerous |
|---|---|---|---|
| Traditional non-motorized | 6.2 / 8.7 / 11.3 | 1.0 / 1.5 / 2.0 | 5 / 2 / 1 |
| Motorized country craft | 7.7 / 10.3 / 13.9 | 1.25 / 2.0 / 2.5 | 4 / 2 / 1 |
| Mechanized fishing vessel | 10.3 / 13.9 / 17.5 | 2.0 / 3.0 / 4.0 | 3 / 1.5 / 0.5 |
| Recreational/tourism boat | 6.2 / 8.7 / 11.3 | 0.75 / 1.25 / 2.0 | 5 / 2 / 1 |
| Large commercial vessel | 13.9 / 17.5 / 24.7 | 3.5 / 5.0 / 7.0 | 2 / 1 / 0.5 |

Activity can add further adjustments (for example, diving and surfing use current and visibility more strictly).

---

# 49. Official Warning Override

Authoritative warnings have higher authority than any model interpretation.

## 49.1 Applicability

A warning applies to a point when:

- The point lies inside the warning's area polygon or named coastal segment, and
- The warning's validity period overlaps the interpreted time window.

## 49.2 Warning Floors

Each issuing authority's warning levels are mapped to minimum scores in `config/official_warning_rules.yaml`.

Example mapping:

| Warning type | Minimum score | Minimum level |
|---|---|---|
| Cyclone warning / "fishermen advised not to venture" | 85 | DANGEROUS |
| Highest-level high-wave or swell-surge warning | 85 | DANGEROUS |
| High-wave alert | 65 | UNSAFE |
| Watch / advisory level | 35 | CAUTION |

## 49.3 Rules

- The LLM must never downgrade an applicable official hazardous warning.
- A point under an applicable warning can never be SAFE.
- The warning, its authority, bulletin ID and validity period are shown in the result.
- If the official-warning source is unavailable, the result states "Official warning status could not be verified" and the no-SAFE rule in Section 50 applies.

---

# 50. Hard Safety Rules

Hard rules are deterministic, configurable and applied after the official-warning check.

Examples:

- Cyclone within a configured distance and forecast to approach during the window → minimum 85 for small craft.
- Active thunderstorm/lightning nowcast at the point → minimum 65 for open small craft.
- Visibility below the vessel's `dangerous` threshold → minimum 65.
- **Insufficient safety evidence** — wind and wave both missing, or the official-warning check failed → level cannot be SAFE (minimum 35) and confidence is capped at 0.5.
- Data older than its freshness limit is treated as missing for safety purposes.

Each triggered rule is recorded with its rule ID.

---

# 51. Controlled Risk LLM Interpretation

The Risk Agent LLM has:

- Editable system prompt
- Safety reasoning rules
- Activity and vessel context
- Baseline scores and factor breakdown
- Applied floors
- Evidence with provenance
- Missing-data rules
- Confidence rules

The system prompt is stored separately.

## 51.1 What the LLM Does

- Explains the evidence in plain language for each point.
- Identifies key findings and important risk factors.
- May adjust the baseline within a narrow configured band.

## 51.2 Adjustment Limits

- `LLM_ADJUSTMENT_BAND = ±10` (configurable).
- Every adjustment requires an `adjustment_reason` that references actual evidence fields.
- The LLM may raise a level, but may **not lower a score across a level boundary** (for example, from CAUTION to SAFE).
- The LLM can never go below the constraint floor.

## 51.3 Final Score Formula

```
constraint_floor = max(official_warning_floor, hard_rule_floor)
proposed         = baseline + llm_adjustment        # adjustment within ±10
final_score      = clamp(max(proposed, constraint_floor), 0, 100)
```

The baseline, adjustment, floors and final score are all stored.

---

# 52. Risk Score and Levels

The Risk Agent produces a score for every **applicable** point.

Range:

**0–100**

Initial interpretation:

- 0–34 — SAFE
- 35–64 — CAUTION
- 65–84 — UNSAFE
- 85–100 — DANGEROUS

The thresholds are configurable.

`not_applicable` points receive no score.

---

# 53. Risk Agent Output

For every applicable point, Risk provides:

- Point ID
- Baseline score
- LLM adjustment and reason
- Applied official warnings
- Applied hard rules
- Final risk score
- Risk level
- Hourly scores
- Reasoning
- Key findings
- Important risk factors
- Confidence
- Relevant data quality information

Example:

```json
{
  "point_id": "P3",
  "baseline_score": 71,
  "llm_adjustment": 4,
  "adjustment_reason": "Wind increases from 18 to 24 kn after 09:00 per weather.wind_speed hourly series",
  "official_warnings": [],
  "hard_rules_applied": [],
  "final_score": 75,
  "risk_level": "UNSAFE",
  "risk_factors": ["wave_height", "wind_speed"],
  "reasoning": "Significant wave height of 2.3 m exceeds the unsafe limit for motorized country craft...",
  "key_findings": ["Waves above unsafe limit", "Wind rising through the morning"],
  "confidence": 0.78,
  "data_quality": {"tide": "missing", "ocean": "available", "weather": "available"}
}
```

The Risk Agent reasons from actual available evidence only.

---

# 54. Risk Factors

Potential factors include:

- Wind
- Gusts
- Waves
- Swell
- Visibility
- Precipitation
- Lightning
- Cyclone
- Official warnings
- Tide
- Current
- Other marine hazards
- Data gaps

The risk-factor framework remains extensible: a new factor needs a threshold entry and a canonical field.

---

# 55. Risk Confidence

Risk score and confidence are different.

Example:

> Score = 72
> Confidence = 0.61

This means the available evidence indicates significant risk, but uncertainty remains.

Confidence is calculated deterministically from:

- Completeness of safety-relevant data
- Freshness of data
- Use of fallback or derived sources
- Forecast lead time
- Agreement between sources where more than one exists

Missing information reduces confidence instead of creating fake numerical precision.

---

# 56. Structured LLM Output Validation

LLM output is **untrusted until validated**.

Pydantic (or equivalent) schemas enforce the rules below.

## 56.1 Planner Validation

- Every selected agent exists in the Registry and is available.
- Selected agents support the classified intent.
- Mandatory agents for the intent are present (Section 20.2).
- Dependencies are satisfiable.
- Parameters are within allowed values.

## 56.2 Risk Validation

- Every applicable `point_id` is present exactly once.
- No `not_applicable` point is scored.
- Scores are integers from 0 to 100.
- Risk level matches the score band.
- Adjustment is within the configured band and does not cross a level boundary downward.
- Final score respects the constraint floor.
- Reasoning and confidence exist.
- Evidence fields referenced in reasoning exist in the input.

## 56.3 Decision Validation

- All required recommendation fields exist.
- Risk scores are returned exactly as received.
- The preferred point is allowed (Section 59), or is `null` for a "do not venture" outcome.
- Numeric values mentioned in the text exist in the evidence.
- Output language matches `response_language`.

## 56.4 Chat Validation

- No new risk scores are created.
- Cited values exist in the stored analysis.

## 56.5 Retry and Failure

1. Invalid output is returned to the LLM with the validation errors for repair.
2. At most two repair attempts are made.
3. If the Risk LLM still fails, ORCA returns the **deterministic baseline and floors** with template reasoning and the flag `llm_interpretation_unavailable`. No data is fabricated.
4. If the Decision LLM still fails, Risk and agent results are preserved and final-decision failure is reported (Section 104).

---

# 57. Decision Agent

The Decision Agent is the final reasoning component.

It contains:

- LLM
- Editable system prompt
- Deterministic point selector
- Deterministic best-time calculator
- Risk results
- GIS data
- PFZ data
- Ecosystem data

According to the architecture:

**Risk + GIS + PFZ + Ecosystem → Decision Agent**

---

# 58. Decision Agent Responsibilities

The Decision Agent produces the following, in `response_language`.

## 1. Detailed Recommendation

A complete evidence-based explanation.

It explains:

- What the user should do.
- Which point is preferable.
- Which points should be avoided.
- Why.
- Major environmental factors.
- Official warnings.
- Geographic restrictions.
- PFZ information.
- Ecosystem considerations.
- Safer time windows.
- Important uncertainties and missing data.

## 2. One-Line Short Recommendation

A concise dashboard recommendation that also fits an SMS or push notification.

Example:

> Avoid P3; P2 is the safest allowed point, best between 05:00 and 08:00.

## 3. Key Final Findings

Important conclusions such as:

- Safest allowed point
- Highest-risk point
- Major hazard
- Official warning status
- Important GIS restriction
- PFZ opportunity
- Best time
- Main uncertainty

## 4. All Zone/Point Scores

Risk Agent scores are returned **as-is**.

The Decision Agent never modifies the Risk Agent's numerical scores.

## 5. Recommendation Type

One of:

- `go`
- `go_with_caution`
- `go_in_safer_window`
- `not_recommended`
- `do_not_venture`

---

# 59. Hard-Constraint Point Selection (Preferred Point)

The preferred point is the **lowest-risk applicable and allowed point**.

Selection is performed by a deterministic selector.

## 59.1 Selection Order

1. Exclude `not_applicable` (land) points.
2. Exclude GIS-prohibited points:
   - Across the international maritime boundary
   - Inside Marine Protected Areas where the activity is not permitted
   - Inside restricted or prohibited waters
   - Inside ecologically sensitive zones where the activity is not permitted
   - Under an applicable seasonal fishing ban
3. Exclude points whose final level is DANGEROUS.
4. Compare the remaining Risk scores.
5. Select the lowest-scoring allowed point.

## 59.2 Tie Band

If other allowed points are within a configured tie band (for example, 5 points) of the best score, the Decision Agent may prefer one with a PFZ or ecosystem advantage.

It must explain the choice.

## 59.3 Rule

A numerically low-risk point must never be recommended when GIS or an official warning makes it prohibited or unsafe.

Prohibited points are still shown on the map with their scores and marked `prohibited`.

---

# 60. No Allowed Point Outcome

If no point survives the selection order:

- `preferred_point = null`
- `recommendation_type = do_not_venture` (or `not_recommended` if all remaining points are UNSAFE)

The recommendation says clearly:

> "Do not venture. No allowed point is safe during the requested window."

The Decision Agent never picks the "least bad" point as a recommendation.

If a safer window exists later (Section 63), it is offered as an alternative:

> "Conditions are expected to improve after 16:00. Re-check before departure."

---

# 61. Worst Point

The worst point is the applicable point with the highest risk according to Risk Agent results.

The Decision Agent explains its major causes.

---

# 62. Evidence-Based Decision

The Decision Agent must use actual evidence.

Recommendations can be supported by:

- Weather
- Ocean
- Tide
- Cyclone and official warnings
- GIS
- PFZ
- Ecosystem
- Risk reasoning

It must not invent unavailable information.

Every major claim in the recommendation maps to an evidence field shown in the evidence panel.

---

# 63. Best-Time Recommendation

Best-time recommendation is part of the **core safety workflow** whenever hourly data exists.

Instead of only:

> Go / Do not go

ORCA answers:

> The safer available period is 05:00–08:00.

## 63.1 Algorithm (Deterministic)

1. Take hourly final scores (baseline + floors) for each allowed point.
2. Find contiguous windows where the level is SAFE or CAUTION.
3. Keep windows longer than a configured minimum (for example, 2 hours).
4. Rank by lowest maximum score, then by length.
5. If no safe window exists inside the requested window, search the next configured horizon (for example, 24 hours) and suggest it as an alternative.

The Decision LLM explains the result; it does not compute it.

The result feeds the hourly charts (Section 83).

---

# 64. Natural-Language Advisory

The final result is understandable to non-technical users.

Instead of:

> Risk = 58

ORCA explains:

> Conditions are moderately suitable, but increasing wind later in the day makes an earlier period preferable.

Advisory text:

- Uses the response language
- Avoids jargon
- Uses familiar units (with the option to see technical units)
- States uncertainty honestly

---

# 65. GIS Hard Constraints and Marine Geofencing

GIS restrictions are **hard constraints**, not merely explanatory evidence.

GIS supports:

- Indian EEZ
- Territorial waters
- Contiguous zone
- International maritime boundaries
- Restricted and prohibited zones
- Marine Protected Areas
- Ecologically sensitive zones
- Seasonal fishing ban areas
- Ports
- Coast distance
- Water depth

ORCA can identify:

- Inside protected area
- Inside ecologically sensitive zone
- Inside restricted area
- Near or across maritime boundary
- Near port
- Near coast

## 65.1 Constraint Types

| Type | Effect |
|---|---|
| `prohibited` | Point/route can never be recommended |
| `conditional` | Allowed only for certain activities or seasons |
| `warning_only` | Allowed, but the user is warned (for example, near boundary) |

Constraint types per layer and activity are configured in `config/gis_constraints.yaml`.

This makes the recommendation realistic and legally valid.

---

# 66. Live GPS Geofencing

The problem statement requires notifications when **approaching** boundaries.

This needs live position, not a one-time analysis.

## 66.1 Flow

**Phone GPS → Frontend → Backend → Spatial Geometry Query → Boundary/MPA/Sensitive-Zone Check → Distance → Warning**

## 66.2 Behaviour

- The Frontend sends GPS position at a configurable interval while geofence mode is on.
- The Backend queries preloaded polygons using geospatial indexes.
- It returns one of:
  - `clear`
  - `approaching` — within `GEOFENCE_WARNING_KM` (configurable, for example 5 km)
  - `inside`
- The response includes layer name, constraint type, distance and bearing to the boundary.
- Warning text uses pre-translated templates in the user's language.

## 66.3 Rules

- No LLM is used for the geometry decision.
- Target response time is under 1 second.
- Repeated identical warnings are deduplicated for a configurable period.
- Geofence events are stored for audit.
- If the device is offline, the last downloaded boundary layers can be checked on-device as a fallback (Section 85).

---

# 67. GIS Reference Layers and Storage

Reference map layers include:

- EEZ and maritime boundaries (for example, from Marine Regions)
- Territorial waters
- Contiguous zone
- Marine Protected Areas (for example, from WDPA / Protected Planet and official notifications)
- Ecologically sensitive zones
- Restricted zones
- Ports
- Coastline and land/sea mask
- Bathymetry

## 67.1 Storage

- Layers are downloaded once, validated and stored in MongoDB as GeoJSON.
- MongoDB `2dsphere` indexes support fast queries such as `$geoIntersects` and `$near`.
- Each layer has a version, source and last-updated date.
- Layers are cached instead of being repeatedly downloaded.
- The Frontend receives simplified layer geometry for map display through `GET /api/v1/map/layers`.

Official boundaries must come from authoritative sources; the source of every layer is shown in the evidence panel.

---

# 68. PFZ Intelligence

PFZ information remains separate from safety.

ORCA answers two different questions.

### Safety

> Is the location safe?

### Fishing Opportunity

> Is a PFZ nearby?

The Decision Agent combines both.

Example:

> P2 has a nearby PFZ, while P3 has significantly higher environmental risk.

For "Where is the nearest PFZ today?", ORCA uses `regional_search`:

1. Fetch the latest PFZ advisory for the region.
2. Compute distance and bearing from the user's location.
3. Check GIS constraints on the PFZ location.
4. Optionally run Risk along the way (route intent).
5. Show PFZ on the map with validity date and source.

---

# 69. Indian Data Sources and Source Adapters

Where accessible, ORCA prioritizes Indian and official sources.

| Source | Use |
|---|---|
| **MOSDAC** (ISRO) | Oceansat-3 and other Earth-observation ocean products such as SST and chlorophyll |
| **Bhuvan / Bhoonidhi** (ISRO) | Indian EO data and geospatial layers |
| **INCOIS** | PFZ advisories, Ocean State Forecast, high-wave and swell-surge alerts, tide information |
| **IMD** | Cyclone warnings, weather warnings, nowcasts, fishermen warnings |
| **Open-Meteo / Open-Meteo Marine** | Global weather and marine fallback |
| **Copernicus Marine** | Global marine and historical fallback |
| **Marine Regions, WDPA** | Boundary and protected-area layers |

## 69.1 Access Verification

Access, registration, licensing, rate limits and approval requirements must be verified before implementation.

Sources requiring approval are marked `pending_approval` in the Data Catalog and served by fallbacks until approved.

## 69.2 Adapter Rule

**Source → Adapter → Canonical ORCA Data → Agent**

Primary and fallback sources can change without redesigning the Planner, Risk or Decision stages.

---

# 70. Proactive Marine Alerts

Alerts are a **core** capability required by the problem statement.

Alerts can cover:

- Cyclones
- Strong winds
- High waves and swell surges
- Lightning
- Thunderstorms
- Poor visibility
- Other dangerous marine conditions
- Newly issued official warnings

## 70.1 Flow

**Backend Scheduler → Subscribed Locations → AI Service (Weather/Cyclone/Risk + Official Warnings + Hard Rules) → Alert Decision → Backend → Deduplication → Notification**

## 70.2 Responsibility Split

- **Backend** — stores subscriptions, runs the scheduler, deduplicates, delivers notifications.
- **AI Service** — evaluates conditions and decides whether an alert is needed.

## 70.3 Subscription Fields

- User/device identifier
- Location (coordinate or place)
- Activity and vessel type
- Language
- Alert types
- Minimum alert level
- Notification channel
- Quiet hours (optional; official DANGEROUS alerts always delivered)

## 70.4 Rules

- The scheduler runs at a configurable interval (for example, every 3 hours) and immediately when a new official warning is detected.
- An alert is sent when the level reaches the subscription threshold or an official warning newly applies.
- Identical alerts are deduplicated; an alert is re-sent only if the level increases or the warning changes.
- Alert text uses the one-line recommendation format in the subscriber's language.

## 70.5 Channels

- Phase 1/2: Web Push (PWA)
- Later: SMS, WhatsApp, IVR/voice call

Alerts are separate from the normal request pipeline but reuse the same agents and rules.

---

# 71. Safe Route Planning

Basic route planning is a **core** capability when requested.

## 71.1 Route Tool (Deterministic)

1. Build a route corridor grid between origin and destination (Section 16).
2. Run the selected data agents on the corridor cells.
3. Compute hourly Risk for each cell using the same baseline, warnings and hard rules.
4. Build a cost graph:
   - Cell cost = distance + weighted risk score
   - GIS-prohibited polygons are **blocked** (infinite cost)
   - DANGEROUS cells are blocked
   - Cells shallower than the vessel's minimum depth are blocked
5. Run A* (or Dijkstra) pathfinding.
6. Return waypoints, total distance, estimated duration (from vessel speed), maximum risk along the route and time-of-passage risk.

## 71.2 Rules

- The LLM may explain the route but **must not invent the path**.
- If no allowed path exists, the result is "No safe route found" with the blocking reasons.
- The route is shown on the map with per-segment risk colours.
- Vessel constraints (range, speed, minimum depth) come from the vessel profile.

## 71.3 Future

Advanced route optimization (time-dependent routing, fuel optimization, multi-stop trips) remains a later phase.

---

# 72. Historical and Trend Intelligence

The Trend Agent answers questions forecasts cannot, such as:

> "Why has fish productivity declined in a particular coastal region?"

## 72.1 Method

1. Use historical SST, chlorophyll and other configured ocean/ecosystem time series for fixed sampled points.
2. **Calculate first**:
   - Monthly means
   - Anomalies relative to a baseline period
   - Trend direction and magnitude
   - Unusual events (marine heatwaves, low-chlorophyll periods)
3. **Then explain** — the LLM explains the calculated results.

## 72.2 Rules

- The LLM does not compute statistics.
- The explanation clearly separates **correlation from cause**. ORCA can say "chlorophyll was 30% below its usual level", not "this proves overfishing".
- Factors ORCA cannot observe (fishing pressure, market, policy) are named as unobserved.
- One year of monthly data is sufficient for an initial demonstration; multi-year analysis is a later phase.

Output: trend charts plus an evidence-based explanation.

---

# 73. Report / Marine Advisory

The Report Agent creates a shareable marine advisory from **stored evidence only**.

The advisory includes:

- Location (original and snapped)
- Interpreted time window
- Activity and vessel
- Recommendation (short and detailed)
- Risk per point
- Official warnings
- Hazards
- GIS restrictions
- PFZ information
- Best time
- Data quality
- Sources and retrieval times
- Analysis ID and generation time

## 73.1 Formats

- Shareable web view
- Downloadable PDF
- Short text version for SMS/WhatsApp sharing

The advisory is produced in the response language.

---

# 74. Natural-Language Location Search

Users can enter:

- Chennai
- Mumbai coast
- Paradip
- Kochi
- Visakhapatnam
- A port or harbour
- A coastal landmark
- A place name in a regional language

The system resolves the place to coordinates.

If needed, the location is snapped offshore (Section 13.3).

The validated coordinate becomes the centre of the nine-point grid.

---

# 75. Multilingual ORCA

Language is a first-class property.

ORCA responds in the automatically detected language unless the user supplies an override.

The user receives:

- Recommendation
- Key findings
- Chat
- Alerts
- Geofence warnings
- Reports
- Explanations
- Voice output

in the response language.

Scientific data remains language-independent.

## 75.1 Translation Strategy

- LLM-generated text is generated directly in the response language.
- Fixed UI strings and alert/geofence templates are pre-translated and reviewed.
- Place names, point IDs and units are kept consistent across languages.

---

# 76. Voice Support

Voice is prioritized for fisherman-facing interaction.

Bhashini (Government of India language platform) is the preferred integration for supported Indian languages, providing speech recognition, translation and text-to-speech.

## 76.1 Flow

**Voice → Frontend (audio capture) → Backend → Bhashini Speech Recognition → Language Detection → Existing ORCA Pipeline → Response Text → Bhashini Text-to-Speech → Backend → Frontend (audio playback)**

## 76.2 Rules

- Speech service calls go through the **Backend**, because they require server-side credentials. This respects the rule that no keys reach the Frontend.
- Browser built-in speech features may be used as an optional on-device fallback.
- Voice does not create a separate reasoning architecture.
- The transcript is shown so the user can correct misrecognition.

---

# 77. Fisherman-Friendly Interface

Many users are fishermen using phones in difficult conditions.

The interface should provide:

- Traffic-light colours (green / yellow / orange / red) for risk levels
- Large icons for wind, waves, rain, lightning and warnings
- The one-line recommendation shown first
- A "Listen" button for spoken summary
- Technical values hidden behind a "Details" expander
- Large touch targets
- High-contrast mode for sunlight
- Minimal typing: voice input and one-tap common questions

---

# 78. Explainable AI Dashboard

For every point, show:

### Point

P3

### Score

84

### Level

UNSAFE

### Score Breakdown

- Baseline: 78
- LLM adjustment: +6 (reason shown)
- Official warning floor: none
- Hard rule floor: none

### Why

- Strong wind
- Reduced visibility
- Unfavourable marine conditions
- Other relevant evidence
- Data-quality limitations

The user should be able to understand the decision.

---

# 79. Visible Agentic Reasoning

Judges and users should see ORCA's agentic behaviour.

The dashboard shows:

- Detected language and intent
- Interpreted location and time
- Planner's selected agents with reasons
- Skipped agents with reasons
- Data plan (sources chosen, fallbacks used)
- Execution timeline with durations
- Which constraints were applied

Running two different queries shows two different agent sets, demonstrating real autonomous planning.

---

# 80. Data Quality Dashboard

Show source availability.

Example:

- Weather — Available
- Ocean — Partial
- Tide — Missing
- Cyclone/Warnings — Available (IMD bulletin, 10:30 IST)
- PFZ — Available (INCOIS, valid today)
- GIS — Available
- Ecosystem — Available (cached, 1 day old)

This makes uncertainty visible.

---

# 81. Evidence/Source Panel

The UI provides an expandable evidence section.

Users can see:

- Data source and authority
- Product/bulletin identifier
- Retrieval time
- Valid time
- Parameter and value with unit
- Relevant evidence
- Data status
- Which recommendation statement it supports

This supports trustworthy AI.

---

# 82. Interactive Map

The analysis points appear on a map.

The map can display:

- Original and snapped location
- Centre point
- Eight surrounding points
- `not_applicable` and `prohibited` markers
- Risk score and level per point
- Preferred and worst point
- PFZ
- GIS restrictions
- MPA and ecologically sensitive zones
- Maritime boundaries
- Ports
- Cyclone track and warning areas
- Route with segment risk colours
- Regional scan heatmap
- Live GPS position in geofence mode

The Frontend displays Backend results.

It does not calculate the risk.

---

# 83. Charts

The dashboard includes charts in addition to the map.

- Hourly wind speed
- Hourly wave height
- Hourly tide level
- Hourly risk score for the preferred point
- Per-point risk bar chart
- Best-time windows highlighted on hourly charts
- Historical trend and anomaly charts when requested

## 83.1 Rules

- Charts use real analysis timestamps and units.
- Missing data appears as gaps, never interpolated silently.
- Threshold lines (caution/unsafe) for the user's vessel are drawn on wind and wave charts.

---

# 84. Scenario Comparison

Users can compare scenarios.

Example:

### Morning

Risk = 32

### Evening

Risk = 72

ORCA explains why conditions differ.

This is implemented by running the same Planner/agent pipeline with different inputs:

- Different time windows
- Different vessel types
- Different nearby locations

Each scenario is a separate analysis linked by `parent_analysis_id`.

---

# 85. Low-Connectivity Operation

Connectivity at sea and in coastal villages is often poor.

## 85.1 Behaviour

- The Frontend is a PWA and works offline where practical.
- It preserves the last successful:
  - Advisory
  - Recommendation
  - Risk summary
  - Best time
  - Freshness timestamp
- Boundary layers for the user's region can be downloaded for offline geofence checks.
- Short recommendations fit SMS for later SMS delivery.

## 85.2 Rule

Cached safety information must be clearly labelled with its age and must never be presented as live.

Example:

> "Last updated 6 hours ago. Conditions may have changed."

---

# 86. Conversational Chatbot

Chat is ORCA's primary entry point, matching the problem statement's focus on a conversational platform.

The **User Interaction (Chat) Agent** handles every chat message.

Dashboard analyses and chat messages enter the **same** Planner pipeline. A dashboard request is a structured version of a chat request.

The chatbot supports three cases.

---

# 87. Chat Case 1 — Analysis First, Chat Later

User:

1. Opens ORCA.
2. Runs an analysis.
3. Receives `analysis_id`.
4. Opens chatbot.

The chatbot uses the analysis context.

The user can ask:

> Why is P3 unsafe?

or:

> Which point should I choose?

or:

> What caused the high risk?

The user does not need to repeat the entire analysis.

---

# 88. Chat Case 1 Context

The Backend retrieves the analysis using `analysis_id`.

The chatbot context can include:

- Original request
- Detected language and intent
- Original and snapped location
- Interpreted time window
- Activity and vessel
- Selected agents and reasons
- Planned points
- Agent results
- Risk scores with breakdown
- Official warnings
- Risk explanations
- GIS constraints
- PFZ
- Ecosystem
- Best time
- Final decision
- Data quality
- Relevant evidence

Large datasets are summarized for the LLM while detailed stored data remains accessible.

---

# 89. Chat Case 2 — Direct Chat

User directly opens the chatbot without running an analysis.

Example:

> "Is fishing safe near Mumbai tomorrow morning?"

Flow:

**Frontend → Backend → Planner/Orchestrator**

The Planner then:

1. Detects language.
2. Classifies intent.
3. Resolves location.
4. Validates and snaps location if needed.
5. Interprets time.
6. Generates points.
7. Selects agents.
8. Runs selected agents.
9. Risk Agent calculates risk.
10. Decision Agent generates recommendation.
11. Backend stores the analysis.
12. Chatbot responds in the user's language, with a link to the full dashboard view.

This uses the same ORCA analysis pipeline.

A quick-information chat question ("What is the tide tomorrow?") runs only the Tide Agent.

---

# 90. Chat Case 3 — Follow-Up Requires New Data

User first asks:

> Is fishing safe tomorrow morning?

Then asks:

> What about tomorrow evening?

The Chat Agent remembers the original analysis and detects that the requested time changed.

## 90.1 Follow-Up Decision

For each follow-up, the Chat Agent decides:

| Situation | Action |
|---|---|
| Answer exists in stored analysis ("Why is P3 unsafe?") | Answer from stored evidence |
| Time, location, activity or vessel changed | Re-plan through Planner |
| Stored data is older than its freshness limit | Re-plan through Planner |
| Request needs a new capability (route, report, trend) | Re-plan with the new intent |

The new analysis is linked to the same conversation and to the parent analysis.

This prevents the chatbot from giving an outdated answer.

---

# 91. Chat Memory

MongoDB stores:

- Conversation ID
- Analysis IDs
- User messages
- ORCA responses
- Timestamps
- Detected language per message
- Response language
- Analysis references
- Relevant context (current location, activity, vessel)

The user can continue a conversation later.

---

# 92. Chat Evidence

If the user asks:

> Why is P3 unsafe?

The chatbot uses stored Risk and agent evidence.

It does not invent a new score.

If required data is unavailable, it says so.

If the follow-up requires new information, it triggers a new Planner execution.

---

# 93. Future Data Fields

The architecture allows fields such as:

Current:

- Wind, gusts, precipitation, visibility, lightning
- Wave, swell, current, SST, salinity
- Tide level and phase
- Cyclone and official warnings
- PFZ indicators
- GIS restrictions
- Chlorophyll, oxygen, nutrients

Future:

- Current direction detail
- Wave direction detail
- Turbidity
- Water quality indices
- Salinity profile (depth-resolved)
- Marine traffic density
- Species distribution
- Pollution indicators
- Sediment data

The Backend does not require a major redesign for every new field, because agent results are stored as flexible documents (Section 45) and new fields simply appear in the relevant agent's output.

---

# 94. Future Agent Expansion

Potential future agents:

- Water Quality Agent
- Biodiversity Agent
- Marine Traffic Agent
- Navigation Agent
- Pollution Agent
- Fish Species Agent
- Wave Agent (if wave detail is split from Ocean)
- Oil Spill Agent
- Shipping Agent
- Sediment Agent

The Planner discovers them through the Agent Registry (Section 22).

Adding one follows the steps in Section 23.

---

# 95. Performance Optimization

Important optimizations:

- Parallel independent agents
- Regional data reuse (fetch once, localize to points)
- Batch data requests
- Caching of reference layers and slow-changing datasets
- Async execution throughout the AI Service
- Compact LLM context (summaries, not raw datasets)
- Dynamic agent selection (Section 21)
- Intent-based pipeline routing (Section 12)
- Fast model for Planner; stronger model reserved for Risk/Decision
- Per-agent timeouts (Section 34)

The system does not run expensive agents that do not contribute to the user's query.

---

# 96. Regional vs Point Data

Not every data source needs nine independent external requests.

## Regional Data

Can often be fetched once:

- Tide
- Cyclone and official warnings
- PFZ
- Ecosystem datasets

Then localized to the sampled points when appropriate.

## Point/Grid Data

May need spatially distinct retrieval:

- Weather
- Ocean
- GIS

The actual strategy depends on the data provider and is recorded per source in the Data Catalog (Section 19.1).

---

# 97. Caching

Potential cache targets:

- GIS reference layers
- Ports
- EEZ geometry
- MPA and ecologically sensitive zone geometry
- Weather forecasts
- Ecosystem datasets
- Cyclone and warning bulletins
- Historical time series used by the Trend Agent

Safety-critical data must respect freshness requirements (Section 19.1).

Stale data must never be presented as live data; it is labelled with its age (Section 85.2).

---

# 98. Security

Internal AI Service endpoints must be protected.

Recommended measures:

- Internal authentication/shared secret between Backend and AI Service
- Private network where deployed
- Request validation
- Rate limiting
- CORS restrictions
- No LLM API keys in the Frontend
- No Bhashini or other speech-service keys in the Frontend
- No database credentials in the Frontend
- No internal service credentials in the Frontend
- Signed, short-lived tokens for internal progress callbacks
- Input sanitization for chat and query text before it reaches any tool

---

# 99. MongoDB Architecture

MongoDB stores the complete analysis lifecycle across several logical collections.

## 99.1 `analyses`

- `analysis_id`
- `conversation_id`, `parent_analysis_id`, `alert_subscription_id`
- `request` (original input)
- `detected_language`, `override_language`, `response_language`
- `primary_intent`, `secondary_intents`
- `location` — `{ original, validated, snapped: bool }`
- `time_window` — `{ local, utc }`
- `activity`, `vessel_type`
- `status` (`queued` / `running` / `completed` / `partial` / `failed`)
- `error_category`
- `planner_result` (execution plan with reasons)
- `selected_agents`, `skipped_agents`
- `agent_statuses`
- `sampling` — `{ mode, radius_km, points }`
- `points` — array of `{ point_id, lat, lon, point_status }`
- `data_quality`
- `execution_trace`
- `created_at`, `updated_at`, `completed_at`

## 99.2 `agent_results`

- `analysis_id`, `agent_name`
- Raw and normalized output per point/region
- Provenance per field
- Status, error, duration

## 99.3 `risk_results`

- `analysis_id`
- Per point: baseline, adjustment, floors, final score, level, hourly series, reasoning, key findings, confidence, data quality

## 99.4 `decisions`

- `analysis_id`
- Detailed recommendation, one-line recommendation, recommendation type
- Preferred point, worst point
- Key findings
- Best-time windows
- All point scores (as received from Risk)

## 99.5 `gis_layers`

- Layer name, version, source, geometry (GeoJSON with `2dsphere` index), constraint type, last updated

## 99.6 `alert_subscriptions`

- Subscriber, location, activity, vessel, language, alert types, threshold, channel, quiet hours

## 99.7 `alert_events`

- Subscription ID, triggered analysis ID, level, message, sent status, deduplication key, timestamp

## 99.8 `conversations`

- `conversation_id`, messages, analysis references, language history

## 99.9 `routes`

- Route request, corridor grid reference, path waypoints, blocking reasons, generated advisory

## 99.10 `reports`

- Report ID, analysis ID, format, content, language, generated timestamp



## 99.11 `geofence_events`

- `device_id` (nullable — used for deduplication)
- `lat`, `lon`
- `state` (`clear` / `approaching` / `inside`)
- `layer_name`, `constraint_type` (nullable — populated when `state` != `clear`)
- `distance_km`, `bearing_deg`
- `deduplicated` (bool)
- `created_at`

## 99.12 `users`

- `user_id`
- `role` (`fisherman` / `researcher` / `coastal_authority` / `disaster_management` / `maritime_operator` / `admin`)
- `invite_code_used`
- `display_name`
- `preferred_language`
- `default_vessel_type`, `default_activity`
- `home_location` — `{ original, validated, snapped: bool }`
- `subscriber_id` (nullable — links to `alert_subscriptions`)
- `created_at`, `last_active_at`


MongoDB uses flexible/document structures for agent-specific and future fields throughout.
---

# 100. Agent Trace

The Backend maintains an execution trace per analysis.

Useful information:

- Agent/stage
- Selected (true/false) and selection reason
- Status
- Status code
- Started time
- Completed time
- Duration
- Retry count
- Error and `error_category`
- Optional summary

This supports:

- Frontend progress and the "visible reasoning" panel (Section 79)
- Debugging
- SIH demonstration
- Auditability
- Accuracy validation against real events (Section 106)

---

# 101. Final Result Persistence

When the intent-specific final stage finishes (Decision, Trend explanation, Route explanation, or Report):

**AI Service → Backend**

Backend stores:

- Final response
- All relevant agent results
- Risk results (if computed)
- Sampled points
- GIS/PFZ/Ecosystem information
- Official warnings applied
- Errors
- Data quality
- Execution trace

Backend then exposes the completed result to the Frontend and to Chat.

---

# 102. Important Communication Rule

The correct communication architecture is:

**Frontend → Backend**

**Backend → AI Service**

**AI Service → Backend**

**Backend → Frontend**

Not:

**Frontend → AI Service**

**Frontend → Bhashini / any external provider directly**

This protects internal services and credentials.

---

# 103. Recommended Backend APIs

All APIs are versioned (for example, `/api/v1/...`).

## Analysis

- `POST /api/v1/analysis` — create analysis (accepts query text and/or structured fields)
- `GET /api/v1/analysis/:analysis_id` — get full result
- `GET /api/v1/analysis/:analysis_id/status` — poll status/progress

## Chat

- `POST /api/v1/chat/message` — send chat message
- `GET /api/v1/chat/:conversation_id` — get conversation
- `GET /api/v1/chat/:conversation_id/history` — get history

## Map / GIS

- `GET /api/v1/map/layers` — reference map layers
- `POST /api/v1/geofence/check` — live GPS geofence check

## Route

- `POST /api/v1/route` — request a route
- `GET /api/v1/route/:route_id` — get route result

## Report

- `GET /api/v1/report/:analysis_id` — generate/fetch shareable advisory

## Trend

- `POST /api/v1/trend` — request historical/trend analysis

## Alerts

- `POST /api/v1/alerts/subscriptions` — create subscription
- `GET /api/v1/alerts/subscriptions/:id` — get subscription
- `PATCH /api/v1/alerts/subscriptions/:id` — update subscription
- `DELETE /api/v1/alerts/subscriptions/:id` — remove subscription

## Voice

- `POST /api/v1/voice/query` — audio in, audio + text out (proxies Bhashini)

## Internal (AI Service ↔ Backend only)

Both directions of this internal channel must be named; only the reverse direction was previously specified.

**Hosted by AI Service, called by Backend:**

- `POST /internal/v1/execute` — hands off an accepted analysis for the AI Service to run
  - Request body: `contracts/api/AnalysisExecutionRequest.json`
  - Response: `202 Accepted` immediately; the AI Service does not block on this call. Execution proceeds asynchronously, with progress and the final result reported back via the two endpoints below.
  - Auth: same internal signed short-lived token used for the reverse calls (Section 98).
  - Idempotency: if the Backend retries with an `analysis_id` that is already `running` or `completed`, the AI Service returns `200` and does not start a second execution.

**Hosted by Backend, called by AI Service:**

- `POST /internal/v1/progress` — AI Service progress update
- `POST /internal/v1/result` — AI Service final result

---

# 104. Analysis Completion Rules

Completion depends on the classified intent.

### Quick Information

Planner + required information agent(s) + validated result are sufficient.

### Point Safety / Regional Search

Planner + required agents + Risk (baseline, warnings, hard rules, bounded LLM) + Decision (hard-constraint selection) are required.

### Route Planning

Planner + environmental/GIS data + risk-cost grid + Route Tool are required, followed by Decision/Report explanation when requested.

### Historical/Trend

Planner + historical data + Trend calculations + explanation/report when requested.

### Rules

- If an optional selected agent fails but sufficient evidence remains, status may be `partial`.
- If a mandatory safety agent (Weather, Ocean, or the official-warning check) fails, no point may be rated SAFE; status becomes `partial` at best, with the constraint from Section 50 applied.
- If the Planner fails, execution stops and `error_category = planner_failure` is reported.
- If the Risk stage fails for a safety request and cannot be repaired, ORCA falls back to the deterministic baseline and floors rather than fabricating a recommendation (Section 56.5).
- If the Decision stage fails, Risk and agent results are preserved and a final-decision failure is reported; the user still sees per-point scores and warnings.

---

# 105. Demo / Mock Data Mode

For SIH demonstration, a Mock Data Service is highly useful.

Recommended scenarios:

- Safe
- Caution
- Unsafe
- Dangerous
- Partial data
- Agent failure / timeout
- **Official warning override** (baseline says CAUTION, warning forces DANGEROUS)
- **Low-risk point inside a prohibited GIS zone** (must not be recommended)
- **Land point inside a valid grid** (marked `not_applicable`)
- **Coastal place requiring offshore snapping**
- **Geofence approach warning**
- **No allowed point / do-not-venture outcome**
- **Historical replay of a real past cyclone event** (see Section 106)

This allows demonstration of:

- Dynamic agent selection
- Successful execution
- Partial failure
- Risk variation
- Decision variation
- Hard-constraint enforcement
- Live progress
- Error handling

The Mock Data Service imitates real agent/data interfaces so it can be swapped for real sources without code changes elsewhere.

---

# 106. Real Data Integration and Validation

Mock sources are replaceable by real sources through the adapter pattern (Section 24.1).

**Mock Weather → Real Weather (IMD / Open-Meteo)**

**Mock Ocean → Real Ocean (INCOIS OSF / Copernicus Marine)**

**Mock GIS → Real GIS (Marine Regions / WDPA)**

**Mock PFZ → Real PFZ (INCOIS)**

**Mock Ecosystem → Real Ecosystem (MOSDAC / Copernicus Marine)**

The Planner/Risk/Decision architecture remains unchanged.

## 106.1 Accuracy Validation

To build trust, ORCA's historical outputs are compared against real, documented events, for example Cyclone Michaung (Chennai coast, December 2023).

The comparison checks whether ORCA's risk levels for that period would have matched the official IMD/INCOIS warnings that were actually issued, and the agreement rate is reported.

This also doubles as a compelling demonstration scenario.

---

# 107. Observability

Logs include:

- `analysis_id`
- Agent/stage
- Status
- Status code
- Start time
- End time
- Duration
- Selected agents
- Skipped agents with reasons
- Failed agents with `error_category`
- Retry counts
- Constraint floors applied

Logs never include:

- API keys
- Passwords
- Private credentials
- Full GPS trails beyond what is needed for geofence auditing (subject to configured retention)

---

# 108. Testing

## Language and Intent

Test:

- Native-script queries in each supported language
- Romanized queries
- Code-mixed queries
- Override vs. detected language
- Each intent classification with representative queries
- Compound-intent queries

## Location

Test:

- Valid coordinates
- Invalid latitude
- Invalid longitude
- Land coordinate requiring snapping
- Land coordinate not eligible for snapping
- Unsupported location
- Invalid place name
- Ambiguous place name

## Time

Test:

- Explicit date/time
- "Tomorrow morning"-style expressions
- Overnight windows
- Requests beyond the forecast horizon
- Requests in the past (routed to historical/trend)

## Planner

Test:

- Three-agent selection
- All-agent selection
- Minimal selection
- Mandatory-agent enforcement
- Future agent selection

## Grid / Sampling

Test:

- Centre remains the validated (possibly snapped) coordinate
- Nine points generated for local mode
- Configurable distance
- Stable point IDs
- Land points marked `not_applicable`
- Regional, route and historical sampling modes

## Agents

Test:

- Success
- Partial
- Failure
- Timeout
- Missing data
- Fallback source activation

## Risk

Test:

- Every applicable point receives a score
- Score is 0–100
- Baseline reproducibility (same input → same baseline)
- Official warning floor enforcement
- Hard rule floor enforcement
- LLM adjustment stays within the configured band
- LLM cannot cross a level boundary downward
- Risk level valid
- Reasoning exists
- Confidence exists and drops with missing data

## Decision

Test:

- Preferred point excludes prohibited/DANGEROUS points
- Worst point
- All Risk scores preserved exactly
- No-allowed-point / do-not-venture outcome
- Detailed recommendation
- Short recommendation
- Key findings
- Best-time window calculation

## Route

Test:

- Route avoids GIS-prohibited polygons
- Route avoids DANGEROUS cells
- Route respects vessel minimum depth
- No-safe-route outcome

## Trend

Test:

- Anomaly calculation against baseline period
- Explanation does not overstate causation

## Backend

Test:

- `analysis_id` uniqueness
- Progress updates
- Point matching
- Partial persistence
- Final persistence
- Internal endpoint protection
- Geofence check latency
- Alert scheduler triggering and deduplication

## Chat

Test:

- Analysis-first chat
- Direct chat
- Follow-up answered from stored evidence
- Follow-up triggering re-planning
- Conversation persistence
- Language consistency across a conversation

## Validation Layer

Test:

- Invalid Planner/Risk/Decision output triggers repair retry
- Persistent invalid output produces a safe fallback, not fabricated data

---

# 109. Recommended SIH Features

## Core

1. Automatic language detection
2. Intent classification and pipeline routing
3. Dynamic Planner
4. Dynamic agent selection with visible reasons
5. Nine-point spatial reasoning
6. Parallel execution
7. Live agent status
8. Hybrid risk scoring (baseline + official warning + hard rules + bounded LLM)
9. GIS hard-constraint decision-making
10. Evidence-based decision
11. Structured output validation
12. Chat memory (three cases)

## Marine Intelligence

13. Weather
14. Ocean
15. Tide
16. Cyclone and official warnings
17. PFZ
18. Ecosystem
19. GIS
20. Marine geofencing (live GPS)
21. Real Indian data sources (INCOIS, IMD, MOSDAC, Bhuvan/Bhoonidhi) where accessible

## User Experience

22. Natural-language place search with offshore snapping
23. Multilingual output
24. Interactive map
25. Explainable AI with score breakdown
26. Source/evidence panel
27. Data-quality panel
28. Best-time recommendation
29. Hourly and per-point charts
30. Fisherman-friendly simple UI
31. Voice interaction (Bhashini)

## Advanced

32. Proactive alerts
33. Scenario comparison
34. Safe route planning
35. Historical/trend analysis
36. Shareable advisory reports
37. Low-connectivity/offline support
38. Future specialized agents

---

# 110. Feature Priority for SIH

## Highest Priority (demonstrates required capabilities and trustworthiness)

1. **Hybrid Risk + Official Warning Override** — reproducible safety scoring; the model can never contradict an authoritative warning.
2. **GIS Hard Constraints + Live Geofencing** — prevents legally/spatially invalid recommendations; supports the required "approaching boundary" notification.
3. **Automatic Language Detection + Voice** — supports native, Romanized and mixed-language fisherman interaction, a required capability.
4. **Intent-Based Pipeline Routing** — prevents simple queries from triggering unnecessary expensive pipelines; shows real planning.
5. **Real Indian Data Sources** — INCOIS, IMD, MOSDAC, Bhuvan/Bhoonidhi where access is available, matching the ISRO context.
6. **Dynamic Agent Selection with Visible Reasoning** — the clearest demonstration of agentic AI.
7. **Structured Output Validation** — protects the whole system from LLM hallucination.

## High Priority

8. Nine-point grid and coastal snapping
9. Live agent status
10. Risk score for every point with breakdown
11. Evidence-based decision with hard-constraint point selection
12. Best-time recommendation and hourly charts
13. Basic proactive alerts
14. Basic route planning
15. Confidence/data quality
16. Chat memory (all three cases)

## Supporting

17. PFZ intelligence
18. Trend/historical analysis
19. Shareable report
20. Low-connectivity support
21. Scenario comparison

---

# 111. Phase 1 — Core Prototype

Implement:

- Frontend, Backend, AI Service, MongoDB
- Automatic language detection (basic)
- Intent classification (core intents)
- Planner Agent with location validation, snapping and time interpretation
- Python nine-point sampling tool
- Dynamic agent selection with reasons
- Weather, Ocean, Tide, Cyclone/official warnings, Ecosystem, Fishing/PFZ, GIS agents
- Deterministic Risk baseline + official-warning override + hard rules + bounded LLM
- Structured output validation for Planner/Risk/Decision
- Decision Agent with GIS hard-constraint point selection
- Best-time recommendation
- Live progress
- Partial failure handling
- Dashboard with map, evidence panel and data-quality panel
- Chat Case 1 and Chat Case 2
- Mock Data Service covering all core scenarios in Section 105

---

# 112. Phase 2 — Intelligence and Required Capabilities

Add/complete:

- Hourly wind/wave/tide charts and per-point risk bar chart
- Basic proactive marine alerts (scheduled)
- Live marine geofencing (GPS-based)
- Basic safe route planning (A*/Dijkstra)
- Bhashini-based voice support
- Vessel-type safety context
- GIS reference layers with geospatial indexes
- Evidence panel refinement
- Multilingual coverage expansion
- Scenario comparison
- Chat Case 3 (follow-up re-planning)
- Report Agent (shareable advisory)
- Low-connectivity/PWA improvements
- Fisherman-friendly simplified UI

---

# 113. Phase 3 — Advanced ORCA

Add:

- Advanced trip and multi-stop route planning
- Time-dependent and fuel-aware route optimization
- Multi-year historical analysis
- Advanced Trend Agent capabilities (marine heatwave detection, seasonal decomposition)
- Additional specialized agents (water quality, biodiversity, marine traffic, pollution, etc.)
- Additional source adapters
- Advanced notification channels (SMS, WhatsApp, IVR)
- Advanced offline synchronization
- User preference learning
- Advanced scenario simulation
- Accuracy validation dashboard against historical real events

Basic alerts, geofencing, route planning, voice, charts and trend analysis are introduced in Phase 2 so the required problem-statement capabilities are demonstrable early, not deferred to the end.

---

# 114. Recommended Technical Architecture

## Frontend

Responsibilities:

**Collect → Display → Interact**

Technologies can include:

- React
- Vite
- Leaflet or another map library
- Charting library (for hourly/trend/risk charts)
- PWA/service-worker support for offline caching
- API client
- State management
- Chat UI
- Voice capture/playback UI

## Backend

Responsibilities:

**Receive → Validate → Identify → Persist → Track → Serve**

Technologies can include:

- Node.js
- Express
- MongoDB with `2dsphere` geospatial indexes
- Mongoose
- Authentication/security middleware
- Job scheduler for alerts (e.g., cron-based worker)
- Bhashini proxy integration

## AI Service

Responsibilities:

**Detect Language → Classify Intent → Plan → Discover Data → Select → Fetch → Calculate Baseline → Apply Constraints → Reason → Validate → Score → Route/Decide/Report**

Technologies can include:

- Python
- FastAPI
- LangGraph or equivalent orchestration
- Gemini LLM (fast model for Planner; stronger model for Risk/Decision)
- Pydantic for structured output validation
- Async execution
- Agent registry (config-driven, e.g., YAML)
- A*/Dijkstra library or custom implementation for routing
- Geospatial library (e.g., Shapely, GeoPandas) for GIS constraint checks

---

# 115. Prompt Architecture

Prompts are separate, editable files, not hardcoded in application logic.

## Planner Prompt

Defines:

- Language detection guidance
- Intent classification rules
- Agent capabilities
- Selection rules and mandatory-agent policy
- Query interpretation
- Location behaviour, including snapping
- Date/time interpretation
- Activity and vessel context

## Risk Prompt

Defines:

- Safety reasoning
- How to explain the deterministic baseline
- Bounded adjustment rules (±band, no downward level crossing)
- Risk levels
- Evidence requirements
- Missing-data rules
- Confidence rules
- Per-point reasoning

## Decision Prompt

Defines:

- Risk + GIS + PFZ + Ecosystem reasoning
- Hard-constraint awareness (never recommend a prohibited point)
- Detailed recommendation
- Short recommendation
- Key findings
- Score preservation (never modify Risk scores)
- Best-time explanation
- Evidence requirements
- No-allowed-point wording

## Trend Prompt

Defines:

- Explaining calculated anomalies/trends
- Correlation vs. causation caution
- Naming unobserved factors

## Report Prompt

Defines:

- Advisory structure and tone
- Language and audience (fishermen, researchers, authorities)

## Chat Prompt

Defines:

- Conversation memory
- Analysis context use
- Follow-up vs. re-plan detection
- Evidence use
- Language consistency

Prompts can be improved without changing the application architecture.

---

# 116. Core Design Principles

## Modular

Every major capability is isolated.

## Agentic

The Planner dynamically chooses agents and capabilities, and shows its reasoning.

## Explainable

Decisions contain evidence, reasoning and a transparent score breakdown.

## Extensible

New agents, capabilities and data fields can be added through the registry and catalog without redesign.

## Fault Tolerant

Partial failures do not erase successful data; mandatory-safety failures never produce a false SAFE result.

## Deterministic Where It Matters

Grid generation, risk baseline, official-warning floors, hard rules, GIS constraints, geofence checks, best-time selection and route pathfinding are deterministic. The LLM interprets and explains; it does not compute safety-critical numbers freely.

## Spatially Aware

Point and region data use a consistent `point_id` scheme.

## Temporally Aware

Date and time affect execution, and interpreted windows are always shown to the user.

## Multilingual by Default

Language is detected automatically, not requested.

## Secure

Frontend never accesses internal AI, database or third-party credentials directly.

## Auditable

Analyses, conversations, agent traces and alert events are stored.

## User-Centric

Results are understandable to fishermen, researchers, coastal authorities, disaster management agencies and maritime operators — the exact stakeholders named in the problem statement.

---

# 117. Final ORCA Architecture

The three major components remain:

## Frontend

**Collect → Display → Interact**

↓

## Backend

**Receive → Validate → Identify → Persist → Track → Deliver**

↓

## AI Service

**Detect Language → Classify Intent → Plan → Discover Data → Select → Fetch → Calculate Baseline → Apply Constraints → Reason → Validate → Score → Route/Decide/Report**

↓

## Backend

**Store → Track → Serve**

↓

## Frontend

**Visualize → Explain → Chat → Alert**

---

# 118. Final End-to-End Architecture

The complete analysis flow is:

**User**

↓

**Frontend**

↓

**Backend — structural validation**

↓

**Create `analysis_id` + MongoDB record**

↓

**AI Service**

↓

**Planner/Orchestrator**

↓

**Detect language → Classify intent**

↓

**Validate/resolve place or coordinate**

↓

**If invalid → stop + 422 error**

↓

**If valid coastal place on land → offshore snapping**

↓

**Interpret time window (local + UTC)**

↓

**Select sampling mode → Python spatial sampling tool**

↓

**Mark land points `not_applicable`**

↓

**Data Discovery**

↓

**Planner LLM → select required agents with reasons → plan validation**

↓

**Run only selected agents, independent ones in parallel**

↓

**Agent status/data → Backend → Frontend**

↓

**Weather / Ocean / Tide / Cyclone+Warnings / Ecosystem / Fishing-PFZ / GIS**

↓

**If safety-relevant intent:**

↓

**Risk Agent — Official Warning → Hard Rules → Deterministic Baseline → Bounded LLM Interpretation**

↓

**Schema validation of Risk output**

↓

**0–100 score + level + reasoning + key findings for every applicable point**

↓

**Decision Agent — hard-constraint point selection (exclude land/prohibited/DANGEROUS)**

↓

**Decision LLM — Risk + GIS + PFZ + Ecosystem**

↓

**Schema validation of Decision output**

↓

**Detailed recommendation**

↓

**One-line recommendation**

↓

**Final key findings**

↓

**Best-time window**

↓

**All Risk point scores preserved exactly**

↓

**Backend**

↓

**MongoDB**

↓

**Frontend Dashboard / Map / Charts / Report**

↓

**Chatbot**

For non-safety intents (quick information, historical/trend, route), the flow branches after agent execution into the intent-specific stage defined in Section 104, skipping Risk/Decision where they are not required.

---

# 119. Final Chat Architecture

## Case 1 — Analysis First

User:

**Frontend → Backend → Planner → Agents → Risk → Decision**

↓

**`analysis_id`**

↓

**User opens Chat**

↓

**Backend retrieves analysis context**

↓

**Chat receives analysis memory**

↓

**User asks follow-up**

↓

**Chat answers using stored evidence**

---

## Case 2 — Chat First

User:

**Frontend Chat**

↓

**Backend**

↓

**Planner/Orchestrator**

↓

**Language detection → Intent classification**

↓

**Location validation (with snapping if needed)**

↓

**Time interpretation**

↓

**Sampling**

↓

**Selected Agents**

↓

**Risk (if safety intent)**

↓

**Decision (if safety intent)**

↓

**Backend**

↓

**MongoDB**

↓

**Chat Response**

---

## Case 3 — Existing Chat + New Data Requirement

User:

> "What about tomorrow evening?"

↓

Chat remembers the previous analysis.

↓

Detects the changed time requirement.

↓

Backend sends the updated requirement to the Planner.

↓

Planner selects required agents.

↓

New execution (Risk/Decision as needed).

↓

Backend stores the new analysis/context, linked via `parent_analysis_id`.

↓

Chat returns the updated evidence-based answer.

---

# 120. Non-Negotiable ORCA Rules

1. ORCA has three major parts: Frontend, Backend, AI Service.
2. Frontend communicates only with Backend, including for voice and any third-party service.
3. Backend creates the unique `analysis_id`.
4. Backend performs structural validation of the incoming request; the Planner performs semantic/location validation.
5. Planner detects language and classifies intent before agent selection.
6. Planner validates the actual location before expensive execution.
7. A genuinely invalid or unsupported location stops the execution flow with a 422 error.
8. A valid coastal place resolving to land is snapped to the nearest suitable offshore point rather than rejected; the user is told.
9. The validated (possibly snapped) coordinate is the centre of the local grid.
10. The local sampling mode produces the nine-point grid by default; other intents may use regional, route or historical sampling modes.
11. Points falling on land within a valid grid are marked `not_applicable` and excluded from marine agents and risk scoring without failing the analysis.
12. Grid/sampling distance, count, shape and algorithm are configurable and can change in the future.
13. The Planner has an editable LLM system prompt.
14. The Planner dynamically selects agents and capabilities, and records a reason for each selection and skip.
15. Only selected agents execute.
16. Mandatory safety agents (Weather, Ocean, Cyclone/official-warning check) are enforced by policy even if the LLM omits them for a safety intent.
17. Specialized agents remain responsible for their own domains.
18. Independent selected agents execute in parallel.
19. Agent progress is sent to Backend.
20. Frontend receives progress only through Backend.
21. Only selected agents appear as active status cards; skipped agents may appear collapsed with reasons.
22. Successful agent data is preserved even if another agent fails.
23. Backend matches point-level information using `point_id`.
24. Backend does not calculate risk, decide safety, or compute routes.
25. Risk uses a deterministic baseline, official-warning floors and hard-rule floors; the LLM provides bounded interpretation only, never a free-form score.
26. An applicable official hazardous warning can never be downgraded to SAFE by the model.
27. Risk score is generated for every applicable point, on a 0–100 scale with configurable level thresholds.
28. Risk Agent provides reasoning, key findings and confidence for every applicable point.
29. PFZ, GIS and Ecosystem are excluded from Risk Agent input; they are Decision Agent input.
30. Decision Agent receives Risk + GIS + PFZ + Ecosystem.
31. The preferred point is the lowest-risk point that is also applicable and not GIS-prohibited or DANGEROUS; GIS and official-warning constraints always override a numerically lower risk score.
32. If no point is allowed, the Decision Agent returns a "do not venture" outcome rather than recommending the least-bad point.
33. Decision Agent generates a detailed recommendation, a one-line recommendation and final key findings.
34. Decision Agent preserves Risk Agent scores exactly, without modification.
35. Best-time recommendation is calculated deterministically from hourly data as part of the core safety workflow, not merely explained by the LLM.
36. All Planner, Risk and Decision LLM outputs are validated against a schema before use; persistent validation failure produces a safe fallback, never fabricated data.
37. Backend stores individual agent results and the final Decision (or intent-specific) result.
38. MongoDB stores analysis history, conversation history, GIS layers, alert subscriptions/events, routes and reports.
39. Chat Case 1 uses the existing analysis context.
40. Chat Case 2 sends a direct chatbot query through the same Planner pipeline used by the dashboard.
41. Chat Case 3 re-plans through the Planner when a follow-up requires new or changed data.
42. Partial failures must not destroy successful results.
43. Missing data must never be fabricated; it reduces confidence and is disclosed.
44. Data provenance, including official-source authority and validity period, is retained for all safety-relevant data.
45. Internal AI Service progress and result endpoints must be protected and authenticated.
46. LLM, database, Bhashini and other third-party API keys must never reach the Frontend.
47. Future agents and capabilities are addable through the Agent Registry and Data Catalog.
48. Future data fields are storable without redesigning the entire database, because agent results use flexible document structures.
49. Future features extend the existing three-part architecture rather than creating a parallel architecture.
50. Language is detected automatically from the query; manual selection is only an override.
51. GIS restrictions are hard constraints on recommendations and routes, not merely explanatory evidence.
52. Live GPS geofence checks are pure deterministic geometry and do not require an LLM call.
53. Cached or stale safety information is clearly labelled with its age and is never presented as live.
54. Voice requests are proxied through the Backend; the Frontend never calls the speech service directly.
55. Route planning blocks GIS-prohibited polygons and DANGEROUS cells and never invents a path through them.

---

# 121. Revision Summary

This is a fully consolidated revision.

All improvements from the SIH26176 gap analysis — automatic language detection, intent-based routing, hybrid risk scoring with official-warning override, GIS hard constraints, live geofencing, basic alerts, basic route planning, charts, Indian data sources, structured output validation, vessel-type context, voice priority, low-connectivity support, historical/trend intelligence, report generation and visible agentic reasoning — are integrated directly into their relevant sections rather than appended as separate notes.

Superseded statements from earlier drafts (for example, "language is a user-selected input," "the Risk Agent uses an LLM to calculate the score," "a valid location always produces the nine-point grid," or "alerts/route/voice are future features") have been rewritten in place so the document no longer contradicts itself.

The three major parts — **Frontend, Backend, AI Service** — and the core principles of dynamic agent selection, point-based reasoning, evidence-based explainability and fault tolerance are preserved unchanged from the original architecture.

---

*End of Document*
