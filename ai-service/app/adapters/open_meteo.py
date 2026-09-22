"""
app/adapters/open_meteo.py

Live Open-Meteo adapter for real metocean data.
Integrates numerical weather and oceanographic models:
  - Weather: Open-Meteo Global Weather Model (ECMWF/GFS/ICON blend)
  - Ocean: Open-Meteo Marine Forecast Model (Copernicus / GFS Wave blend)

CANONICAL UNITS ENFORCED:
  - wind_speed_ms: m/s (requested via wind_speed_unit=ms)
  - wind_gust_ms: m/s
  - wind_direction_deg: degrees
  - visibility_km: km (converted from meters / 1000.0)
  - precipitation_mm: mm
  - wave_height_m: meters
  - swell_height_m: meters
  - wave_period_s: seconds
  - current_speed_ms: m/s (converted from km/h / 3.6)
  - sst_c: degC

NEVER-FABRICATE POLICY:
  - Robust nearest-hour matching for UTC and offset timestamps (e.g. IST UTC+05:30).
  - Coastal ocean-cell search: if marine cells hit land mask at harbor/shoreline,
    searches immediate neighborhood (0.08 deg) for the nearest valid ocean cell
    and flags status="derived".
  - If external network or numerical models are unreachable and ADAPTER_MODE != "mock",
    returns honest status="missing" with value=None, confidence=0.0.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import httpx

from app.adapters.mock import _hours, _measurement
from app.adapters import mock as mock_adapter
from app.config.settings import settings
from app.observability.logger import log

OPEN_METEO_WEATHER_URL = settings.OPEN_METEO_WEATHER_URL
OPEN_METEO_MARINE_URL = settings.OPEN_METEO_MARINE_URL
TIMEOUT_SECONDS = 8.0


def _compute_model_age_hours() -> float:
    """Compute elapsed hours since latest numerical model run cycle (00, 06, 12, 18 UTC)."""
    now = datetime.now(timezone.utc)
    cycle_offset = (now.hour % 6) + (now.minute / 60.0)
    return round(max(0.1, cycle_offset), 2)


def _unavailable_measurement(parameter: str, valid_time: str) -> Dict[str, Any]:
    """Construct an honest missing measurement when real data cannot be retrieved."""
    return _measurement(
        parameter=parameter,
        value=None,
        source=None,
        valid_time=valid_time,
        status="missing",
        product_id=None,
        confidence=None,
    )


def _find_closest_time_index(time_list: List[str], target_iso: str) -> int:
    """Find index in Open-Meteo hourly 'time' array matching target time (nearest UTC hour)."""
    if not time_list:
        return 0
    try:
        clean_target = target_iso.replace("Z", "+00:00")
        if "+" in clean_target or ("-" in clean_target[10:]):
            target_dt = datetime.fromisoformat(clean_target).astimezone(timezone.utc)
        else:
            target_dt = datetime.fromisoformat(clean_target).replace(tzinfo=timezone.utc)

        def parse_slot(t_str: str) -> datetime:
            return datetime.fromisoformat(t_str).replace(tzinfo=timezone.utc)

        best_idx = min(
            range(len(time_list)),
            key=lambda i: abs((parse_slot(time_list[i]) - target_dt).total_seconds()),
        )
        return best_idx
    except Exception:
        return 0


def weather(lat: float, lon: float, time_window_utc: str) -> Dict[str, Any]:
    """Fetch live atmospheric weather from Open-Meteo Weather API."""
    vt = _hours(time_window_utc)[0]

    params = {
        "latitude": round(lat, 4),
        "longitude": round(lon, 4),
        "hourly": "wind_speed_10m,wind_direction_10m,wind_gusts_10m,visibility,precipitation",
        "wind_speed_unit": "ms",
        "timezone": "UTC",
    }

    try:
        with httpx.Client(timeout=TIMEOUT_SECONDS) as client:
            resp = client.get(OPEN_METEO_WEATHER_URL, params=params)

        if resp.status_code != 200:
            log.warning("[open_meteo:weather] HTTP %s for (%.4f, %.4f)", resp.status_code, lat, lon)
            if settings.ADAPTER_MODE == "mock":
                return mock_adapter.weather(lat, lon, time_window_utc)
            return {
                p: _unavailable_measurement(p, vt)
                for p in ["wind_speed_ms", "wind_gust_ms", "wind_direction_deg", "visibility_km", "precipitation_mm"]
            }

        data = resp.json().get("hourly", {})
        times = data.get("time", [])
        idx = _find_closest_time_index(times, vt)

        def _val(param_key: str) -> Optional[float]:
            vals = data.get(param_key, [])
            if idx < len(vals) and vals[idx] is not None:
                return float(vals[idx])
            return None

        age = _compute_model_age_hours()
        prod_id = "open-meteo:forecast:best_match"

        vis_m = _val("visibility")
        vis_km = round(vis_m / 1000.0, 2) if vis_m is not None else None
        wind_speed = round(_val("wind_speed_10m"), 2) if _val("wind_speed_10m") is not None else None
        wind_gust = round(_val("wind_gusts_10m"), 2) if _val("wind_gusts_10m") is not None else None
        wind_dir = round(_val("wind_direction_10m"), 1) if _val("wind_direction_10m") is not None else None
        precip_mm = round(_val("precipitation"), 2) if _val("precipitation") is not None else None

        result = {}
        for param, val in [
            ("wind_speed_ms", wind_speed),
            ("wind_gust_ms", wind_gust),
            ("wind_direction_deg", wind_dir),
            ("visibility_km", vis_km),
            ("precipitation_mm", precip_mm),
        ]:
            if val is not None:
                m = _measurement(
                    parameter=param, value=val, source="Open-Meteo",
                    product_id=prod_id, valid_time=vt, status="available"
                )
                m["freshness"] = {"state": "fresh", "age_hours": age, "max_age_hours": 6.0}
                result[param] = m
            else:
                result[param] = _unavailable_measurement(param, vt)

        return result

    except Exception as exc:  # noqa: BLE001
        log.warning("[open_meteo:weather] Exception: %s", exc)
        if settings.ADAPTER_MODE == "mock":
            return mock_adapter.weather(lat, lon, time_window_utc)
        return {
            p: _unavailable_measurement(p, vt)
            for p in ["wind_speed_ms", "wind_gust_ms", "wind_direction_deg", "visibility_km", "precipitation_mm"]
        }


def _query_marine_raw(client: httpx.Client, q_lat: float, q_lon: float) -> Optional[Dict[str, Any]]:
    """Helper to query marine endpoint."""
    params = {
        "latitude": round(q_lat, 4),
        "longitude": round(q_lon, 4),
        "hourly": "wave_height,wave_direction,wave_period,swell_wave_height,ocean_current_velocity,sea_surface_temperature",
        "timezone": "UTC",
    }
    try:
        resp = client.get(OPEN_METEO_MARINE_URL, params=params)
        if resp.status_code == 200:
            return resp.json().get("hourly", {})
    except Exception:
        pass
    return None


def ocean(lat: float, lon: float, time_window_utc: str) -> Dict[str, Any]:
    """Fetch live marine & oceanographic data from Open-Meteo Marine API with coastal ocean search."""
    vt = _hours(time_window_utc)[0]

    try:
        with httpx.Client(timeout=TIMEOUT_SECONDS) as client:
            data = _query_marine_raw(client, lat, lon)
            times = data.get("time", []) if data else []
            idx = _find_closest_time_index(times, vt) if times else 0

            wave_vals = data.get("wave_height", []) if data else []
            has_direct_marine = bool(data and idx < len(wave_vals) and wave_vals[idx] is not None)
            is_derived_ocean_cell = False

            # Coastal cell search: if point lands on coast/land mask, probe adjacent marine cells
            if not has_direct_marine:
                candidates = [
                    (lat, lon - 0.08),  # West (offshore for West Coast India)
                    (lat, lon + 0.08),  # East (offshore for East Coast India)
                    (lat - 0.08, lon),  # South
                    (lat + 0.08, lon),  # North
                ]
                for c_lat, c_lon in candidates:
                    alt_data = _query_marine_raw(client, c_lat, c_lon)
                    if alt_data:
                        alt_times = alt_data.get("time", [])
                        alt_idx = _find_closest_time_index(alt_times, vt)
                        alt_waves = alt_data.get("wave_height", [])
                        if alt_idx < len(alt_waves) and alt_waves[alt_idx] is not None:
                            data = alt_data
                            idx = alt_idx
                            is_derived_ocean_cell = True
                            log.info("[open_meteo:ocean] Coastal land mask bypassed: using nearest ocean cell (%.4f, %.4f)", c_lat, c_lon)
                            break

            if not data or not (idx < len(data.get("wave_height", [])) and data.get("wave_height", [])[idx] is not None):
                if settings.ADAPTER_MODE == "mock":
                    return mock_adapter.ocean(lat, lon, time_window_utc)
                return {
                    p: _unavailable_measurement(p, vt)
                    for p in ["wave_height_m", "swell_height_m", "wave_period_s", "current_speed_ms", "sst_c"]
                }

            def _val(param_key: str) -> Optional[float]:
                vals = data.get(param_key, [])
                if idx < len(vals) and vals[idx] is not None:
                    return float(vals[idx])
                return None

            wave_h = _val("wave_height")
            wave_period = _val("wave_period")
            swell_h = _val("swell_wave_height")
            current_kmh = _val("ocean_current_velocity")
            current_ms = round(current_kmh / 3.6, 2) if current_kmh is not None else None
            sst = round(_val("sea_surface_temperature"), 1) if _val("sea_surface_temperature") is not None else None

            status_flag = "derived" if is_derived_ocean_cell else "available"
            prod_id = "open-meteo:marine:best_match"
            age = _compute_model_age_hours()

            result = {}
            for param, val in [
                ("wave_height_m", round(wave_h, 2) if wave_h is not None else None),
                ("swell_height_m", round(swell_h, 2) if swell_h is not None else None),
                ("wave_period_s", round(wave_period, 2) if wave_period is not None else None),
                ("current_speed_ms", current_ms),
                ("sst_c", sst),
            ]:
                if val is not None:
                    m = _measurement(
                        parameter=param, value=val, source="Open-Meteo-Marine",
                        product_id=prod_id, valid_time=vt, status=status_flag
                    )
                    m["freshness"] = {"state": "fresh", "age_hours": age, "max_age_hours": 6.0}
                    result[param] = m
                else:
                    result[param] = _unavailable_measurement(param, vt)

            return result

    except Exception as exc:  # noqa: BLE001
        log.warning("[open_meteo:ocean] Exception: %s", exc)
        if settings.ADAPTER_MODE == "mock":
            return mock_adapter.ocean(lat, lon, time_window_utc)
        return {
            p: _unavailable_measurement(p, vt)
            for p in ["wave_height_m", "swell_height_m", "wave_period_s", "current_speed_ms", "sst_c"]
        }


def tide(lat: float, lon: float, time_window_utc: str) -> Dict[str, Any]:
    """Fetch live tidal elevation and tidal current from Open-Meteo Marine API."""
    vt = _hours(time_window_utc)[0]

    params = {
        "latitude": round(lat, 4),
        "longitude": round(lon, 4),
        "hourly": "sea_level_height_msl,ocean_current_velocity",
        "timezone": "UTC",
    }

    try:
        with httpx.Client(timeout=TIMEOUT_SECONDS) as client:
            resp = client.get(OPEN_METEO_MARINE_URL, params=params)

        if resp.status_code != 200:
            log.warning("[open_meteo:tide] HTTP %s for (%.4f, %.4f)", resp.status_code, lat, lon)
            if settings.ADAPTER_MODE == "mock":
                return mock_adapter.tide(lat, lon, time_window_utc)
            return {
                "tide_height_m": _unavailable_measurement("tide_height_m", vt),
                "tidal_current_ms": _unavailable_measurement("tidal_current_ms", vt),
            }

        data = resp.json().get("hourly", {})
        times = data.get("time", [])
        idx = _find_closest_time_index(times, vt)

        def _val(param_key: str) -> Optional[float]:
            vals = data.get(param_key, [])
            if idx < len(vals) and vals[idx] is not None:
                return float(vals[idx])
            return None

        tide_height = _val("sea_level_height_msl")
        current_kmh = _val("ocean_current_velocity")
        tidal_current_ms = round(current_kmh / 3.6, 2) if current_kmh is not None else None

        prod_id = "open-meteo:marine:best_match"
        age = _compute_model_age_hours()

        result = {}
        if tide_height is not None:
            m_tide = _measurement(
                parameter="tide_height_m", value=round(tide_height, 2),
                source="Open-Meteo-Marine", product_id=prod_id, valid_time=vt, status="available"
            )
            m_tide["freshness"] = {"state": "fresh", "age_hours": age, "max_age_hours": 6.0}
            result["tide_height_m"] = m_tide
        else:
            result["tide_height_m"] = _unavailable_measurement("tide_height_m", vt)

        if tidal_current_ms is not None:
            m_curr = _measurement(
                parameter="tidal_current_ms", value=tidal_current_ms,
                source="Open-Meteo-Marine", product_id=prod_id, valid_time=vt, status="available"
            )
            m_curr["freshness"] = {"state": "fresh", "age_hours": age, "max_age_hours": 6.0}
            result["tidal_current_ms"] = m_curr
        else:
            result["tidal_current_ms"] = _unavailable_measurement("tidal_current_ms", vt)

        return result

    except Exception as exc:  # noqa: BLE001
        log.warning("[open_meteo:tide] Exception: %s", exc)
        if settings.ADAPTER_MODE == "mock":
            return mock_adapter.tide(lat, lon, time_window_utc)
        return {
            "tide_height_m": _unavailable_measurement("tide_height_m", vt),
            "tidal_current_ms": _unavailable_measurement("tidal_current_ms", vt),
        }


FETCHERS = {
    "weather": weather,
    "ocean": ocean,
    "tide": tide,
}
