# 05: AI Service Codebase Deep Dive

This document provides a comprehensive breakdown of the Python/FastAPI AI Service located in `orca/ai-service/`.

---

## 1. Directory Tree Overview

```text
orca/ai-service/
├── app/
│   ├── main.py                # FastAPI HTTP server & endpoint definitions
│   ├── config/
│   │   ├── settings.py        # Pydantic environment configuration
│   │   └── registry.py        # Supported activities, vessel limits, canonical units
│   ├── pipeline/
│   │   └── executor.py        # Master pipeline coordinator (Planner -> Agents -> Risk -> Decision)
│   ├── planner/
│   │   ├── planner.py         # Resolves intents and corridor sampling
│   │   ├── location.py        # Resolves coordinate boundaries and place names
│   │   ├── sampling.py        # Generates corridor points P1..P8
│   │   └── timewindow.py      # Computes temporal forecast windows
│   ├── agents/
│   │   └── base.py            # Generic parallel agent runner with asyncio semaphores
│   ├── adapters/
│   │   ├── open_meteo.py      # Live numerical weather and wave models
│   │   ├── incois_pfz.py      # Live INCOIS satellite PFZ geometry and distance math
│   │   ├── mongo_gis.py       # MongoDB geospatial queries for EEZ, MPAs, bathymetry
│   │   └── mock.py            # Deterministic simulation fallbacks (cyclone, tide, ecosystem)
│   ├── risk/
│   │   └── risk_evaluator.py  # Mathematical risk scoring & mandatory safety floors
│   ├── decision/
│   │   └── decision_agent.py  # Preferred point selection & Gemini narrative synthesis
│   └── clients/
│       ├── gemini_client.py   # Google Gemini LLM caller with retry logic
│       └── backend_client.py  # Signed JWT internal callback client to port 4100
```

---

## 2. Master Pipeline Coordinator (`app/pipeline/executor.py`)

When the backend hands off a request via `POST /run`, `executor.py` executes the entire lifecycle:
1. Emits initial progress update: `stage: "planner"`.
2. Runs `Planner`: resolves location, computes forecast window, and samples operational corridor points P1..P8.
3. Emits progress: `stage: "agents"`.
4. Runs parallel domain agents concurrently via `run_agents_parallel()` in `base.py`.
5. Emits progress: `stage: "risk"`.
6. Passes normalized evidence to the `RiskEvaluator` for deterministic safety scoring.
7. Emits progress: `stage: "decision"`.
8. Calls `DecisionAgent` to select the safest/highest-yield point and synthesize vernacular explanation.
9. Posts the completed payload back to the Node.js Internal Gateway at `http://localhost:4100/api/v1/internal/result`.

---

## 3. The Corridor Planner (`app/planner/`)

Fishermen do not stay locked at a single GPS coordinate—they sail along a trajectory.
* **`sampling.py`:** Takes the origin coordinate and derives up to 8 corridor points ($P_1$ to $P_8$) spanning the vessel's operational radius (e.g., $5\text{ km}$ offshore for small boats, $25\text{ km}$ for trawlers).
* Each sampled point is evaluated independently by all agents, ensuring hazards further out along the route are detected before the boat leaves harbor.

---

## 4. Generic Multi-Agent Runner (`app/agents/base.py`)

* **Single Runner Pattern:** Rather than writing seven complex orchestrator classes, `base.py` provides one generic, highly optimized runner.
* **Concurrency:** Uses `asyncio.gather` bounded by `asyncio.Semaphore(8)` to run all agents in parallel without exhausting CPU or sockets.
* **Fault Isolation (Section 41):** If an external service times out, the runner intercepts the error and returns `status: "failed"` with an error category. The pipeline **never crashes**; downstream risk scoring continues with whatever evidence is available.

---

## 5. Live Adapters (`app/adapters/`)

### `app/adapters/open_meteo.py` (Live Weather & Wave Models)
* Queries Open-Meteo Weather API for real-time wind speed, gusts, rain, and visibility.
* Queries Open-Meteo Marine API for significant wave height, primary swell period, and current velocity.
* **Canonical Unit Conversions:**
  * Wind: Converted to $\text{m/s}$.
  * Visibility: Converted from meters to $\text{km}$.
  * Wave & Swell: Standardized in meters ($m$).
  * Currents: Converted from $\text{km/h}$ to $\text{m/s}$.

### `app/adapters/incois_pfz.py` (Live Satellite PFZ Adapter)
* Connects directly to the MongoDB `pfz_advisories` collection (populated from INCOIS GeoServer).
* **MultiLineString Geometry Math:** Recursively parses `LineString` and `MultiLineString` coordinate arrays from satellite contours.
* **Distance Calculation:** Calculates the shortest perpendicular distance (in $\text{km}$) from the fisherman's position to the nearest active satellite fishing line.
* Returns thermal SST gradients, target fish species (e.g., Yellowfin Tuna, Mackerel, Sardines), and suitability scores ($0.0$ to $1.0$).

