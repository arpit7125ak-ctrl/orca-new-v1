# 02: System Architecture & Processing Pipeline

---

## 1. High-Level Architecture Overview

ORCA is engineered as a decoupled, resilient, **three-tier asynchronous microservice architecture**:

```mermaid
flowchart TD
    subgraph Client Tier ["1. Client Tier (Vite / React SPA)"]
        UI["Mobile & Desktop Web UI (Port 5173)"]
        Map["Leaflet GIS Map Visualizer"]
        Voice["Bhashini Multilingual Speech Engine"]
    end

    subgraph Backend Tier ["2. Backend Tier (Node.js / Express)"]
        PublicAPI["Public Gateway API (Port 4000)"]
        InternalAPI["Internal Secure Gateway (Port 4100)"]
        Worker["Background Cron Worker Process"]
        DB[(MongoDB Database Port 27017)]
    end

    subgraph AIService Tier ["3. AI & Analysis Tier (Python / FastAPI)"]
        FastAPI["AI Service Gateway (Port 8000)"]
        Planner["Pipeline Planner & Corridors"]
        Agents["Parallel Multi-Agent Engine"]
        RiskEng["Deterministic Risk & Floor Evaluator"]
        LLM["Gemini Decision Synthesizer"]
    end

    subgraph ExternalFeeds ["4. Live Satellite & Meteorological Feeds"]
        OM_Weather["Open-Meteo Global Weather (ECMWF/GFS)"]
        OM_Marine["Open-Meteo Marine (Copernicus Wave)"]
        INCOIS_WFS["INCOIS GeoServer OGC WFS (PFZ Satellite)"]
    end

    UI -->|"HTTP / WebSockets"| PublicAPI
    PublicAPI -->|"Store request / state"| DB
    PublicAPI -->|"HTTP 202 Asynchronous Handoff"| FastAPI
    
    FastAPI --> Planner --> Agents
    Agents -->|"Live Metocean API"| OM_Weather
    Agents -->|"Live Waves & Currents"| OM_Marine
    Agents -->|"Query PFZ & GIS Layers"| DB
    
    Agents --> RiskEng --> LLM
    LLM -->|"Secure Callback (Signed JWT)"| InternalAPI
    InternalAPI -->|"Persist results"| DB
    
    Worker -->|"Daily 8 PM Cron / Alerts"| INCOIS_WFS
    Worker -->|"Sync Satellite Data"| DB
```

---

## 2. Why This Architecture? (Key Design Decisions)

### Decision A: Separation of Public API and Internal Server
* **Public Gateway (Port 4000):** Handles user requests, rate limiting, authentication, geofencing queries, and public traffic.
* **Internal Gateway (Port 4100):** Only accessible inside the internal private network. Listens specifically for AI Service callback payloads (`applyProgress`, `applyResult`). Protected by short-lived signed JWT tokens (`INTERNAL_TOKEN_TTL_SECONDS = 120`) to prevent unauthorized result injection.

### Decision B: Asynchronous HTTP 202 Non-Blocking Lifecycle
Marine multi-agent analyses take between 2 to 15 seconds to fetch multi-point satellite feeds, calculate numerical wave physics, and query LLMs. 
* **Never block the HTTP socket:** If a mobile phone on a boat makes a request, a synchronous HTTP connection would easily time out over 2G/3G.
* **Instead:** The backend immediately validates the request in **5 milliseconds**, saves a stub in MongoDB, and replies with **`HTTP 202 Accepted`** and a unique `analysis_id`.
* The frontend then polls or receives real-time WebSocket progress updates (`status: "running" -> stage: "ocean" -> stage: "risk"`).

### Decision C: Separate Worker Process for Background Tasks
* Background alert evaluations and daily INCOIS synchronization run inside `src/worker.js`.
* **Why not inside the API server?** In cloud deployments, if the API server is horizontally scaled to 3 instances (replicas), having a cron inside the web server would cause all 3 instances to fire simultaneously—sending fishermen triplicate alerts and spamming INCOIS servers. A dedicated worker guarantees **exactly one scheduler**.

---

## 3. The Complete 4-Step Analysis Pipeline

Whenever a fisherman asks for an advisory, the AI Service executes the following four-stage pipeline:

