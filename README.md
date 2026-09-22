# ORCA — Ocean Risk & Coastal Advisory Platform 🌊🛡️
> **Smart India Hackathon (SIH 26176)** · Intelligent Multi-Agent Marine Safety, Coastal Advisory, and Navigational Decision Support System.

---

## 🌐 Production Cloud Deployment

The complete ORCA platform is deployed in production on **Render** paired with a cloud **MongoDB Atlas** cluster:

| Component | Status | Production URL | Technology Stack |
| :--- | :--- | :--- | :--- |
| **Frontend Web App** | 🟢 Live | [`https://orca-frontend-27li.onrender.com`](https://orca-frontend-27li.onrender.com) | React 19, Vite, Tailwind CSS, Leaflet GIS, Web Push, Web Speech API |
| **Backend API Gateway** | 🟢 Live | [`https://orca-backend-anp5.onrender.com`](https://orca-backend-anp5.onrender.com) | Node.js 20+, Express, Mongoose, Native Test Runner |
| **AI Multi-Agent Service** | 🟢 Live | [`https://orca-ai-service-b0fx.onrender.com`](https://orca-ai-service-b0fx.onrender.com) | Python 3.11+, FastAPI, Uvicorn, Honest Metocean Adapters |
| **Database Cluster** | 🟢 Live | `MongoDB Atlas Cluster0 (AWS Mumbai)` | 2dsphere Spatial Indexes, GIS Layers, PFZ Lines |

---

## 🧭 System Capabilities & Honest Operational Scope

ORCA operates under a strict **Zero Fabrication Policy**: missing telemetry is never replaced with simulated dummy data, and system boundaries are honestly reported:

1. **Active Notification Channel**: 
   - **Web Push Notifications** (PWA Service Worker) is the active proactive alert channel (§70). 
   - Browser push popups require operator VAPID keys (`VAPID_PUBLIC_KEY` & `VAPID_PRIVATE_KEY`) in the backend environment.
   - SMS, WhatsApp, and IVR voice broadcasts are designed architectural phases (see contracts) and are not active transport channels in this deployment.
2. **Boundary Integrity & GIS Verification**:
   - Bundled boundary layers (e.g. Marine National Parks, EEZ limits) are designated as `verification: "approximate"` and styled with distinct visual indicators.
   - Only official GeoJSON ingested through `backend/scripts/import-gis-geojson.js` with verifiable source URLs and passing landmark bounds checks is marked `verification: "authoritative"`. See [`docs/GIS_DATA.md`](docs/GIS_DATA.md).
3. **Palk Bay / Gulf of Mannar Routing Sector**:
   - Automated routing across the sensitive Palk Strait / Sri Lanka IMBL corridor is **deliberately gated**. 
   - Inquiries through this sector return `status: "no_safe_route"` with explicit notification until authoritative bilateral survey coordinates are ingested.
4. **Ocean Productivity & Chlorophyll Data**:
   - Multi-year Chlorophyll-a trend monitoring (§72) requires an operator-configured satellite ERDDAP product. When unconfigured, ORCA honestly states that optical chlorophyll is unavailable and utilizes Sea Surface Temperature (SST) as an environmental proxy. See [`docs/DATA_SOURCES.md`](docs/DATA_SOURCES.md).

---

## 📁 Repository Layout

```
orca/
├── frontend/         # React 19 + Vite coastal GIS interface, PWA Service Worker & Deck Mode
├── backend/          # Public API gateway (Port 4000) & Internal listener (:4100)
├── ai-service/       # Python 3.11 FastAPI service with honest metocean adapters & risk engine
├── contracts/        # 44 locked JSON Schema specifications enforcing strict contracts
├── contracts.zip     # Authoritative contract distribution archive
├── shared-config/    # Canonical units, activities, vessel specs, and 10 Indian languages
├── docs/             # Technical guides: GIS_DATA.md, DATA_SOURCES.md, architecture deep dives
└── render.yaml       # Render infrastructure blueprint
```

---

## ⚡ Quick Start (Local Development)

### 1. Prerequisites
- Node.js 20+ and npm 10+
- Python 3.11+ with venv
- MongoDB Atlas cluster or local MongoDB 7.0

### 2. Start Python AI Service (Port 8000)
```powershell
cd ai-service
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### 3. Start Backend Services (Ports 4000 & 4100)
```powershell
cd backend
npm install
npm run seed:zones && npm run seed:ports && npm run create-indexes
node src/server.js
```

### 4. Start Frontend Client (Port 5173)
```powershell
cd frontend
npm install
npm run dev
```

---

## 🛡️ Automated Test Suites & Verification

ORCA includes comprehensive test suites across all three tiers:

```powershell
# 1. AI Service Unit & Honesty Tests (39 tests)
python ai-service/tests/test_orca_ai.py

# 2. Backend Unit & Validation Tests (21 tests, Node.js native test runner)
cd backend && node --test test/*.test.js

# 3. Frontend Production Build & Unit Tests
cd frontend && npm run build && npm test

# 4. JSON Schema Contract Integrity (44/44 schemas)
node backend/scripts/validate-schemas.js
python backend/scripts/check-contracts.py
```

---

*Authored by Team Nautilus for Smart India Hackathon (SIH 26176).*
