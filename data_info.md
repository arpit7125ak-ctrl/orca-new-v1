# ORCA — Complete End-to-End Data Flow & API Specifications

**Document Title**: ORCA Data Flow, Lifecycle & JSON Payloads Reference  
**File Name**: `data_info.md`  
**Date**: September 14, 2026  
**Version**: 1.0 (Locked SIH26176 Reference)

---

## 1. High-Level Data Flow Lifecycle

The ORCA system is built around an **asynchronous event-driven pipeline**. No heavy computation or external network queries block client HTTP requests.

```
+-----------------------------------------------------------------------------------------------+
| STAGE 1: INGESTION & VALIDATION (Backend Port :4000)                                          |
| 1. Client sends POST /api/v1/analysis with query, coordinates, activity, vessel.             |
| 2. Ajv validates request body against AnalysisRequest.json.                                   |
| 3. Backend creates MongoDB record with state="queued" and generates analysis_id.              |
| 4. Backend returns HTTP 202 Accepted immediately with status_url.                             |
+-----------------------------------------------------------------------------------------------+
                                               |
                                               v (Async HTTP POST with HS256 JWT)
+-----------------------------------------------------------------------------------------------+
| STAGE 2: AI SERVICE ORCHESTRATION (AI Service Port :8000)                                     |
| 1. AI Service accepts execution request and starts asyncio background task.                   |
| 2. Planner Stage:                                                                             |
|    - Google Gemini LLM detects language & classifies primary intent (e.g. point_safety).      |
|    - Spatial Sampler snaps coastal coordinates offshore and generates 9 points (P0 to P8).    |
|    - Time Window is standardized into local (IST) and UTC intervals.                          |
|    - Planner selects data agents (mandatory policy guarantees Weather, Ocean, Cyclone, GIS). |
| 3. AI Service sends ProgressMessage (status="running", stage="planner") to Backend :4100.     |
+-----------------------------------------------------------------------------------------------+
                                               |
                                               v (Parallel Agent Execution)
+-----------------------------------------------------------------------------------------------+
| STAGE 3: MULTI-AGENT DATA COLLECTION                                                         |
| 5 Agents execute concurrently across all 9 spatial grid points:                               |
|   - Weather: Wind speed, wind gusts, wind direction, visibility, precipitation.               |
|   - Ocean: Significant wave height, swell height, wave period, sea surface temp (SST).       |
|   - Cyclone: Active cyclone tracks and official IMD/INCOIS storm bulletins.                   |
|   - GIS: Intersect checks against 22 maritime boundaries, EEZ, and protected zones.           |
|   - Tide: Astronomical tide heights and tidal currents.                                       |
| AI Service sends ProgressMessage for each agent completion to Backend :4100.                  |
+-----------------------------------------------------------------------------------------------+
                                               |
                                               v
+-----------------------------------------------------------------------------------------------+
| STAGE 4: 4-STAGE RISK PIPELINE (per point P0..P8)                                             |
|   Stage 1: Deterministic baseline scoring (0-100) based on vessel tolerances.                 |
|   Stage 2: Official warnings floor enforcement (e.g. IMD warning forces min score 85).       |
|   Stage 3: Hard GIS rules enforcement (e.g. prohibited zone forces score 100).                |
|   Stage 4: Bounded LLM adjustment (-10 to +10) for compound weather factor synergy.           |
+-----------------------------------------------------------------------------------------------+
                                               |
                                               v
+-----------------------------------------------------------------------------------------------+
| STAGE 5: DECISION SYNTHESIS                                                                   |
| 1. Decision Agent excludes prohibited / dangerous points.                                     |
| 2. Identifies safest preferred point (e.g. P6) and safest alternative time windows.          |
| 3. Gemini LLM writes localized plain-language advisory and concise one-line advice.          |
| 4. AI Service compiles InternalResultPayload and calls POST /internal/v1/result on :4100.     |
+-----------------------------------------------------------------------------------------------+
                                               |
                                               v
+-----------------------------------------------------------------------------------------------+
| STAGE 6: RESULT STORAGE & CLIENT EXTRACTION                                                   |
| 1. Backend Internal Server (:4100) validates result against InternalResultPayload.json.      |
| 2. MongoDB record updated to status="completed".                                              |
| 3. Client polls GET /api/v1/analysis/:id/status until status="completed".                     |
| 4. Client fetches full advisory via GET /api/v1/analysis/:id.                                 |
+-----------------------------------------------------------------------------------------------+
```

---

## 2. Complete Endpoint Directory & JSON Formats

