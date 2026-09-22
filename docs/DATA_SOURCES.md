# ORCA Maritime Safety Platform — Data Sources & Telemetry Integration Guide

## 1. Zero Fabrication Policy

ORCA adheres strictly to the rule: **Never fabricate sensor or forecast telemetry.**
If a remote service is unreachable, down for maintenance, or does not cover a specific coastal cell, the corresponding measurement is recorded with `status: "unavailable"` and an explicit error explanation. The system never injects default numbers (e.g. 28°C SST or 1.2m wave height) disguised as real observations.

---

## 2. Ingested Data Sources & Adapters

### 2.1 Open-Meteo Marine & Forecast API
- **Role**: Primary real-time and multi-day hourly metocean forecast provider.
- **Parameters Retrieved**:
  - `wind_speed_10m`, `wind_gusts_10m`, `wind_direction_10m`
  - `wave_height`, `wave_direction`, `wave_period`
  - `swell_wave_height`, `swell_wave_direction`, `swell_wave_period`
  - `sea_surface_temperature`
- **Nearest-Hour Matching**:
  Predictions are matched to the exact or nearest forecast hour of the query departure window rather than defaulting to index 0.
- **Coastal Land-Mask Resolution**:
  When a harbor or beach coordinate falls on an Open-Meteo land cell, the adapter searches the adjacent 0.1° marine cells, shifts to the nearest verified water point, and labels the measurement with `status: "derived"` and an explicit notice that a coastal adjustment occurred.

### 2.2 INCOIS (Indian National Centre for Ocean Information Services)
- **Role**: Sovereign oceanographic authority for Indian coastal waters.
- **Services Ingested**:
  - **OSF (Ocean State Forecast)**: Significant wave height, swell period, sea surface currents.
  - **Kallakkadal / Swell Surge Early Warning**: Coastal flooding and long-period southern ocean swell alerts.
  - **High Wave Alerts**: Color-coded coastal district directives (Yellow, Orange, Red).
  - **Potential Fishing Zones (PFZ)**: Oceanographic front detection via WFS / GeoServer.

### 2.3 IMD (India Meteorological Department)
- **Role**: Sovereign meteorological authority and National Meteorological and Hydrological Service.
- **Feeds Ingested**:
  - **Cyclone Bulletins**: Depressions, deep depressions, cyclonic storms, super cyclones in Bay of Bengal and Arabian Sea.
  - **Squall & Gale Wind Directives**: Wind speed threshold warnings (> 35 knots, > 45 knots, > 60 knots).
  - **Fishermen Warnings**: Non-technical advisories forbidding departure for specific coastal sectors.
  - **Deterministic Safety Floors**: IMD warnings enforce non-negotiable minimum risk scores (e.g., Warning Level 3 enforces minimum risk floor of 85/100, overriding LLM optimism).

### 2.4 NDMA SACHET (Common Alerting Protocol - CAP)
- **Role**: National Disaster Management Authority public alert feed.
- **Format**: OASIS Common Alerting Protocol (CAP v1.2) XML / JSON.
- **Integration**: Parsed for coastal thunderstorm, lightning, flash flood, and tsunami advisories.

### 2.5 GEBCO Bathymetry & OpenTopoData
- **Role**: High-resolution seafloor depth and coastal bathymetry screening.
- **Integration**:
  - GEBCO 2024 grid via OpenTopoData or self-hosted local NetCDF / GeoTIFF tile service.
  - Negative values indicate ocean depth (e.g., `-18.5 m`); values near zero or positive trigger shoreline snapping.

### 2.6 Satellite Chlorophyll-a & Ocean Color (ERDDAP)
- **Role**: Multi-year ocean productivity and environmental trend monitoring (§72).
- **Integration Prerequisite**:
  - Requires operator configuration of an active ERDDAP endpoint (e.g., NOAA CoastWatch or Copernicus Marine Service).
  - Configured via environment variable `ERDDAP_CHLOROPHYLL_DATASET_ID`.
  - **Honesty Rule**: When ERDDAP is not configured or cloud cover prevents optical chlorophyll measurement, the trend engine notes that Chlorophyll-a is unavailable and presents Sea Surface Temperature (SST) as an environmental proxy with explicit documentation.

---

## 3. Telemetry Verification Status

Every measurement returned by ORCA conforms to `contracts/Measurement.json` and carries one of the following canonical statuses:

| Status | Definition | Example Scenario |
|---|---|---|
| `available` | Direct, unmodified observation or forecast from institutional API | Open-Meteo wave height for open ocean cell |
| `derived` | Computed from surrounding spatial cells or sensor proxies | Open-Meteo coastal shift; SST proxy for ocean productivity |
| `unavailable` | Remote provider unreachable or data missing for coordinate | Satellite sensor clouded; remote API outage |
