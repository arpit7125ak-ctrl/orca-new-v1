Re-verified against **ORCA_SIH26176_Detailed_Architecture_and_Features_FINAL.md (Revision 2.0)**. Below is the complete stack described in that file.

> **Important correction from the previous version of this document:** Section 114 of the architecture file ("Recommended Technical Architecture") introduces the Frontend/Backend/AI Service technology lists with the phrase **"Technologies can include:"** — this is explicitly a *recommended/suggested* stack, not a mandatory one. Anywhere below marked **Recommended** reflects that framing. Items marked **Required** come from parts of the document that use directive language (Backend/AI Service *responsibilities*, the MongoDB schema, the seven data agents, the "Non-Negotiable ORCA Rules" in §120, etc.) rather than the optional tech list.
>
> Also corrected: the previous version listed **GeoTIFF** as a required GIS file format. The document never mentions GeoTIFF — only **GeoJSON** is specified (for GIS layer storage with MongoDB `2dsphere` indexing). That line has been removed.

# 1. Programming languages

### Implied by the recommended stack (§114)

| Language       | Where it is used                                                                          |
| -------------- | ----------------------------------------------------------------------------------------- |
| **JavaScript** | Frontend + Backend; the file specifies React/Vite and Node.js/Express                     |
| **Python**     | AI Service, spatial sampling, risk calculations, agents, GIS, routing and data processing |
| **YAML**       | Agent Registry and configuration files                                                    |
| **JSON**       | API/data structures and structured agent outputs                                          |

### TypeScript

**Not required by this `.md` file.**

The file says **React + Vite** for Frontend and **Node.js + Express** for Backend, but never specifies TypeScript. Therefore, according to the file only:

> **JavaScript, not TypeScript.**

TypeScript could be used as an implementation choice, but it is not mentioned anywhere in the document.

---

# 2. Frontend tech stack

Section 114 ("Recommended Technical Architecture") lists these under **"Technologies can include"** — a recommended stack, not a mandated one.

### Recommended

* **React**
* **Vite**
* **Leaflet or another map library**
* **Charting library**
* **PWA / Service Worker support**
* **API client**
* **State management**
* **Chat UI**
* **Voice capture/playback UI**

These are directly listed in the recommended Frontend architecture. 

### Frontend functionality required by the file

* Natural-language input
* Voice input
* Coordinate/place input
* Date/time selection
* Activity selection
* Vessel selection
* Interactive map
* Nine-point visualization
* Risk visualization
* Agent-status cards
* Charts
* Evidence panel
* Data-quality panel
* Chatbot
* Alert UI
* Geofence UI
* Route visualization
* Trend visualization
* Shareable advisory interface



---

# 3. Backend tech stack

### Recommended (§114)

* **Node.js**
* **Express**
* **MongoDB**
* **MongoDB `2dsphere` geospatial indexes**
* **Mongoose**
* **Authentication/security middleware**
* **Job scheduler / cron-based worker**
* **Bhashini proxy integration**

These are listed under Backend in §114's "Technologies can include" list. MongoDB itself is a firmer requirement than the others — the document's Backend responsibilities and MongoDB schema (§99) describe it as the actual system-of-record, not just an option — but Express/Mongoose/the specific job-scheduler approach are implementation choices.

### Backend responsibilities

It must handle:

* Structural validation
* `analysis_id`
* MongoDB persistence
* Agent result storage
* Progress tracking
* Chat persistence
* Alert subscriptions
* Alert scheduling
* Alert deduplication
* Geofence API
* GIS layers
* Route APIs
* Trend APIs
* Report APIs
* Voice proxy
* Authentication
* Internal AI-service protection



---

# 4. Database

## MongoDB

This is definitely required by the file.

It needs these logical collections:

```text
analyses
agent_results
risk_results
decisions
gis_layers
alert_subscriptions
alert_events
conversations
routes
reports
```



## MongoDB 2dsphere

Also required for:

* Geofencing
* Boundary queries
* MPA queries
* `$geoIntersects`
* `$near`
* Spatial searches



---

# 5. AI Service tech stack

### Recommended (§114)

* **Python**
* **FastAPI**
* **LangGraph or equivalent orchestration**
* **Gemini LLM**
* **Pydantic**
* **Async execution**
* **Config-driven Agent Registry**
* **A*/Dijkstra**
* **Shapely**
* **GeoPandas**