Every single endpoint in the ORCA platform is documented below with its **exact HTTP method**, **URL**, **purpose**, and **full JSON request and response payloads**.

---

### Endpoint 1: Health & Liveness Check
* **Method**: `GET`
* **URL**: `http://localhost:4000/health`
* **Purpose**: Used by load balancers and container orchestrators (Kubernetes / Docker) to confirm the Backend process is running.
* **Request Body**: *None*
* **Response Payload (`200 OK`)**:
```json
{
  "status": "ok",
  "service": "orca-backend",
  "env": "development",
  "uptime_seconds": 1245,
  "timestamp": "2026-09-14T12:00:00.000Z"
}
```

---

### Endpoint 2: System Readiness Check
* **Method**: `GET`
* **URL**: `http://localhost:4000/health/ready`
* **Purpose**: Verifies that downstream dependencies (MongoDB database, 44 JSON contracts, and AI Service HTTP connectivity) are healthy before routing traffic.
* **Request Body**: *None*
* **Response Payload (`200 OK`)**:
```json
{
  "status": "ready",
  "service": "orca-backend",
  "checks": {
    "mongodb": {
      "connected": true
    },
    "contracts": {
      "loaded": true,
      "count": 44
    },
    "ai_service": {
      "reachable": true,
      "status": 200
    }
  }
}
```

---

### Endpoint 3: Configuration & Dropdown Registry
* **Method**: `GET`
* **URL**: `http://localhost:4000/api/v1/config`
* **Purpose**: Provides the Frontend with dynamic, configuration-driven options for activities, vessel types, languages, and canonical units. Ensures the Frontend UI never drifts from backend validation rules.
* **Request Body**: *None*
* **Response Payload (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "activities": [
      { "id": "fishing", "label_en": "Fishing", "safety_relevant": true },
      { "id": "boating", "label_en": "Boating", "safety_relevant": true },
      { "id": "marine_research", "label_en": "Marine research", "safety_relevant": true },
      { "id": "diving", "label_en": "Diving", "safety_relevant": true },
      { "id": "surfing", "label_en": "Surfing", "safety_relevant": true },
      { "id": "tourism", "label_en": "Tourism", "safety_relevant": true },
      { "id": "shipping", "label_en": "Shipping/transport", "safety_relevant": true }
    ],
    "vessel_types": [
      { "id": "traditional_non_motorized", "label_en": "Traditional non-motorized craft", "conservatism_rank": 1 },
      { "id": "motorized_country_craft", "label_en": "Motorized country craft (outboard)", "conservatism_rank": 2 },
      { "id": "recreational_boat", "label_en": "Recreational/tourism boat", "conservatism_rank": 3 },
      { "id": "mechanized_fishing_vessel", "label_en": "Mechanized fishing vessel (trawler)", "conservatism_rank": 4 },
      { "id": "research_vessel", "label_en": "Research vessel", "conservatism_rank": 5 },
      { "id": "large_commercial_vessel", "label_en": "Large commercial vessel", "conservatism_rank": 6 }
    ],
    "languages": [
      { "code": "en", "label_en": "English", "native": "English" },
      { "code": "hi", "label_en": "Hindi", "native": "हिन्दी" },
      { "code": "ta", "label_en": "Tamil", "native": "தமிழ்" },
      { "code": "te", "label_en": "Telugu", "native": "తెలుగు" },
      { "code": "ml", "label_en": "Malayalam", "native": "മലയാളം" },
      { "code": "bn", "label_en": "Bengali", "native": "বাংলা" }
    ],
    "canonical_units": {
      "wind_speed": "m/s",
      "wind_gust": "m/s",
      "wind_direction": "deg",
      "wave_height": "m",
      "swell_height": "m",
      "wave_period": "s",
      "current_speed": "m/s",
      "sea_surface_temperature": "degC",
      "air_temperature": "degC",
      "visibility": "km",
      "precipitation": "mm",
      "water_depth": "m"
    }
  }
}
```

---

### Endpoint 4: Create Analysis (Primary Entrypoint)
* **Method**: `POST`
* **URL**: `http://localhost:4000/api/v1/analysis`
* **Purpose**: Submits a marine safety query. Handled asynchronously; queues the query, triggers the AI service in the background, and returns immediate acknowledgment with status tracking URL.
* **Headers**: `Content-Type: application/json`, `X-UTC-Offset-Minutes: 330`
* **Request Payload**:
```json
{
  "query": "Is it safe to venture into the sea tomorrow morning?",
  "coordinate": {
    "lat": 9.9417,
    "lon": 76.16
  },
  "place_name": "Kochi",
  "date": "2026-09-15",
  "time_range": {
    "start": "06:00",
    "end": "10:00"
  },
  "activity": "fishing",
  "vessel_type": "motorized_country_craft",
  "language_override": "en"
}
```
* **Response Payload (`202 Accepted`)**:
```json
{
  "analysis_id": "req_20260914_1253_6e0854",
  "status": "queued",
  "status_url": "/api/v1/analysis/req_20260914_1253_6e0854/status"
}
```

