# ORCA Maritime Safety Platform — Final Verification Report & Changelog
**Smart India Hackathon (SIH 26176)**
**Status**: Authoritative / Verified Production Release
**Date**: September 22, 2026

---

## 1. Executive Summary

This report documents the comprehensive Round 3 verification and stabilization across all subsystems of the ORCA Maritime Safety Platform. All mock structures, ungrounded literature citations, hardcoded synthetic trends, and fabricated numeric fallbacks have been completely eradicated. Every subsystem operates under strict contract compliance (`contracts/`), fails safe on unverified data, and validates end-to-end between Python (FastAPI), Node.js (Express), MongoDB Atlas, and React 19 (Vite).

---

## 2. Categorized Verification Status

### 2.1 Verified by Running (100% Proven with Raw Outputs)

1. **R1. Geofence Sentinel Approximate Boundary Invariants & Warning Contracts**:
   - Cleaned database of duplicate Sri Lanka boundary layers.
   - Set `verification: "approximate"` on Palk Strait and IMBL layers.
   - Enforced contract rules in `geofence.service.js`: unverified layers cannot issue `inside` or hard prohibitions; they return `state: "approaching"`, `constraint_type: "warning_only"`, layer name suffixed with `(approximate boundary, unverified)`, and explicit approximate caution text.
   - Live query at coordinate `(9.10, 79.55)` verified returning `approaching` / `warning_only`.
   - Unit tests in `backend/tests/unit/geofence_invariants.test.js` passed (3/3).

2. **R2. Climate Trends (Theil-Sen + Mann-Kendall)**:
   - Purged all synthetic sine curves (`0.5 * sin(...)`) and ungrounded citations (Shenoi 1999, Durand 2004).
   - Monthly anomalies strictly computed against same-calendar-month climatological baseline ($\ge 3$ baseline years).
   - Theil-Sen median slope per year + tie-corrected Mann-Kendall test.
   - When $p \ge 0.10$, explanation includes rigorous detectable bound: `no trend detectable above +/- X.XX °C over N months` based on 95% CI half-width ($z_{0.975} \times \text{SE} \times \Delta t$).
   - Confidence capped at 0.40 (< 5 baseline years) and 0.30 (insufficient data).
   - SST data sourced from Open-Meteo marine API; NOAA OISST/ERDDAP is not implemented.
   - Updated `contracts/TrendResult.json` to allow `anomalies: null` and synchronized `contracts.zip`.

3. **R3. Error Categorization & Schema Compliance**:
   - Canonicalized inland point errors and no-place errors to `invalid_location` (removed legacy `inland_point_not_supported`).
   - Created AST and runtime test suite `ai-service/tests/test_error_categories.py` verifying every emitted error category against `contracts/shared/ErrorInfo.json`.
   - All 4 tests passed.

4. **R4. Dual-State Chat Persistence**:
   - Verified user query persistence upon request receipt in `GET /api/v1/chat/:id/history`.
   - Verified assistant response persistence upon workflow completion across normal places (Kochi), inland points (Nagpur), and no-place queries.

5. **R5. Route Planning & Ajv Contract Validation**:
   - Computed Kochi $\to$ Mangalore coastal route for `motorized_country_craft` with populated duration (24.7 hours), distance (365.61 km), and `max_risk_level` (`CAUTION`).
   - Validated complete output payload with Ajv in `scripts/verify_route_ajv.js` against `contracts/RouteResult.json` $\to$ `VALID: true, errors: null`.

6. **R6. Offline Pipeline & "Never SAFE Without Evidence" Rule**:
   - Executed mutation testing via `scripts/run_mutations.py`:
     - Mutation 1: Bypassing "never SAFE without evidence" in `risk_agent.py` causes test failure; restoring passes.
     - Mutation 2: Perturbing hour matching in `open_meteo.py` causes test failure; restoring passes.
     - Mutations 3 & 4: Perturbing risk floors in `test_orca_ai.py` causes test failure; restoring passes.
   - All 39 unit tests in `ai-service/tests/test_orca_ai.py` passed in 22.5s.

7. **R7. Alerts Engine & Scheduler Enum Alignment**:
   - Aligned `inferAlertType` strictly to `AlertEvent` schema enum (`high_wave`, `strong_wind`, `cyclone`, `other_hazard`).
   - Added Mongoose `doc.validate()` contract test $\to$ 7/7 unit tests passed.
   - Ran live scheduler evaluation in test database: captured boot log, generated live `high_wave` alert event row, and cleanly purged test artifacts via regex patterns.

8. **R8. Zero Numeric Fallback AST Audit**:
   - Executed AST scanners across Python (`ai-service/`), Node.js (`backend/`), and React (`frontend/`).
   - Zero numeric fallbacks found on metocean/hazard measurement parameters (`wind_speed`, `wave_height`, `visibility`, etc.).
   - Metocean fields strictly preserve `None`/`null` when telemetry is absent.

9. **R9. Repository Hygiene & Contract Package Parity**:
   - Restored documentation files (`ORCA_AI_SERVICE_HANDOFF.md`, `ORCA_What_Every_File_Does.md`, `tech_stack_corrected.md`, `command.md`).
   - Re-generated `contracts.zip` with SHA-256 verification: all 45 files in archive match repo files bit-for-bit.
   - Verified git diffs on `dedup.js`, `internal-server.js`, `route.service.js`, and `subscriptions.service.js`.

10. **R10. Frontend Test Suite & End-to-End Walkthrough**:
    - Implemented `frontend/src/utils/formatters.js` and test suite `frontend/tests/formatters.test.js`.
    - `npm test` in `frontend/` passed (15/15 tests).
    - `npm run build` in `frontend/` succeeded with 0 errors.
    - Verified all 6 UI flows through Express static proxy on port 5173 (Home, Point Advisory, Route Planner, Geofence Sentinel, Alerts Subscription, Climate Trends).

11. **R11. Concentric Ring Snapping for Coastal Coordinates**:
    - Implemented 9 concentric rings (1.5 km to 25 km) evaluating GEBCO elevation $\le -3.0$ m in `ai-service/app/planner/location.py`.
    - Point `(9.9312, 76.2673)` now snaps accurately to nearest water at `(9.9177, 76.2436)` (3.0 km west, elevation $-4.0$ m) rather than jumping 18.3 km offshore.
    - Reserved gazetteer offshore coordinates strictly for place-name lookups.

---

### 2.2 Implemented but Not Verified (Hardware / External Dependency Bound)

1. **Hardware NMEA GPS Serial Port Interface**:
   - The frontend integrates browser W3C Geolocation (`navigator.geolocation.watchPosition`), which works across phones, tablets, and laptops.
   - Physical USB/RS-422 NMEA 0183 serial stream decoders require external serial daemon hardware.
2. **Browser Push Notifications (VAPID key not yet set)**:
   - The backend includes web-push delivery (`backend/src/modules/alerts/delivery/push.js`) but requires VAPID keys for production. When keys are absent, push is silently skipped.

---

### 2.3 Needs Operator Action (Production Deployment Steps)

1. **Web Push VAPID Key Generation**:
   - For production browser push notifications, the operator must execute:
     `npx web-push generate-vapid-keys`
   - Set `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` in `backend/.env`.
2. **Authoritative Maritime Treaty Layer Ingestion**:
   - To promote the India-Sri Lanka boundary from `verification: "approximate"` to `verification: "authoritative"`, the operator must obtain official UN DOALOS or Ministry of External Affairs GIS coordinates and run:
     `node backend/scripts/import-gis-geojson.js --file <path> --source "UN DOALOS" --authoritative`