These are listed under AI Service in §114's "Technologies can include" list — note the document itself hedges two of them ("LangGraph **or equivalent**", "A*/Dijkstra **or custom implementation**"), so the specific libraries are swappable; what's actually required is the *capability* (multi-agent orchestration, pathfinding, structured-output validation), not these exact packages.

---

# 6. LLM stack

The file specifically proposes:

### Planner

**Fast/low-latency LLM**

Used for:

* Language
* Intent
* Location interpretation
* Time interpretation
* Agent selection

### Risk

**Stronger LLM**

Used for:

* Evidence interpretation
* Explanation
* Bounded adjustment

### Decision

**Stronger LLM**

Used for:

* Final recommendation
* Explanation
* PFZ/ecosystem/GIS interpretation

The file specifically gives **Gemini** as the example LLM. 

---

# 7. Agent orchestration

## LangGraph

The file explicitly recommends:

**LangGraph or equivalent orchestration.**

Its intended flow is:

```text
Language Detection
        ↓
Intent Classification
        ↓
Location Validation
        ↓
Time Interpretation
        ↓
Sampling
        ↓
Data Discovery
        ↓
Planner
        ↓
Selected Agents
        ↓
Risk
        ↓
Decision
```



---

# 8. Structured output / validation

## Pydantic

Required by the architecture for validating:

* Planner output
* Risk output
* Decision output
* Chat output

The file explicitly says LLM output is **untrusted until validated**. 

---

# 9. Async / parallel execution

The AI service must support asynchronous execution because independent agents should execute concurrently.

Required concept:

```text
Planner
   │
   ├── Weather
   ├── Ocean
   ├── Tide
   ├── Cyclone
   └── GIS
          ↓
        Risk
          ↓
       Decision
```

The file explicitly requires parallel independent-agent execution and async execution.  

---

# 10. GIS / geospatial stack

The file explicitly names:

* **Shapely**
* **GeoPandas**
* **GeoJSON**
* **MongoDB 2dsphere**

(GeoTIFF is not mentioned anywhere in the document — only GeoJSON is specified as the storage format for GIS layers, per §99.5.)

The GIS system must handle:

* Coastline
* Land/sea mask
* EEZ
* Territorial waters
* Contiguous zone
* International maritime boundaries
* MPA
* Ecologically sensitive zones
* Restricted areas
* Ports
* Bathymetry
* Seasonal fishing bans

---

# 11. Spatial sampling

The file requires a **Python spatial sampling tool**.

For local safety:

```text
P0
P1
P2
P3
P4
P5
P6
P7
P8
```

Nine points by default. 

Other modes:

* Single point
* Local grid
* Regional scan
* Route corridor
* Historical sampling



---

# 12. The seven required data agents

You need these:

```text
1. Weather Agent
2. Ocean Agent
3. Tide Agent
4. Cyclone Agent
5. Ecosystem Agent
6. Fishing/PFZ Agent
7. GIS Agent
```



---

# 13. Additional AI capabilities

Inside the AI Service, the file also specifies:

```text
Data Discovery
Trend Agent
Route Tool
Report Agent
Visualization
User Interaction / Chat Agent
```



---

# 14. Risk engine

This is a major part of ORCA.

It must **not** be a free-form LLM score.

Required architecture:

```text
Official Warning
       ↓
Hard Safety Rules
       ↓
Deterministic Baseline
       ↓
Controlled LLM Interpretation
       ↓
Validation
```



Python performs the deterministic risk calculation. 

---

# 15. Decision engine

Decision uses:

```text
Risk
GIS
PFZ
Ecosystem
```

and applies deterministic hard constraints before recommendation.



---

# 16. Routing

The file requires:

* **A*** or **Dijkstra**
* Risk-cost grid
* GIS blocked cells
* Depth constraints
* Dangerous-cell blocking



---

# 17. Historical/trend processing

The Trend Agent must calculate:

* Monthly means
* Anomalies
* Trend direction
* Trend magnitude
* Unusual events

Then the LLM explains the calculated results.



The file does not name a specific statistics library here, so **do not treat Pandas/NumPy/Xarray as explicitly required by the document**.

---