---

### Endpoint 5: Poll Analysis Status
* **Method**: `GET`
* **URL**: `http://localhost:4000/api/v1/analysis/:id/status`
* **Purpose**: Used by the Frontend to poll progress without fetching large result objects. Returns stage progress, percentage, and current agent.
* **Request Body**: *None*
* **Response Payload (`200 OK` - In Progress)**:
```json
{
  "analysis_id": "req_20260914_1253_6e0854",
  "status": "running",
  "progress_percent": 65,
  "current_stage": "risk",
  "agents_completed": ["planner", "weather", "ocean", "cyclone", "gis"],
  "agents_pending": ["risk", "decision"]
}
```
* **Response Payload (`200 OK` - Completed)**:
```json
{
  "analysis_id": "req_20260914_1253_6e0854",
  "status": "completed",
  "progress_percent": 100,
  "current_stage": "decision",
  "agents_completed": ["planner", "weather", "ocean", "cyclone", "gis", "risk", "decision"],
  "agents_pending": []
}
```

---

### Endpoint 6: Get Full Analysis Result (Primary Dashboard Payload)
* **Method**: `GET`
* **URL**: `http://localhost:4000/api/v1/analysis/:id`
* **Purpose**: Returns the full comprehensive analysis report including execution trace, planner output, offshore snapped coordinates, 9-point grid scores, active warnings, and Gemini LLM's natural language advisory.
* **Request Body**: *None*
* **Response Payload (`200 OK`)**:
```json
{
  "analysis_id": "req_20260914_1253_6e0854",
  "status": "completed",
  "plan": {
    "analysis_id": "req_20260914_1253_6e0854",
    "response_language": "en",
    "primary_intent": "point_safety",
    "location": {
      "original": { "name": "Kochi", "lat": 9.9417, "lon": 76.16 },
      "validated": {
        "lat": 9.93,
        "lon": 76.1,
        "snapped": true,
        "snap_distance_km": 6.7,
        "snap_reference": "offshore of Kochi"
      }
    },
    "time_window": {
      "local": "2026-09-15T06:00:00+05:30/2026-09-15T10:00:00+05:30",
      "utc": "2026-09-15T00:30:00Z/2026-09-15T04:30:00Z",
      "original_expression": "tomorrow morning",
      "matched_bucket": "morning"
    },
    "activity": "fishing",
    "vessel_type": "motorized_country_craft",
    "sampling": {
      "mode": "local_grid",
      "radius_km": 5,
      "shape": "square"
    },
    "selected_agents": [
      { "agent": "weather", "reason": "Required to check wind speed, wind gusts, and visibility." },
      { "agent": "ocean", "reason": "Required to evaluate significant wave height, swell, and currents." },
      { "agent": "cyclone", "reason": "Essential to check for active IMD/INCOIS storm warnings." },
      { "agent": "gis", "reason": "mandatory_by_policy", "mandatory_by_policy": true }
    ],
    "stages": ["risk", "decision"]
  },
  "decision": {
    "analysis_id": "req_20260914_1253_6e0854",
    "recommendation_type": "not_recommended",
    "one_line_recommendation": "Do not head out to sea today as conditions are unsafe for fishing.",
    "detailed_recommendation": "Strong winds reaching 12.58 m/s and poor visibility down to 3.19 km make conditions hazardous for a motorized country craft. No safer time window is available within the requested period, and all tested locations carry high risk. Stay ashore until weather and sea conditions improve.",
    "preferred_point": "P6",
    "preferred_point_reason": "Lowest risk score (67) among points that are not excluded",
    "worst_point": "P0",
    "worst_point_causes": ["wind_gust_ms", "wind_speed_ms", "current_speed_ms"],
    "excluded_points": [
      { "point_id": "P0", "reason": "dangerous" },
      { "point_id": "P1", "reason": "dangerous" }
    ],
    "key_findings": {
      "safest_allowed_point": "P6",
      "highest_risk_point": "P0",
      "major_hazard": "wind speed ms",
      "official_warning_status": "Active warning IMD-43262 in effect"
    }
  },
  "created_at": "2026-09-14T12:53:29.181Z",
  "completed_at": "2026-09-14T12:53:53.500Z"
}
```

