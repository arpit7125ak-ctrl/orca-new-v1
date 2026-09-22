# ORCA Frontend Architecture & Implementation (FINAL)

**Document Reference:** `frontend_final_doc.md`  
**Derived From:** `frontend_plan.md` (Rev 2.0, locked), `ORCA_SIH26176_Detailed_Architecture_and_Features_FINAL.md`, and contracts.  
**System Status:** **100% Implemented, Bundled, and Verified.**

---

## 0. Non-Negotiable Rules Enforced

From §2.1.4, §102, §116, and the project's **never-fabricate** principle:
1. **Frontend talks ONLY to the Backend**: All network calls go through the Node.js/Express Public Gateway (`http://localhost:4000/api/v1` via Vite/serve proxy). Never directly to AI Service, LLM, or MongoDB.
2. **Frontend renders, never decides**: Risk scores, agent selection, safety floors, geofence status, and routing are computed deterministically by the backend pipelines.
3. **No credentials reach the frontend**: All provider API keys (Open-Meteo, INCOIS, Gemini) reside strictly within server environment variables.
4. **Never fabricate**: Missing telemetry renders with explicit notices or "—", never silently interpolated.
5. **Cached/offline transparency**: Cached advisories explicitly show their age: *"Last updated X min ago."*
6. **Mobile-first & Deck-tested**: Traffic-light colors, high-contrast Sunlight Mode, audio speech in 6 regional Indian languages, large touch targets.

---

## 1. Confirmed Tech Stack & Bundler Architecture

- **UI Framework**: React 19 (`react`, `react-dom`)
- **Styling**: Tailwind CSS v4 JIT + Custom CSS for Sunlight Deck Mode and Leaflet dark popups
- **Mapping & GIS**: Leaflet 1.9.4 with OpenStreetMap standard tiles (100% free of CartoDB watermarks)
- **Icons**: Lucide React (`lucide-react` v1.46)
- **Audio & Speech**: Web Speech API (`speechSynthesis` + `webkitSpeechRecognition`) supporting English, Hindi, Tamil, Telugu, Malayalam, Bengali
- **Production Bundler**: `esbuild` with `--jsx=automatic` and ESM target (builds in ~1.4s with minimal memory overhead)
- **Runtime Server**: Node.js static server (`serve.js`) with built-in API proxy to port 4000

---

## 2. Risk Color System & Verdict Badges

Implemented consistently across map pins, quadrant cards, charts, and header banners:

| Score Range | Severity Level | UI Color | Indicator Meaning |
| :--- | :--- | :--- | :--- |
| **0 – 34** | `SAFE` | Green (`#10b981`) | Optimal sea conditions; full operational green light |
| **35 – 64** | `CAUTION` | Yellow / Amber (`#f59e0b`) | Moderate swell/wind; vigilance required near harbor mouth |
| **65 – 84** | `UNSAFE` | Orange (`#f97316`) | Adverse sea state; small craft warned to return |
| **85 – 100** | `DANGEROUS` | Red (`#ef4444`) | Severe squall/cyclone; mandatory safety floor enforced |
| **N/A** | `LAND / PROHIBITED` | Gray (`#64748b`) | Not applicable / restricted coastal zone |

---

## 3. Navigation Architecture