# 18. Language technology

The file requires automatic language detection for:

* English
* Hindi
* Bengali
* Tamil
* Telugu
* Odia
* Marathi
* Malayalam
* Kannada
* Gujarati
* Native scripts
* Romanized languages
* Code-mixed language

It gives an **IndicLID-class model** as an example. 

---

# 19. Voice

The file specifies **Bhashini** as the preferred Government of India speech platform.

Architecture:

```text
Voice (Mic)
 ↓
Client-Side pure-JS MP3 Compression (lamejs, 16kHz)
 ↓
Frontend
 ↓
Backend (Validates MP3 MPEG Sync Words)
 ↓
Bhashini Dhruva ASR (Native MP3 handling)
 ↓
Speech Recognition (Tamil/Hindi/English -> Text)
 ↓
ORCA Pipeline
 ↓
Bhashini TTS (Text -> Base64 Audio)
 ↓
Backend (Caches as mongodb.Binary with 24h TTL)
 ↓
Frontend (Playback & Generation Timestamp)
```



---

# 20. Data sources

The specified sources are:

| Source                  | Purpose                       |
| ----------------------- | ----------------------------- |
| **MOSDAC**              | SST, chlorophyll, ocean EO    |
| **Bhuvan / Bhoonidhi**  | Indian EO/geospatial          |
| **INCOIS**              | PFZ, OSF, waves, alerts, tide |
| **IMD**                 | Weather/cyclone/warnings      |
| **Open-Meteo / Marine** | Fallback                      |
| **Copernicus Marine**   | Marine/historical fallback    |
| **Marine Regions**      | Boundaries                    |
| **WDPA**                | Protected areas               |



---

# 21. Data adapter architecture

Every external source should follow:

```text
Source
  ↓
Adapter
  ↓
Canonical ORCA Data
  ↓
Agent
```

This is explicitly required as the source-adapter pattern. 

---

# 22. Configuration

The file explicitly requires configuration-driven architecture.

Important configuration areas:

```text
Agent Registry
Data Catalog
Risk thresholds
Official warning rules
GIS constraints
Activities
Vessel profiles
Sampling
Languages
```

The registry itself contains metadata such as capabilities, inputs, outputs, schema, sources, dependencies, timeout, freshness and safety role. 

---

# 23. Prompt files

You need separate prompts for:

```text
planner
risk
decision
trend
report
chat
```

The file explicitly says prompts should be separate editable files rather than hardcoded into application logic. 

---

# 24. Alerts

Required technology/components:

* Backend scheduler
* Alert subscription storage
* Alert evaluation through AI Service
* Alert deduplication
* Web Push

Later channels mentioned:

* SMS
* WhatsApp
* IVR/voice calls



---

# 25. Geofencing

Required:

```text
Frontend GPS
      ↓
Backend
      ↓
Spatial geometry
      ↓
MongoDB geospatial queries
      ↓
clear / approaching / inside
```

No LLM is used for the actual geometry decision. 

---

# 26. Real-time/progress communication

For the **first implementation**, the file specifically recommends:

**Frontend polling**

```text
GET /api/v1/analysis/:analysis_id/status
```

approximately every 1–2 seconds.

Future options:

* Server-Sent Events
* WebSockets
* Push notifications



So **WebSocket is not required initially**.

---

# 27. Security technologies/components

Required by the architecture:

* Backend authentication/security middleware
* Internal Backend ↔ AI Service authentication
* CORS restrictions
* Rate limiting
* Request validation
* Input sanitization
* Secret/environment management
* Signed short-lived internal tokens

Most importantly:

```text
Frontend
   ↓
Backend
   ↓
AI Service
```

Never:

```text
Frontend → AI Service
Frontend → Bhashini
Frontend → external providers
Frontend → MongoDB
```



---

# 28. Testing stack / requirements

The file requires testing for:

### Language

* Native scripts
* Romanized
* Code-mixed
* Detection/override

### Planner

* Agent selection
* Mandatory agents
* Future agents

### Grid

* Nine points
* Point IDs
* Land points
* Regional/route/historical modes

### Agents

* Success
* Partial
* Failure
* Timeout
* Missing data
* Fallback

### Risk

* Reproducibility
* Warning floors
* Hard rules
* LLM adjustment limits
* Confidence