---

### Endpoint 7: Live GPS Geofence Check
* **Method**: `POST`
* **URL**: `http://localhost:4000/api/v1/geofence/check`
* **Purpose**: Evaluates a live GPS ping against 22 GIS layers (EEZ, IMBL, Marine Protected Areas). Computes real-time boundary proximity, distance in km, and safety/legal alerts.
* **Request Payload**:
```json
{
  "lat": 13.0827,
  "lon": 80.2707,
  "device_id": "gps_boat_unit_042",
  "vessel_type": "motorized_country_craft",
  "language_override": "en"
}
```
* **Response Payload (`200 OK`)**:
```json
{
  "state": "inside",
  "layer_name": "Chennai coastal ecologically sensitive zone (demo approximation)",
  "constraint_type": "conditional",
  "distance_km": 0,
  "warning_text": "Alert: You have entered an ecologically sensitive zone. Leave this area immediately.",
  "deduplicated": false
}
```

---

### Endpoint 8: GIS Map Layers Vector Geometries
* **Method**: `GET`
* **URL**: `http://localhost:4000/api/v1/map/layers`
* **Purpose**: Fetches boundary polygons and restricted maritime zones for rendering on Leaflet, Mapbox, or OpenLayers frontend maps.
* **Query Parameters**: `?constraint_type=prohibited` (optional)
* **Request Body**: *None*
* **Response Payload (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "total_layers": 22,
    "layers": [
      {
        "layer_id": "layer_imbl_demo",
        "name": "International Maritime Boundary Line (Demo Buffer)",
        "constraint_type": "prohibited",
        "source": "Ministry of Earth Sciences / Marine Regions",
        "geojson": {
          "type": "Polygon",
          "coordinates": [
            [
              [79.8, 9.5],
              [80.2, 9.5],
              [80.2, 10.0],
              [79.8, 10.0],
              [79.8, 9.5]
            ]
          ]
        }
      }
    ]
  }
}
```

---

### Endpoint 9: Conversational Chat Assistant
* **Method**: `POST`
* **URL**: `http://localhost:4000/api/v1/chat/message`
* **Purpose**: Handles multi-turn chat questions from fishermen, seamlessly inheriting context from prior analyses or questions without needing re-entry of location/vessel parameters.
* **Request Payload**:
```json
{
  "message": "Can I launch my boat at 8 AM instead?",
  "conversation_id": "conv_f83103ad4a79",
  "coordinate": {
    "lat": 13.0827,
    "lon": 80.5
  },
  "language": "en"
}
```
* **Response Payload (`202 Accepted`)**:
```json
{
  "conversation_id": "conv_f83103ad4a79",
  "response_text": "Analysing your request. The full advisory will be available shortly.",
  "response_language": "en",
  "answered_from": "new_analysis",
  "triggered_analysis_id": "req_20260914_1310_d82a1c",
  "dashboard_url": "/api/v1/analysis/req_20260914_1310_d82a1c"
}
```

---

### Endpoint 10: Export Written Advisory Report
* **Method**: `GET`
* **URL**: `http://localhost:4000/api/v1/report/:analysis_id`
* **Purpose**: Generates a shareable, formatted advisory bulletin suitable for printing, SMS/WhatsApp dispatch, or PDF download.
* **Query Parameters**: `?format=markdown` (or `html` / `json`)
* **Request Body**: *None*
* **Response Payload (`200 OK` - Markdown)**:
```markdown
# ORCA MARINE SAFETY ADVISORY BULLETIN
**Bulletin ID**: ADV-20260914-6e0854  
**Date Issued**: 2026-09-14 18:25 IST  
**Location**: Kochi Offshore (9.93°N, 76.10°E)  
**Target Window**: 2026-09-15 06:00 - 10:00 IST  
**Vessel**: Motorized Country Craft  

## OVERALL VERDICT: DO NOT VENTURE (UNSAFE)
Active weather hazards make operating small or motorized craft dangerous.

### Key Factors:
- **Wind Speed**: Sustained 12.58 m/s with gusts exceeding 19.74 m/s.
- **Wave / Swell**: Wave heights up to 2.62 m.
- **Official Warning**: Active IMD Cyclone/Storm warning IMD-43262 in effect.

### Safe Recommendation:
Stay ashore. No safe windows exist within the morning hours. Re-evaluate tomorrow evening.
```

---

