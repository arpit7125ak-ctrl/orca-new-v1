# ORCA — Ocean Risk & Coastal Advisory Platform 🌊🛡️
> **Smart India Hackathon (SIH 26176)** · Intelligent Multi-Agent Marine Safety, Coastal Advisory, and Navigational Decision Support System.

---

## 🌐 Live Production Cloud Deployment

The complete ORCA platform is deployed in production on **Render** paired with a cloud **MongoDB Atlas** cluster:

| Component | Status | Production URL | Technology Stack |
| :--- | :--- | :--- | :--- |
| **Frontend Web App** | 🟢 Live | [`https://orca-frontend-27li.onrender.com`](https://orca-frontend-27li.onrender.com) | React 19, Vite, Tailwind CSS, Leaflet GIS, Web Speech API |
| **Backend API Gateway** | 🟢 Live | [`https://orca-backend-anp5.onrender.com`](https://orca-backend-anp5.onrender.com) | Node.js 20+, Express, Mongoose, JWT auth |
| **AI Multi-Agent Service** | 🟢 Live | [`https://orca-ai-service-b0fx.onrender.com`](https://orca-ai-service-b0fx.onrender.com) | Python 3.11.9, FastAPI, Uvicorn, LangChain, Google Gemini |
| **Database Cluster** | 🟢 Live | `MongoDB Atlas Cluster0 (AWS Mumbai)` | 299 Maritime Boundary/Port Layers, 230 PFZ Hotspot Lines |

---

## 🧭 Multi-Activity Platform Scope

ORCA is engineered as a **General Ocean Risk and Coastal Advisory System** serving all marine sectors with neutral, customized risk modeling:
- 🏖️ **Coastal Tourism**: Beach excursions, shallow water safety, sun/wind exposure.
- ⛵ **Recreational Boating**: Pleasure craft, sailing yachts, harbor navigation, marina approaches.
- 🤿 **Diving & Snorkeling**: Underwater visibility, thermoclines, subsurface currents, wave surge.
- 🏄 **Surfing & Watersports**: Wave period, breaking wave height, onshore/offshore wind balance.
- 🚢 **Commercial Shipping & Cargo**: Vessel draft restrictions, approach corridors, channel depth.
- 🔬 **Marine Scientific Research**: Oceanographic expeditions, hydrographic sampling, sensor buoys.
- 🐟 **Fisheries & Aquaculture**: INCOIS PFZ line opportunities, SST gradients, chlorophyll-a upwelling.

---

## 📁 Repository Layout

```
orca/
├── frontend/         # React 19 + Vite coastal GIS interface & Deck Mode UI
├── backend/          # Public API gateway (Port 4000) & Internal listener (:4100)
├── ai-service/       # Python 3.11 FastAPI service with 7 live domain agents & risk engine
├── contracts/        # 44 locked JSON Schema specifications enforcing strict contracts
├── shared-config/    # Canonical units, activities, vessel specs, and multilingual data
├── render.yaml       # Official Render 1-click infrastructure blueprint
└── scripts/          # Database seeding, Atlas migration, and contract validation tools
```

---

## ⚡ Quick Start (Local Development)

### 1. Prerequisites
- Node.js 20+ and npm 10+
- Python 3.11.9 with pip
- MongoDB Atlas cluster or local MongoDB 7.0

### 2. Start Python AI Service (Port 8000)
```powershell
cd ai-service
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
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

## 🛡️ Contract Compliance & Health Checks

Verify zero schema drift and full contract integrity across all endpoints:

```powershell
# Backend contract verification (15/15 tests)
python backend/scripts/check-contracts.py

# AI Service multi-agent contract verification (26/26 tests)
python ai-service/scripts/verify_contracts.py
```

---

*Authored by Team Nautilus for SIH 26176.*

