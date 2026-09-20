# ORCA System Commands & Operational Runbook 🌊🛡️
> Comprehensive command reference for the **ORCA** (SIH26176) Intelligent Marine Safety & Fishing Advisory System.

---

## Table of Contents
1. [Automated vs. Manual Matrix](#1-automated-vs-manual-matrix)
2. [Service Startup Commands](#2-service-startup-commands)
3. [Database Seeding & Synchronization](#3-database-seeding--synchronization)
4. [Contract Verification & Code Health](#4-contract-verification--code-health)
5. [Live Analysis & API Testing](#5-live-analysis--api-testing)
6. [MongoDB Diagnostic Queries (`mongosh`)](#6-mongodb-diagnostic-queries-mongosh)
7. [Troubleshooting & Maintenance](#7-troubleshooting--maintenance)

---

## 1. Automated vs. Manual Matrix

| Component | Automated or Manual? | Trigger / Frequency | Command (if manual run needed) |
| :--- | :--- | :--- | :--- |
| **All 7 AI Domain Agents** | **Automated** | Triggered parallelly per user analysis request | Handled by AI orchestrator |
| **GIS Zone Boot Sync** | **Automated** | Server startup (checks count; seeds if missing) | `npm run seed:zones` |
| **Monsoon Fishing Ban** | **Automated** | Evaluated dynamically using system clock (`mongo_gis.py`) | Handled automatically |
| **PFZ Ingestion (Daily)** | **Automated** | Cron job at `20:00 IST` (8:00 PM) daily in `server.js` | `npm run seed:pfz` |
| **PFZ Ingestion (On-Demand)**| **Manual** | Admin trigger / initial setup / immediate refresh | `npm run seed:pfz` |
| **Ports & Harbors Ingestion**| **Manual** | One-time setup or when ports directory is updated | `npm run seed:ports` |
| **Mongo 2dsphere Indexes** | **Manual** | One-time setup or schema update | `npm run create-indexes` |
| **Contract Checks** | **Manual / CI** | Pre-commit / build pipeline / code audit | `npm run check` |

---

## 2. Service Startup Commands

ORCA comprises 4 microservices that communicate over HTTP/REST and MongoDB.

### Port Allocation Map
* `27017` — MongoDB Database (`mongodb://localhost:27017/orca`)
* `8000` — Python AI Service (FastAPI + 7 Live Domain Agents)
* `4000` — Public API Gateway (Node.js/Express)
* `4100` — Internal Microservice Gateway (Node.js/Express)
* `5173` — Frontend React Client (Vite)

---

### A. Python AI Service (Port 8000)
Run from the `orca/ai-service` directory:

```powershell
# 1. Navigate to AI service
cd "orca/ai-service"

# 2. Activate virtual environment
.\.venv\Scripts\Activate.ps1

# 3. Start FastAPI server (Development / Live reload)
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# 3. Start FastAPI server (Production mode)
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

---

### B. Public API Gateway (Port 4000)
Run from the `orca/backend` directory:

```powershell
# 1. Navigate to backend
cd "orca/backend"

# 2. Development mode (Auto-restart on code change)
npm run dev

# 2. Production mode
npm start
```

---

### C. Internal Microservice Gateway (Port 4100)
Run from the `orca/backend` directory:

```powershell
# 1. Navigate to backend
cd "orca/backend"

# 2. Development mode
npm run dev:internal

# 2. Production mode
npm run internal
```

---

### D. Frontend Client (Port 5173)
Run from the `orca/frontend` directory:

```powershell
# 1. Navigate to frontend
cd "orca/frontend"

# 2. Vite Dev Server (HMR)
npm run dev

# 2. Production Server (via Express static serve)
npm start
```

---

## 3. Database Seeding & Synchronization

All commands below are executed from `orca/backend`:

```powershell
cd "orca/backend"
```

### 1. Seed All Authoritative Indian Maritime Zones
Ingests surveyed polygons: India-Sri Lanka IMBL (UNCLOS), India-Pakistan Sir Creek IMBL, 6 Marine National Parks (WDPA), Monsoon Ban zones, ONGC ODAG offshore exclusion, and EEZ:
```powershell
npm run seed:zones
# Direct node alternative: node scripts/seed-all-indian-zones.js
```

### 2. Seed All Indian Ports & Fishing Harbors
Ingests 285 surveyed coastal facilities (16 Major Commercial Ports, 80 Dedicated Fishing Harbours, 189 State Maritime Board Ports/Fish Landing Centers):
```powershell
npm run seed:ports
# Direct node alternative: node scripts/seed-ports.js
```

### 3. Ingest Live INCOIS PFZ Advisories
Fetches live Potential Fishing Zone ocean features from INCOIS GeoServer WFS into MongoDB:
```powershell
npm run seed:pfz
# Direct node alternative: node scripts/seed-pfz.js
```

### 4. Create MongoDB Geospatial Indexes
Ensures 2dsphere indexes exist on `geometry_full`, `geometry_simplified`, and coordinates:
```powershell
npm run create-indexes
# Direct node alternative: node scripts/create-indexes.js
```

---

## 4. Contract Verification & Code Health

Ensure zero schema drifts across Backend, AI Service, and Contracts:

### Run Full Verification Suite (Syntax + Schema Contracts)
From `orca/backend`:
```powershell
npm run check
```
*Validates 84 backend JavaScript files parse cleanly and tests all 15 JSON schema contracts.*

### Validate Contracts Independently
From `orca/backend`:
```powershell
python scripts/check-contracts.py
```

From `orca/ai-service`:
```powershell
python scripts/verify_contracts.py
```

### Check Backend Syntax Only
```powershell
node scripts/check-syntax.js
```

---

## 5. Live Analysis & API Testing

### A. Check Service Health

```powershell
# Public Gateway (4000)
curl http://localhost:4000/health

# Internal Gateway (4100)
curl http://localhost:4100/health

# AI Service (8000)
curl http://localhost:8000/health
```

---

### B. Trigger a Live Marine Safety Analysis

#### 1. Mumbai Offshore Trip (PowerShell)
```powershell
Invoke-RestMethod -Uri "http://localhost:4000/api/v1/analysis" -Method Post -ContentType "application/json" -Body '{
  "harbor_id": "INBOM",
  "vessel_category": "motorized_fiberglass",
  "gear_type": "gillnet",
  "engine_hp": 40,
  "departure_time": "2026-09-20T06:00:00Z",
  "trip_duration_hours": 12,
  "coordinates": [
    {"point_id": "P1", "latitude": 18.92, "longitude": 72.83},
    {"point_id": "P2", "latitude": 18.98, "longitude": 72.65}
  ]
}'
```

#### 2. Rameswaram / Sri Lanka IMBL Border Trip (cURL)
```bash
curl -X POST http://localhost:4000/api/v1/analysis \
  -H "Content-Type: application/json" \
  -d '{
    "harbor_id": "INRAM",
    "vessel_category": "motorized_fiberglass",
    "gear_type": "bottom_trawl",
    "engine_hp": 60,
    "departure_time": "2026-09-20T05:00:00Z",
    "trip_duration_hours": 10,
    "coordinates": [
      {"point_id": "RAM_COAST", "latitude": 9.288, "longitude": 79.313},
      {"point_id": "PALK_STRAIT_IMBL", "latitude": 9.35, "longitude": 79.52}
    ]
  }'
```

---

### C. Retrieve Analysis Result

Replace `<ANALYSIS_ID>` with the ID returned by the POST request:

```powershell
# PowerShell
Invoke-RestMethod -Uri "http://localhost:4000/api/v1/analysis/<ANALYSIS_ID>"

# cURL
curl http://localhost:4000/api/v1/analysis/<ANALYSIS_ID>
```

---

### D. Run Decision Output Inspector
Runs CLI analysis over the last 2 completed runs stored in MongoDB:
```powershell
cd "orca/backend"
npm run test:decision
```

---

## 6. MongoDB Diagnostic Queries (`mongosh`)

Connect to the local MongoDB database:
```powershell
mongosh mongodb://localhost:27017/orca
```

### Collection Overview & Counts
```javascript
// Check record counts across critical collections
db.gis_layers.countDocuments();       // Expected: 299 (285 ports + 14 zones)
db.pfz_advisories.countDocuments();   // Expected: ~230 active INCOIS records
db.analyses.countDocuments();         // Analysis request records
db.agent_results.countDocuments();     // Detailed agent payloads
db.decisions.countDocuments();        // Final synthesized advisories
```

---

### Inspect GIS Boundaries & Ports
```javascript
// 1. List all 14 authoritative surveyed maritime zones
db.gis_layers.find(
  { layer_type: { $ne: "port" } },
  { layer_name: 1, layer_type: 1, constraint_type: 1, source: 1 }
).pretty();

// 2. Count by layer_type across all layers
db.gis_layers.aggregate([
  { $group: { _id: "$layer_type", total: { $sum: 1 } } }
]);

// 3. Count dedicated fishing harbours vs major ports
db.gis_layers.aggregate([
  { $match: { layer_type: "port" } },
  { $group: { _id: "$properties.port_type", total: { $sum: 1 } } }
]);

// 4. Find harbors that provide emergency storm shelter
db.gis_layers.countDocuments({
  layer_type: "port",
  "properties.shelter_suitable": true
}); // Output: 183

// 5. Inspect the India-Sri Lanka IMBL boundary
db.gis_layers.find({
  layer_name: /Sri Lanka/i
}, { layer_name: 1, layer_type: 1, constraint_type: 1, source: 1 }).pretty();
```

---

### Inspect Live INCOIS PFZ Advisories
```javascript
// 1. Check the most recently fetched INCOIS advisories
db.pfz_advisories.find().sort({ created_at: -1 }).limit(3).pretty();

// 2. Count PFZ advisories by ocean quadrant / sector
db.pfz_advisories.aggregate([
  { $group: { _id: "$sector", count: { $sum: 1 } } }
]);
```

---

### Spatial Geospatial Queries

#### 1. Find Nearest Fishing Harbor to a Given GPS Point
```javascript
// Find nearest harbor within 50 km of Latitude 18.95, Longitude 72.80
db.gis_layers.find({
  layer_type: "port",
  geometry_simplified: {
    $nearSphere: {
      $geometry: {
        type: "Point",
        coordinates: [72.80, 18.95] // [Longitude, Latitude]
      },
      $maxDistance: 50000 // meters
    }
  }
}, { layer_name: 1, "properties.port_type": 1, "properties.shelter_suitable": 1 }).limit(3);
```

#### 2. Check if a GPS Point Falls Within a Restricted Maritime Zone
```javascript
// Point inside Sri Lankan side of Palk Bay: [79.55, 9.35]
db.gis_layers.find({
  layer_type: { $ne: "port" },
  geometry_simplified: {
    $geoIntersects: {
      $geometry: {
        type: "Point",
        coordinates: [79.55, 9.35]
      }
    }
  }
}, { layer_name: 1, layer_type: 1, constraint_type: 1, source: 1 });
```

---

### Inspect Recent Analysis Runs & Results
```javascript
// 1. Get status of latest 3 analyses
db.analyses.find().sort({ created_at: -1 }).limit(3).pretty();

// 2. View latest final recommendation and one-line advisory
db.decisions.find(
  {},
  { analysis_id: 1, recommendation_type: 1, one_line_recommendation: 1, created_at: 1 }
).sort({ created_at: -1 }).limit(3).pretty();

// 3. Inspect individual agent outputs for an analysis
db.agent_results.find({
  analysis_id: "<ANALYSIS_ID>"
}, { agent_name: 1, status: 1, execution_time_ms: 1 });
```

---

## 7. Troubleshooting & Maintenance

### A. Reset and Re-seed Entire GIS Dataset
If data is corrupted or you need a clean wipe:
```powershell
mongosh mongodb://localhost:27017/orca --eval "db.gis_layers.deleteMany({});"
cd "orca/backend"
npm run seed:zones
npm run seed:ports
npm run create-indexes
```

### B. Force Immediate INCOIS PFZ Refresh
If PFZ data is stale or empty:
```powershell
cd "orca/backend"
npm run seed:pfz
```
*Or call the internal trigger:*
```powershell
curl -X POST http://localhost:4100/internal/v1/sync-pfz
```

### C. Check Active Node / Python Processes on Windows
```powershell
Get-Process -Name "node", "python" | Select-Object Id, ProcessName, Path, CPU
```

### D. Verify MongoDB 2dsphere Indexes
```javascript
mongosh mongodb://localhost:27017/orca --eval "db.gis_layers.getIndexes();"
```
*Should display:*
1. `{ "geometry_full": "2dsphere" }`
2. `{ "geometry_simplified": "2dsphere" }`
3. `{ "layer_id": 1 }`
4. `{ "type": 1 }`