Matching §3 of `frontend_plan.md`, the platform is organized into an accessible top/bottom bar and a persistent floating copilot:

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  ORCA SIH26176   [Home] [Setup] [Advisory Hub] [Route] [At-Sea] [Alerts] [More▾] │
└──────────────────────────────────────────────────────────────────────────────────┘
```

- **Primary Navigation Tabs**:
  - `Home`: Natural language query, quick chips, cached advisory resume
  - `Setup`: Parametric mission setup + interactive click-to-pin map
  - `Advisory Hub`: Comprehensive Decision Hero, 9-point spatial matrix, XAI
  - `Route`: A*/Dijkstra coastal route planner with per-segment risk
  - `At-Sea Guard`: Dedicated high-contrast Geofence deck mode
  - `Alerts`: Proactive SMS/Push alert subscriptions + broadcast inbox
  - `History`: MongoDB mission history archive
  - `GIS`: Full-screen 22-layer oceanographic explorer
  - `Profile`: Operator profile, default vessel, Sunlight Mode, offline cache
- **Floating "Ask ORCA" Copilot (§86)**:
  - Persistent button in the bottom-right corner of every screen
  - Opens a slide-out drawer maintaining the active analysis reference

---

## 4. Complete Page Inventory & Component Mapping

| # | Page Name | Route / Tab | Component File | Description |
|---|---|---|---|---|
| **1** | **Home / Ask ORCA** | `landing` | `HomeAskOrca.jsx` | Natural query box, voice mic, quick chips, refine drawer, cached banner |
| **2** | **Mission Setup** | `input` | `AnalysisInputPage.jsx` | Location inputs, `📍 Use my location`, `🗺️ Click on map`, activity/vessel pickers |
| **2P**| **Live Progress** | `loading` | `AnalysisLoadingPage.jsx` | "ORCA IS ANALYZING" step-by-step checklist of all 6 agents |
| **3** | **Advisory Dashboard** | `results` | `DecisionResultsPage.jsx` | Section 77 Decision Hero, 9-point matrix, internal tabs (Charts, Evidence, XAI) |
| **4** | **Point Detail Sheet**| *Modal* | `PointDetailSheet.jsx` | Deep dive into $P0$–$P8$: Baseline $\rightarrow$ LLM adjust $\rightarrow$ Hard floor $\rightarrow$ Final |
| **5** | **Maritime Chat** | `chat` / *Drawer* | `MaritimeChat.jsx` | Multi-turn speech-enabled advisory copilot |
| **6** | **Map Explorer** | `gis` | `GisExplorer.jsx` | Full-screen Leaflet canvas with 22 GIS layers |
| **7** | **My Advisories** | `history` | `HistoryPage.jsx` | Chronological log of past evaluations stored in MongoDB |
| **8** | **Alerts & Inbox** | `alerts` | `AlertsPage.jsx` | Proactive alert subscriptions setup and recent warning inbox |
| **9** | **Route Planner** | `route` | `RoutePlannerPage.jsx` | Deterministic passage planning with segment-by-segment risk coloring |
| **10**| **Geofence Deck Mode**| `geofence` | `GeofenceMonitor.jsx` | High-contrast full-screen deck mode (CLEAR / APPROACHING / INSIDE) |
| **11**| **Shareable Report** | *Modal* | `ReportModal.jsx` | Printable official advisory bulletin with copy/export |
| **14**| **Profile & Settings**| `profile` | `ProfileSettingsPage.jsx` | Operator role, default vessel/activity, Sunlight Mode, offline cache |
| **§86**| **Floating Copilot** | *Universal*| `FloatingChatButton.jsx` | Quick-access floating drawer on all views |

---

## 5. API Endpoints & Contract Wire-Up

All frontend operations correspond directly to backend endpoints:

| Action | HTTP Method | Endpoint | Response / Purpose |
| :--- | :--- | :--- | :--- |
| **System Health** | `GET` | `/health` | Live backend connectivity & uptime monitor |
| **Configuration** | `GET` | `/api/v1/config` | Populates valid activities, vessels, languages |
| **Submit Analysis** | `POST` | `/api/v1/analysis` | Dispatches multi-agent planning pipeline |
| **Poll Status** | `GET` | `/api/v1/analysis/:id/status` | Real-time agent status polling (1.2s interval) |
| **Fetch Result** | `GET` | `/api/v1/analysis/:id` | Full decision payload (points, decision, traces) |
| **Latest Analysis** | `GET` | `/api/v1/analysis/latest` | Hydrates most recent real MongoDB analysis |
| **Chat Message** | `POST` | `/api/v1/chat/message` | Conversational query with background dispatch |
| **Geofence Check** | `POST` | `/api/v1/geofence/check` | Evaluates coordinate distance to IMBL & MPAs |
| **GIS Layers** | `GET` | `/api/v1/map/layers` | 22 oceanographic raster & vector layer metadata |
| **Route Planner** | `POST` | `/api/v1/route` | Computes A* waypoints and passage hazard metrics |
| **Create Alert Sub**| `POST` | `/api/v1/alerts/subscriptions` | Registers automated notification triggers |
| **Advisory Report** | `GET` | `/api/v1/report/:id` | Markdown / printable advisory document |

---

## 6. Verification & How to Demo to Judges

1. Open your browser to the live production deployment: **[`https://orca-frontend-27li.onrender.com`](https://orca-frontend-27li.onrender.com)** (or local **`http://localhost:5173`**).
2. **Page 1 (Home)**: Notice the clean "Ask ORCA" natural-language prompt, quick-question chips, and the cached advisory banner.
3. Click **"Setup"** or **"Start Analysis"** to view **Page 2**:
   - Tap **"Use my location"** or click anywhere on the ocean map to drop a pin.
   - Select your target activity (`Coastal Tourism`, `Recreational Boating`, `Diving & Snorkeling`, `Surfing & Watersports`, `Commercial Shipping`, `Marine Research`, or `Coastal Fishing`) and vessel type (`FRP Motorized Craft`, `Trawler`, `Catamaran`, etc.).
   - Click **`[ ANALYZE SAFETY ]`**.