```mermaid
sequenceDiagram
    autonumber
    actor User as Fisherman / Client
    participant Back as Backend Gateway (4000)
    participant AI as AI Service (8000)
    participant Ext as Live Metocean & INCOIS
    participant Int as Internal Gateway (4100)
    participant DB as MongoDB

    User->>Back: POST /api/v1/analysis (lat, lon, vessel, activity)
    Back->>Back: Validate JSON Schema Contract
    Back->>DB: Save initial Analysis document (status=running)
    Back-->>User: HTTP 202 Accepted { analysis_id: "req_..." }
    
    Back->>AI: POST /run (handoff execution payload)
    
    rect rgb(240, 248, 255)
    Note over AI: 1. PLANNER STAGE
    AI->>AI: Determine operational corridor (Points P1..P8)
    AI->>AI: Calculate time window (UTC)
    end
    
    rect rgb(255, 250, 240)
    Note over AI, Ext: 2. PARALLEL DOMAIN AGENTS
    par Weather Agent
        AI->>Ext: Open-Meteo Global Weather (wind, gust, rain)
    and Ocean Agent
        AI->>Ext: Open-Meteo Marine (waves, swell, currents)
    and GIS Agent
        AI->>DB: MongoDB 2dsphere (EEZ boundary, MPAs, ports)
    and PFZ Agent
        AI->>DB: MongoDB pfz_advisories (Live satellite zones)
    and Cyclone Agent
        AI->>Ext: IMD Official Warning Bulletin checks
    end
    end
    
    rect rgb(240, 255, 240)
    Note over AI: 3. DETERMINISTIC RISK EVALUATION
    AI->>AI: Calculate risk score (0-100) per point
    AI->>AI: Apply Mandatory Floor Rules (e.g. Wave > 2m -> DO NOT GO)
    AI->>AI: Check Hard Exclusions (Inside prohibited zone)
    end
    
    rect rgb(255, 240, 245)
    Note over AI: 4. DECISION SYNTHESIS
    AI->>AI: Select preferred point (lowest risk, highest catch)
    AI->>AI: Synthesize natural language advisory via Gemini LLM
    end
    
    AI->>Int: POST /api/v1/internal/result (Internal Callback with JWT)
    Int->>DB: Persist RiskResult & Decision documents (status=completed)
    User->>Back: GET /api/v1/analysis/:id/result
    Back-->>User: HTTP 200 Final Advisory & Risk Maps
```

---

## 4. The Multi-Agent System Breakdown

Inside `orca/ai-service/app/agents/base.py`, seven specialized domain agents operate concurrently:

| Agent Name | Primary Data Source | Core Parameters Monitored | Mandatory for Safety? |
| :--- | :--- | :--- | :---: |
| **`weather`** | Live Open-Meteo Weather API | Wind speed ($\text{m/s}$), Wind gusts, Wind direction, Visibility ($\text{km}$), Precipitation ($\text{mm}$). | ✅ **Yes** |
| **`ocean`** | Live Open-Meteo Marine API | Wave height ($\text{m}$), Swell height ($\text{m}$), Swell period ($\text{s}$), Ocean currents ($\text{m/s}$), SST ($^\circ\text{C}$). | ✅ **Yes** |
| **`gis`** | MongoDB `gis_layers` (2dsphere) | Distance to International Maritime Boundary ($\text{km}$), Marine Protected Area incursions, water depth ($\text{m}$). | ✅ **Yes** |
| **`cyclone`** | IMD Bulletins / Cyclone Warnings | Active storm depressions, cyclone alerts, gale warnings. | ✅ **Yes** |
| **`pfz`** | Live INCOIS GeoServer WFS | Distance to satellite fishing zone ($\text{km}$), target species, SST thermal gradient, chlorophyll convergence. | ℹ️ *Catch (Advisory)* |
| **`tide`** | Harmonic Tidal Engine | Tidal height curve, high/low water times, tidal streams. | ℹ️ *Navigation* |
| **`ecosystem`** | MOSDAC / Biochemical Models | Dissolved oxygen ($\text{mmol/m}^3$), chlorophyll-a ($\text{mg/m}^3$). | ℹ️ *Environmental* |

---

## 5. The Contract Validation System

ORCA uses **strict JSON Schema contracts** stored in `orca/contracts/`:
* **Zero drift guarantee:** The exact same `.json` schema files are validated by **AJV** in Node.js and **jsonschema** in Python.
* Any request or payload that does not match the exact contract shape is rejected immediately at the boundary with an informative HTTP 400 error detailing the missing or invalid property.
