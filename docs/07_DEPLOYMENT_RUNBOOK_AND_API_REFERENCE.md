# 07: Deployment Runbook & API Reference

This document provides complete instructions on how to configure, run, test, and integrate with the ORCA platform.

---

## 1. Prerequisites & Environment Setup

Ensure the following runtimes are installed on your host machine:
* **Node.js:** v18.0.0 or higher
* **Python:** v3.10 or higher
* **MongoDB:** v6.0 or higher (community edition)

---

## 2. Environment Variables Configuration

### Backend Gateway (`orca/backend/.env`)
Create an `.env` file in `orca/backend/`:
```ini
NODE_ENV=development
PORT=4000
INTERNAL_PORT=4100
MONGODB_URI=mongodb://localhost:27017/orca

# Internal Security Secret (Shared with AI Service)
INTERNAL_SECRET=orca-internal-demo-secret-key-32chars!!

# AI Service Handoff URL
AI_SERVICE_URL=http://localhost:8000

# Daily PFZ Sync Schedule (8:00 PM IST)
PFZ_SYNC_CRON=0 20 * * *

# Proactive Alert Evaluation Schedule (Every 30 mins)
ALERT_SCHEDULER_CRON=*/30 * * * *
```

### AI Service (`orca/ai-service/.env`)
Create an `.env` file in `orca/ai-service/`:
```ini
AI_SERVICE_PORT=8000
BACKEND_INTERNAL_URL=http://localhost:4100
INTERNAL_SECRET=orca-internal-demo-secret-key-32chars!!

# Mode: "real" enables live Open-Meteo & INCOIS feeds; "mock" enables offline deterministic test feeds
ADAPTER_MODE=real

# MongoDB URI (For spatial GIS & PFZ queries)
MONGODB_URI=mongodb://localhost:27017/orca

# Optional Google Gemini API Key for dynamic narrative synthesis
GEMINI_API_KEY=your_gemini_api_key_here
```

---

## 3. How to Start All 4 Services

Open separate terminal windows for each component:

### Terminal 1: MongoDB Database
```bash
# Ensure MongoDB is listening on port 27017
mongod --dbpath /path/to/mongo_data
```

### Terminal 2: AI Service (Python FastAPI — Port 8000)
```bash
cd orca/ai-service
# Activate virtual environment
source .venv/bin/activate  # Or on Windows: .venv\Scripts\activate
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```
*Health Check:* Open `http://localhost:8000/health` $\rightarrow$ should return `{"status":"ok"}`.

### Terminal 3: Backend Internal Server (Port 4100)
```bash
cd orca/backend
npm run internal
```
*Listening on:* `http://localhost:4100`

### Terminal 4: Backend Public API Server (Port 4000)
```bash
cd orca/backend
node src/server.js
```
*Readiness Check:* Open `http://localhost:4000/health/ready` $\rightarrow$ should return `{"status":"ready"}`.

### Terminal 5: Background Worker (Alerts & Daily Sync)
```bash
cd orca/backend
npm run worker
```

### Terminal 6: Frontend Client (Port 5173)
```bash
cd orca/frontend
node serve.js   # Or: npm run dev
```
*Open Application:* Open your browser at **`http://localhost:5173`**.

---

## 4. Verification & Seeding Commands

Run these scripts from `orca/backend/`:
```bash
# 1. Verify syntax across all 84 backend files and validate 15 JSON Schema contracts
npm run check

# 2. Seed Maritime GIS Boundaries (EEZ, MPAs, depth contours)
npm run seed:gis

# 3. Seed Major Indian Fishing & Commercial Ports
npm run seed:ports

# 4. Trigger on-demand sync of live INCOIS satellite PFZ lines
node scripts/seed-pfz.js
```

---

## 5. API Reference & Endpoint Specification

### `POST /api/v1/analysis` (Submit Marine Analysis Request)
Submits a point or voyage query. Returns immediately with HTTP 202 Accepted.
* **Headers:** `Content-Type: application/json`
* **Request Body:**
```json
{
  "place_name": "Off Kochi Coast",
  "coordinate": {
    "lat": 9.9312,
    "lon": 76.2673
  },
  "activity": "fishing",
  "vessel_type": "mechanized_fishing_vessel",
  "query": "Where is the nearest safe fishing zone?"
}
```
* **Response (HTTP 202 Accepted):**
```json
{
  "success": true,
  "analysis_id": "req_20260919_0415_a8910b",
  "status": "running",
  "stage": "ai_service_handoff",
  "created_at": "2026-09-19T04:15:00.000Z"
}
```

---

### `GET /api/v1/analysis/:analysis_id` (Poll Request Progress)
Used by the frontend to display the animated progress tracker.
* **Response (HTTP 200 OK):**
```json
{
  "analysis_id": "req_20260919_0415_a8910b",
  "status": "running",
  "stage": "ocean",
  "progress_pct": 50,
  "completed_at": null
}
```

---

### `GET /api/v1/analysis/:analysis_id/result` (Fetch Final Advisory)
Returns the complete safety decision, corridor point risk scores, and PFZ hotspots.
* **Response (HTTP 200 OK):**
```json
{
  "analysis_id": "req_20260919_0415_a8910b",
  "decision": {
    "status": "go",
    "confidence_score": 0.90,
    "summary": "Weather and sea state are calm: 1.4 m/s wind speed, 1.2 m wave height. Prime PFZ hotspot 0.92 km away.",
    "key_findings": [
      "Calm sea state: Wave height 1.2m, visibility 8.4km.",
      "Prime fishing opportunity: High-suitability PFZ (0.82) located 0.92 km away.",
      "Safe navigation: Operating safely inside Indian EEZ waters."
    ]
  },
  "agent_outputs": {
    "pfz": {
      "distance_to_pfz_km": 0.92,
      "pfz_suitability_score": 0.82,
      "target_species": ["Yellowfin Tuna", "Indian Mackerel", "Ribbonfish"]
    }
  }
}
```

---

### `POST /api/v1/geofence/check` (Real-Time GPS Boundary Check)
Evaluates vessel position against international borders in $<100\text{ms}$.
* **Request Body:**
```json
{
  "lat": 21.50,
  "lon": 68.20,
  "vessel_id": "IND-GJ-04-MM-1204"
}
```
* **Response (HTTP 200 OK):**
```json
{
  "status": "warning",
  "nearest_boundary": "India-Pakistan Maritime Boundary Line",
  "distance_km": 4.2,
  "bearing_deg": 315,
  "message": "Caution: Vessel is 4.2 km from International Maritime Boundary Line. Steer south."
}
```