4. Watch **Page 2 Progress ("ORCA IS ANALYZING")**:
   - Real-time animated checklist displaying Location, Weather, Ocean, GIS, Cyclone, PFZ, Risk, and Decision agents collaborating in parallel.
5. Review **Page 3 (Advisory Hub)**:
   - Listen to the **audio voice readout** in English or Indian regional languages (Hindi, Tamil, Telugu, Malayalam, Bengali).
   - Inspect the **9-point spatial matrix ($P0$–$P8$)**.
   - Click any point in the matrix to open the **Page 4 Point Detail Sheet** showing the Section 78 Explainable AI score waterfall.
   - Switch internal tabs to **Evidence & Sources (§81)**, **Data Quality (§80)**, and **Reasoning (§79)**.
6. Click **"Route"** in the top navigation to demonstrate **Page 9 Route Planner**.
7. Click **"At-Sea Guard"** to showcase **Page 10 Geofence Mode** (designed for fisherman deck glare with audible threshold alarms).
8. Click **"Alerts"** to show **Page 8 Proactive Alert Subscriptions**.
9. Tap the floating **"Ask ORCA"** button in the bottom right corner from any screen to demonstrate the multi-turn conversational AI copilot.

---

## 7. Future Frontend Roadmap & Final Enterprise UI Architecture

Following completion of all target SIH roadmap goals, the ORCA frontend transitions from a browser dashboard into an **All-Domain Marine Operating System (MMOS)**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                 ORCA FINAL ENTERPRISE FRONTEND ARCHITECTURE                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌────────────────────────┐  ┌────────────────────────┐  ┌───────────────┐  │
│  │   Offline Tile Engine  │  │   Edge AI WebGPU Core  │  │ BLE / NMEA Hub│  │
│  │  (MapLibre + IndexedDB)│  │ (ONNX In-Browser Risk) │  │(AIS/Sonar RX) │  │
│  └───────────┬────────────┘  └───────────┬────────────┘  └───────┬───────┘  │
│              │                           │                       │          │
│              ▼                           ▼                       ▼          │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                 HIGH-CONTRAST MULTI-ACTIVITY CLIENT                   │  │
│  │        React 19 + PWA ServiceWorker + WebSocket Event Mesh            │  │
│  └───────────────────────────────────┬───────────────────────────────────┘  │
│                                      │                                      │
│        ┌─────────────────────────────┼─────────────────────────────┐        │
│        ▼                             ▼                             ▼        │
│  ┌───────────┐                 ┌───────────┐                 ┌───────────┐  │
│  │  SOLO PWA │                 │ FLEET OPS │                 │ RESCUE HQ │  │
│  │(Deck Mode)│                 │ (Cockpit) │                 │(SAR Bridge│  │
│  └───────────┘                 └───────────┘                 └───────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.1 Progressive Web App (PWA) & Offline Vector Tile Packs
- **Service Worker Tile Caching**: Vector tile packs (`.pbf` / `.mbtiles`) covering India's entire Exclusive Economic Zone (EEZ) cached locally via Cache API and IndexedDB.
- **True Zero-Connectivity Operation**: When vessels lose 4G/5G beyond 12 nautical miles, the UI seamlessly transitions to cached maritime boundaries, depth contours, and offline tide tables.

### 7.2 WebSockets & SSE Real-Time Event Mesh
- **Live Vessel Telemetry**: Continuous bi-directional WebSocket connection streaming live GPS track, speed over ground (SOG), and course over ground (COG).
- **Sub-Second Geofence Alarms**: Audible siren and visual strobe triggered when a vessel drifts within 500 meters of the India-Sri Lanka IMBL or an active marine protected sanctuary.

### 7.3 On-Device Edge AI via ONNX Runtime Web / WebGPU
- **Client-Side Risk Computation**: When completely disconnected from satellite or cellular networks, a lightweight quantized risk model runs directly in-browser using WebAssembly/WebGPU, evaluating local wave, current, and wind inputs in under 50ms without server roundtrips.

### 7.4 Multi-Vessel Fleet Command Center (Cockpit Mode)
- **Fleet Manager Dashboard**: Multi-vessel tracking map with coordinate clustering, status color coding (Safe, In Distress, Approaching Border), and coordinated group broadcast messaging.
- **Split-Screen Marine Radar & AIS Overlay**: Integration with MarineTraffic/AisHub to visualize nearby commercial vessel tracks, cargo tankers, and naval exclusion zones.

### 7.5 Hardware Sensor Bridge (NMEA 0183 / 2000 & BLE)
- **Direct Sonar & Anemometer Input**: Connects via Web Bluetooth or Serial API to vessel transducers, anemometers, and GPS compasses, feeding live physical measurements directly into the advisory engine.