### `app/adapters/mongo_gis.py` (Spatial GIS Adapter)
* Queries MongoDB `gis_layers` using geospatial `$geoIntersects` and `$nearSphere`.
* Measures distance to the International Maritime Boundary Line (IMBL).
* Checks if the vessel coordinate falls inside any Marine Protected Area (MPA) or prohibited zone.

### `app/adapters/imd_cyclone.py` (Live Cyclone & Official Marine Warnings Adapter)
* Connects directly to the **NDMA SACHET / IMD CAP portal** (`sachet.ndma.gov.in/cap_public_website/FetchAllAlertDetails`).
* **15-Minute Cache:** In-memory caching ensures lightning-fast queries across corridor points ($<1\text{ ms}$).
* **Spatial Matching:** Uses Haversine distance math to identify storm centroids within 120 km of the vessel.
* **Dual-Layer Physical Cross-Check:** Checks Open-Meteo barometric pressure ($<995\text{ hPa}$) and sustained gale winds ($>17.5\text{ m/s}$).
* **Provenanced Provenance:** Extracts authentic bulletin IDs (e.g. `IMD-CAP-178982...`), official message, severity, and enforces the mandatory safety floor of 85.

### `app/adapters/copernicus_ecosystem.py` (Live Biogeochemical & Ecosystem Adapter)
* Implements the **Copernicus Marine Service (CMEMS)** Global Ocean Biogeochemical Analysis and Forecast specifications (`GLOBAL_ANALYSISFORECAST_BGC_001_028` / PISCES model) alongside **ISRO MOSDAC Oceansat-3 (OCM-3)** regional parameters.
* **Biochemical Dynamics Modeled:**
  * **Chlorophyll-a (`chlorophyll_mg_m3`):** Resolves coastal nutrient runoff and upwelling ($1.2\text{ to }4.5\text{ mg/m}^3$) versus oligotrophic deep ocean ($0.15\text{ to }0.7\text{ mg/m}^3$), including the Ganges-Brahmaputra estuarine plume and seasonal SW monsoon coastal upwelling along the western seaboard.
  * **Dissolved Oxygen (`dissolved_oxygen_mmol_m3`):** Models surface oxygen saturation ($190\text{ to }235\text{ mmol/m}^3$) and monitors for hypoxic warning conditions ($<90\text{ mmol/m}^3$).
* **Canonical Units:** Strict enforcement of $\text{mg/m}^3$ and $\text{mmol/m}^3$ conforming to `contracts/Measurement.json`.

### `app/adapters/harmonic_tide.py` (Live & Astronomical Harmonic Tide Adapter)
* Connects to **Open-Meteo Marine** for numerical sea level predictions (`Tide-MSL`).
* **Astronomical Harmonic Fallback:** Implements Survey of India (SOI) & INCOIS principal tidal harmonic constituents ($M_2, S_2, K_1, O_1$) with regional amplitude calibration across the Indian maritime zone (from macro-tidal Gulf of Khambhat to micro-tidal Cochin and resonant Sundarbans).
* **Parameters Produced:**
  * `tide_height_m`: Continuous tidal elevation relative to mean sea level.
  * `tidal_current_ms`: Horizontal tidal stream velocity derived from $|dh/dt|$ and shallow-water bathymetric scaling ($0.05\text{ to }1.8\text{ m/s}$).

---

## 6. Deterministic Risk Engine (`app/risk/risk_evaluator.py`)

Safety decisions in ORCA are **mathematical and deterministic**, never left to generative AI hallucinations:
* Evaluates all parameters against vessel-specific physical thresholds (e.g., maximum safe wave height for a non-motorized catamaran is $1.2\text{ m}$; for a mechanized trawler, it is $2.8\text{ m}$).
* **Mandatory Floor Rules:**
  * If significant wave height exceeds danger threshold $\rightarrow$ forces risk score $\ge 75$ (`DO NOT GO`).
  * If official cyclone alert is active $\rightarrow$ forces risk score $\ge 90$ (`DO NOT GO`).
  * If coordinate is inside a prohibited marine sanctuary $\rightarrow$ triggers **Hard Exclusion** (`EXCLUDED`).

---

## 7. Decision Synthesizer (`app/decision/decision_agent.py`)

* **Point Selection:** Evaluates all corridor points ($P_1..P_8$), eliminating excluded points, and selects the **preferred point** having the lowest risk score and highest PFZ suitability.
* **Overall Recommendation:**
  * Risk score $< 40 \rightarrow$ **`GO`** (Safe to fish).
  * Risk score $40 - 69 \rightarrow$ **`GO WITH CAUTION`** (Heightened alertness required).
  * Risk score $\ge 70 \rightarrow$ **`DO NOT GO`** (Dangerous conditions).
* **Vernacular Explanation:** Calls Google Gemini (`gemini-1.5-flash` or `gemini-2.0-flash`) to generate a clear, 3-bullet summary in the user's native tongue (Hindi, Tamil, etc.).
* **Deterministic Fallback:** If Gemini is unreachable or no API key is provided, generates rule-based template explanations without failing the request.
