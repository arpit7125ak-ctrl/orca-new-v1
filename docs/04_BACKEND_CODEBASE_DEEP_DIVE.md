# 04: Backend Codebase Deep Dive

This document provides a line-by-line and file-by-file breakdown of every component in `orca/backend/`.

---

## 1. Directory Tree Overview

```text
orca/backend/
├── package.json               # Node.js dependencies and lifecycle scripts
├── scripts/                   # CLI maintenance, seeding, and verification scripts
│   ├── check-syntax.js        # Verifies all 84 JS files parse without syntax errors
│   ├── check-contracts.py     # Verifies API payloads against JSON Schema contracts
│   ├── seed-pfz.js            # CLI runner for INCOIS PFZ sync
│   ├── seed-gis-layers.js     # Seeds EEZ, MPAs, bathymetry into MongoDB
│   └── seed-ports.js          # Seeds 24 major/minor Indian ports
└── src/
    ├── server.js              # Public API Gateway (Port 4000)
    ├── internal-server.js     # Internal Protected Gateway (Port 4100)
    ├── worker.js              # Background Scheduler & Alert Worker
    ├── app.js                 # Express application builder & middleware pipeline
    ├── config/                # Environment variables, constants, and registries
    ├── db/                    # MongoDB connection and 12 Mongoose models
    ├── middleware/            # Security, rate limiting, and contract validation
    ├── modules/               # Domain feature controllers, routes, and services
    ├── clients/               # HTTP clients for AI Service and Bhashini
    ├── observability/         # Pino structured logging
    └── i18n/                  # Multi-language templates (Hindi, Tamil, etc.)
```

---

## 2. Server Entry Points

### `src/server.js` (Public API Gateway — Port 4000)
* **Purpose:** Primary public entry point receiving user requests from mobile and web apps.
* **Order of Execution:**
  1. Connects to MongoDB first (`await connect()`). Never binds the port before the database is ready.
  2. Registers all 12 Mongoose models to trigger index builds.
  3. Binds HTTP port 4000 with raised timeouts (`headersTimeout = 65000ms`, `keepAliveTimeout = 60000ms`) to support slow mobile connections.
  4. Registers the **automatic daily 8:00 PM IST INCOIS PFZ sync cron** (`limits.PFZ_SYNC_CRON = '0 20 * * *'`).
  5. Runs a non-blocking startup check: if MongoDB has 0 PFZ advisories, automatically triggers initial background sync.
  6. Manages graceful shutdown (`SIGINT`, `SIGTERM`), draining in-flight requests and stopping cron jobs cleanly.

### `src/internal-server.js` (Internal Callback Gateway — Port 4100)
* **Purpose:** Dedicated private interface for AI Service callbacks.
* **Why it is isolated:** Ensures external public users cannot inject fake analysis results.
* **Endpoints:**
  * `POST /api/v1/internal/progress`: Receives real-time progress messages from AI Service agents.
  * `POST /api/v1/internal/result`: Receives final risk evaluation and synthesized decision.
* **Security:** Every request is authenticated using a signed internal JWT token (`middleware/internalAuth.js`).

### `src/worker.js` (Proactive Background Alert Worker)
* **Purpose:** Runs unattended background cron jobs.
* **Jobs Executed:**
  * Evaluates active alert subscriptions against live weather and high wave forecasts every 30 minutes (`ALERT_SCHEDULER_CRON`).
  * Triggers daily INCOIS PFZ satellite synchronization at 8:00 PM IST.
* **Fault Tolerance:** Catches `unhandledRejection` and logs warnings without exiting, ensuring a single failed subscription check never takes down proactive alerting for other users.

### `src/app.js` (Express Application Builder)
* **Purpose:** Assembles middleware, route mounts, and global error handlers.
* **Middleware Chain:**
  1. `requestId`: Assigns a unique UUID to every incoming HTTP request for tracing.
  2. `helmet`: Configures security headers.
  3. `cors`: Restricts cross-origin requests to configured frontend origins.
  4. `express.json`: Parses incoming JSON with body size limits.
  5. `generalLimiter`: Protects against brute-force DDoS attacks.
  6. Route Mounts: `/api/v1/analysis`, `/api/v1/map`, `/api/v1/geofence`, etc.
  7. `errorHandler`: Standardized error formatting conforming to `ErrorInfo.json`.

---

## 3. Database Layer (`src/db/`)