### Decision

* Preferred point
* Prohibited points
* No-safe outcome
* Best time

### Route

* GIS restrictions
* Dangerous cells
* Depth

### Backend

* Persistence
* Progress
* Authentication
* Geofence
* Alerts

### Chat

* Three chat cases
* Memory
* Re-planning



The file describes **what must be tested**, but it does **not explicitly mandate Jest, Pytest, Playwright, etc.**

So those should not be called "required according to the file."

---

# 29. Demo / Mock system

The file explicitly recommends a **Mock Data Service**.

It should simulate:

```text
Safe
Caution
Unsafe
Dangerous
Partial data
Agent failure
Agent timeout
Official warning override
GIS prohibited point
Land point
Offshore snapping
Geofence warning
No allowed point
Historical cyclone replay
```



This is highly important for the SIH demo.

---

# 30. Deployment/containerization

### Important distinction

The `.md` file **does not explicitly specify Docker, Kubernetes, Nginx, Redis, AWS, Azure, Vercel, etc.**

Therefore, because you asked me to follow the file **only**, I would **not put those in the official required stack**.

---

# 31. COMPLETE "ACCORDING TO THE FILE" STACK

### Programming languages

```text
JavaScript
Python
YAML
JSON
```

**TypeScript: NOT specified.**

---

### Frontend

```text
React
Vite
Leaflet / map library
Charting library
PWA / Service Worker
API client
State management
Chat UI
Voice UI
```

---

### Backend

```text
Node.js
Express
MongoDB
Mongoose
MongoDB 2dsphere
Authentication/security middleware
Cron/job scheduler
Bhashini proxy
```

---

### AI Service

```text
Python
FastAPI
LangGraph / equivalent
Gemini LLM
Pydantic
Async execution
Agent Registry
Data Catalog
```

---

### GIS / Spatial

```text
Shapely
GeoPandas
GeoJSON
MongoDB 2dsphere
A*
Dijkstra
Python spatial sampling
```

---

### AI / Agents

```text
Planner / Orchestrator
Weather Agent
Ocean Agent
Tide Agent
Cyclone Agent
Ecosystem Agent
Fishing/PFZ Agent
GIS Agent
Risk Agent
Decision Agent
Trend Agent
Route Tool
Report Agent
Visualization
User Interaction / Chat Agent
Data Discovery
```



---

### Language / Voice

```text
IndicLID-class language detection
Bhashini
Speech Recognition
Translation
Text-to-Speech
```

---

### Data sources

```text
MOSDAC
Bhuvan / Bhoonidhi
INCOIS
IMD
Open-Meteo
Open-Meteo Marine
Copernicus Marine
Marine Regions
WDPA
```

---

### Data / GIS concepts

```text
GeoJSON
Land/Sea mask
Bathymetry
EEZ
Territorial waters
Contiguous zone
International maritime boundaries
MPA / ecologically sensitive zones
Restricted zones
Ports
Coastline
Seasonal fishing ban areas
```

(Shapefiles and GeoTIFF, both listed in the earlier version of this document, do not appear anywhere in the architecture file — only GeoJSON is named as a concrete file format.)

---

### Required architecture components

```text
Agent Registry
Data Catalog
Source Adapters
Prompt files
Risk configuration
Warning rules
GIS constraints
Vessel profiles
Activity configuration
Sampling configuration
Execution trace
Data provenance
Data-quality tracking
Mock Data Service
```

---

# 32. What you actually need to install

For your team, the **core development installation according to the file** is essentially:

```text
Node.js
npm

Python
pip

MongoDB

React
Vite
Express
Mongoose

FastAPI
LangGraph
Pydantic

Leaflet
Charting library

Shapely
GeoPandas

Gemini API

Bhashini integration
```

And the project must implement the data sources, agents, registry, risk engine, GIS logic, chat, alerts, routing and validation described above. 

### One correction to my earlier answer

I previously listed **Tailwind, Zustand, Redis, Docker, NumPy, Pandas, Rasterio, Xarray, Jest, Playwright**, etc. as recommendations. Those are **not explicitly specified in this `.md` file**. Since you now asked specifically for **the file only**, they should be treated as optional implementation choices, **not required technologies from the specification**.

The safest official stack derived from this document is therefore the stack above.