### Endpoint 11: Alert Subscription (Push Notifications)
* **Method**: `POST`
* **URL**: `http://localhost:4000/api/v1/alerts/subscriptions`
* **Purpose**: Subscribes a user's location and vessel to scheduled background safety checks. When conditions worsen, Web Push notifications are triggered.
* **Request Payload**:
```json
{
  "coordinate": {
    "lat": 13.0827,
    "lon": 80.5
  },
  "radius_km": 10,
  "activity": "fishing",
  "vessel_type": "motorized_country_craft",
  "language": "en",
  "channel": "push",
  "device_token": "fcm_or_web_push_token_98234"
}
```
* **Response Payload (`201 Created`)**:
```json
{
  "subscription_id": "sub_883a91bc72e0",
  "status": "active",
  "created_at": "2026-09-14T12:00:00Z"
}
```

---

## 3. Internal Backend & AI Service Inter-Process Endpoints

These endpoints operate on **port 4100** (Internal Backend) and **port 8000** (AI Service). They are authenticated via cryptographic **HS256 JSON Web Tokens (JWT)** signed using `INTERNAL_SECRET`.

---

### Endpoint 12: Trigger AI Analysis Execution
* **Caller**: Backend Public API
* **Receiver**: AI Service
* **Method**: `POST`
* **URL**: `http://localhost:8000/v1/analysis/execute`
* **Headers**: `x-internal-token: <HS256 JWT Token>`
* **Request Payload**:
```json
{
  "analysis_id": "req_20260914_1253_6e0854",
  "request": {
    "query": "Is it safe to fish tomorrow morning?",
    "coordinate": { "lat": 9.9417, "lon": 76.16 },
    "place_name": "Kochi",
    "activity": "fishing",
    "vessel_type": "motorized_country_craft",
    "language_override": "en"
  }
}
```
* **Response Payload (`202 Accepted`)**:
```json
{
  "accepted": true,
  "analysis_id": "req_20260914_1253_6e0854"
}
```

---

### Endpoint 13: Report Progress & Intermediate Results
* **Caller**: AI Service
* **Receiver**: Backend Internal Server (:4100)
* **Method**: `POST`
* **URL**: `http://localhost:4100/internal/v1/progress`
* **Headers**: `x-internal-token: <Reverse HS256 JWT Token>`
* **Request Payload**:
```json
{
  "analysis_id": "req_20260914_1253_6e0854",
  "agent": "weather",
  "status": "completed",
  "status_code": 200,
  "timestamp": "2026-09-14T12:53:32.631Z",
  "data": {
    "agent_name": "weather",
    "status": "completed",
    "normalized": {
      "by_point": {
        "P0": {
          "wind_speed_ms": { "value": 11.05, "unit": "m/s", "status": "available", "source": "IMD" },
          "wind_gust_ms": { "value": 19.74, "unit": "m/s", "status": "available", "source": "IMD" }
        }
      }
    }
  }
}
```
* **Response Payload (`200 OK`)**:
```json
{
  "success": true,
  "received": true
}
```

---

### Endpoint 14: Report Final Result (AI Service Callback)
* **Caller**: AI Service
* **Receiver**: Backend Internal Server (:4100)
* **Method**: `POST`
* **URL**: `http://localhost:4100/internal/v1/result`
* **Headers**: `x-internal-token: <Reverse HS256 JWT Token>`
* **Request Payload**:
```json
{
  "analysis_id": "req_20260914_1253_6e0854",
  "final_stage": "decision",
  "status": "completed",
  "decision": {
    "analysis_id": "req_20260914_1253_6e0854",
    "recommendation_type": "not_recommended",
    "preferred_point": "P6",
    "one_line_recommendation": "Do not head out to sea today as conditions are unsafe for fishing.",
    "detailed_recommendation": "Strong winds reaching 12.58 m/s and poor visibility down to 3.19 km make conditions hazardous for a motorized country craft."
  }
}
```
* **Response Payload (`200 OK`)**:
```json
{
  "success": true,
  "status": "completed"
}
```

---

## 4. Frontend Integration Summary Checklist

If you are developing or connecting a Frontend application (React, Next.js, Vue, or Flutter), you only need to call **4 primary endpoints**:

1. **`GET /api/v1/config`** $\rightarrow$ On app startup, populate all activities, vessel types, and languages.
2. **`POST /api/v1/analysis`** $\rightarrow$ When user clicks "Check Safety", send query/coordinates and get `analysis_id`.
3. **`GET /api/v1/analysis/:id/status`** $\rightarrow$ Poll every 2 seconds until status changes from `running` to `completed`.
4. **`GET /api/v1/analysis/:id`** $\rightarrow$ Fetch full data to display the recommendation, safety score gauge, and map markers.