### `src/db/connection.js`
* Manages the Mongoose MongoDB connection pool with auto-reconnection and exponential backoff.

### Core Mongoose Models (`src/db/models/`)
| Model File | Collection Name | Purpose & Key Fields | Indexes |
| :--- | :--- | :--- | :--- |
| `analysis.model.js` | `analyses` | Tracks each user request lifecycle (`analysis_id`, `status`, `stage`, `coordinate`, `vessel_type`, `activity`). | `analysis_id` (unique), `created_at` |
| `pfzAdvisory.model.js` | `pfz_advisories` | Stores live INCOIS satellite lines, sector names, SST gradients, and target species. | `geometry` (`2dsphere`), `active`, `valid_to` |
| `gisLayer.model.js` | `gis_layers` | Stores maritime boundaries (EEZ), Marine Protected Areas, and depth contours. | `geometry_simplified` (`2dsphere`), `layer_type` |
| `decision.model.js` | `decisions` | Stores final safety verdict (`status: go/caution/do_not_go`), confidence score, and natural language summary. | `analysis_id` (unique) |
| `riskResult.model.js` | `risk_results` | Stores raw numerical risk scores (0-100) and data quality per sampled corridor point. | `analysis_id` (unique) |
| `alertSubscription.model.js` | `alert_subscriptions` | Fishermen subscriptions for proactive storm/wave push alerts. | `user_id`, `active`, `last_checked_at` |
| `alertEvent.model.js` | `alert_events` | Historical audit log of all pushed alerts with deduplication hashes. | `dedup_hash`, `created_at` |
| `geofenceEvent.model.js` | `geofence_events` | Records when a vessel approaches or breaches an international boundary. | `vessel_id`, `timestamp` |

---

## 4. Feature Modules (`src/modules/`)

### `src/modules/analysis/`
* **`analysis.controller.js`:** Handles `POST /api/v1/analysis`, `GET /:id`, and `GET /:id/result`.
* **`analysis.service.js`:** Orchestrates the asynchronous handoff to the AI Service over HTTP.
* **`statusBuilder.js` & `resultBuilder.js`:** Transforms internal MongoDB documents into exact contract shapes conforming to `AnalysisStatusResponse.json` and `AnalysisResultResponse.json`.

### `src/modules/pfz/`
* **`pfzSync.service.js`:** 
  * Queries live INCOIS GeoServer WFS endpoint.
  * Segregates 115 features across Indian coastal states.
  * Runs idempotent upsert (`updateOne(..., { $set: doc }, { upsert: true })`).
  * Implements 48-hour zero-downtime extension fallback.

### `src/modules/voice/`
* **`voice.controller.js` & `voice.service.js`:**
  * Integrates with Bhashini TTS and ASR APIs.
  * Caches synthesized audio natively in MongoDB (`voiceCache.model.js`) as `mongodb.Binary` coupled with the summary text, using a 24-hour TTL to save bandwidth/latency.
  * Uses Two-Phase Bhashini authentication (Pipeline ID resolution -> Inference token execution).
  * Validates inbound MP3 audio chunks via MPEG sync word (`0xFFE0`) sniffing in `audioEncoder.js`, rejecting invalid formats (like WebM) safely without FFmpeg.

### `src/modules/geofence/`
* **`geofence.service.js`:** Evaluates vessel GPS against MongoDB `gis_layers` to detect proximity to the International Maritime Boundary Line (IMBL).
* Returns `status: "clear"`, `"warning"`, or `"breach"` in under **100 milliseconds**.

### `src/modules/alerts/`
* **`scheduler.js`:** Dispatches subscription checks across active fishermen every 30 minutes.
* **`dedup.js`:** Prevents alerting a fisherman twice for the same weather system within a 3-hour window (`ALERT_DEDUP_WINDOW_MS = 10800000`).
* **`delivery/webPush.js`:** Delivers browser push notifications via WebPush VAPID keys.

---

## 5. Maintenance & CLI Scripts (`scripts/`)

* **`scripts/seed-pfz.js`:** CLI runner that invokes `syncPfzFromIncois()`. Allows developers or cron tabs to trigger live satellite ingestion on demand.
* **`scripts/check-syntax.js`:** Recursively parses all 84 JavaScript files in `src/` using Node's `vm.Script` compiler to guarantee zero syntax or import errors.
* **`scripts/check-contracts.py`:** Validates 15 synthetic and stored backend responses against official JSON Schemas.
