"""
app/adapters/open_meteo.py

Live Open-Meteo adapter for real metocean data.
Replaces deterministic mock weather and ocean feeds with real-time numerical models:
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

FALLBACK SAFETY:
If network fails or Open-Meteo is unreachable, falls back to the deterministic
mock adapter to ensure the analysis pipeline never aborts mid-flight.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx

from app.adapters.mock import _hours, _measurement
from app.adapters import mock as mock_adapter
from app.observability.logger import log

OPEN_METEO_WEATHER_URL = "https://api.open-meteo.com/v1/forecast"
OPEN_METEO_MARINE_URL = "https://marine-api.open-meteo.com/v1/marine"
TIMEOUT_SECONDS = 8.0


def _find_closest_time_index(time_list: List[str], target_iso: str) -> int:
    """Find index in Open-Meteo hourly 'time' array matching target time."""
    if not time_list:
        return 0
    try:
        # Target format: 2026-09-17T06:00:00Z -> target prefix 2026-09-17T06:00
        target_prefix = target_iso.replace("Z", "")[:16]
        for idx, t in enumerate(time_list):
            if t.startswith(target_prefix):
                return idx
    except Exception:  # noqa: BLE001
        pass
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
            log.warning("[open_meteo:weather] HTTP %s for (%.4f, %.4f) - falling back to mock", resp.status_code, lat, lon)
            return mock_adapter.weather(lat, lon, time_window_utc)

        data = resp.json().get("hourly", {})
        times = data.get("time", [])
        idx = _find_closest_time_index(times, vt)

        def _val(param_key: str, default: float = 0.0) -> float:
            vals = data.get(param_key, [])
            if idx < len(vals) and vals[idx] is not None:
                return float(vals[idx])
            return default

        # Unit conversions: visibility is meters in Open-Meteo -> convert to km
        vis_m = _val("visibility", 10000.0)
        vis_km = round(vis_m / 1000.0, 2)
        wind_speed = round(_val("wind_speed_10m", 5.0), 2)
        wind_gust = round(_val("wind_gusts_10m", wind_speed * 1.3), 2)
        wind_dir = round(_val("wind_direction_10m", 180.0), 1)
        precip_mm = round(_val("precipitation", 0.0), 2)

        return {
            "wind_speed_ms": _measurement(
                parameter="wind_speed_ms", value=wind_speed,
                source="Open-Meteo", product_id="ECMWF-IFS-0.25", valid_time=vt),
            "wind_gust_ms": _measurement(
                parameter="wind_gust_ms", value=wind_gust,
                source="Open-Meteo", product_id="ECMWF-IFS-0.25", valid_time=vt),
            "wind_direction_deg": _measurement(
                parameter="wind_direction_deg", value=wind_dir,
                source="Open-Meteo", product_id="ECMWF-IFS-0.25", valid_time=vt),
            "visibility_km": _measurement(
                parameter="visibility_km", value=vis_km,
                source="Open-Meteo", product_id="ECMWF-IFS-0.25", valid_time=vt),
            "precipitation_mm": _measurement(
                parameter="precipitation_mm", value=precip_mm,
                source="Open-Meteo", product_id="ECMWF-IFS-0.25", valid_time=vt),
        }

    except Exception as exc:  # noqa: BLE001
        log.warning("[open_meteo:weather] Exception: %s - falling back to mock", exc)
        return mock_adapter.weather(lat, lon, time_window_utc)


def ocean(lat: float, lon: float, time_window_utc: str) -> Dict[str, Any]:
    """Fetch live marine & oceanographic data from Open-Meteo Marine API."""
    vt = _hours(time_window_utc)[0]

    params = {
        "latitude": round(lat, 4),
        "longitude": round(lon, 4),
        "hourly": "wave_height,wave_direction,wave_period,swell_wave_height,ocean_current_velocity,sea_surface_temperature",
        "timezone": "UTC",
    }

    try:
        with httpx.Client(timeout=TIMEOUT_SECONDS) as client:
            resp = client.get(OPEN_METEO_MARINE_URL, params=params)

        if resp.status_code != 200:
            log.warning("[open_meteo:ocean] HTTP %s for (%.4f, %.4f) - falling back to mock", resp.status_code, lat, lon)
            return mock_adapter.ocean(lat, lon, time_window_utc)

        data = resp.json().get("hourly", {})
        times = data.get("time", [])
        idx = _find_closest_time_index(times, vt)

        def _val(param_key: str, default: Optional[float] = None) -> Optional[float]:
            vals = data.get(param_key, [])
            if idx < len(vals) and vals[idx] is not None:
                return float(vals[idx])
            return default

        wave_h = _val("wave_height")
        # Near coast or shallow reef, marine models may return None; fallback safely if None
        if wave_h is None:
            return mock_adapter.ocean(lat, lon, time_window_utc)

        wave_period = round(_val("wave_period", 8.0) or 8.0, 2)
        swell_h = round(_val("swell_wave_height", wave_h * 0.8) or (wave_h * 0.8), 2)
        
        # ocean_current_velocity is km/h in Open-Meteo marine API -> convert to m/s (/ 3.6)
        current_kmh = _val("ocean_current_velocity", 1.8) or 1.8
        current_ms = round(current_kmh / 3.6, 2)

        sst = round(_val("sea_surface_temperature", 28.5) or 28.5, 1)

        return {
            "wave_height_m": _measurement(
                parameter="wave_height_m", value=round(wave_h, 2),
                source="Open-Meteo-Marine", product_id="Copernicus-Wave", valid_time=vt),
            "swell_height_m": _measurement(
                parameter="swell_height_m", value=swell_h,
                source="Open-Meteo-Marine", product_id="Copernicus-Wave", valid_time=vt),
            "wave_period_s": _measurement(
                parameter="wave_period_s", value=wave_period,
                source="Open-Meteo-Marine", product_id="Copernicus-Wave", valid_time=vt),
            "current_speed_ms": _measurement(
                parameter="current_speed_ms", value=current_ms,
                source="Open-Meteo-Marine", product_id="Mercator-Ocean", valid_time=vt),
            "sst_c": _measurement(
                parameter="sst_c", value=sst,
                source="Open-Meteo-Marine", product_id="Mercator-Ocean", valid_time=vt),
        }

    except Exception as exc:  # noqa: BLE001
        log.warning("[open_meteo:ocean] Exception: %s - falling back to mock", exc)
        return mock_adapter.ocean(lat, lon, time_window_utc)


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
            log.warning("[open_meteo:tide] HTTP %s for (%.4f, %.4f) - falling back to mock", resp.status_code, lat, lon)
            return mock_adapter.tide(lat, lon, time_window_utc)

        data = resp.json().get("hourly", {})
        times = data.get("time", [])
        idx = _find_closest_time_index(times, vt)

        def _val(param_key: str, default: Optional[float] = None) -> Optional[float]:
            vals = data.get(param_key, [])
            if idx < len(vals) and vals[idx] is not None:
                return float(vals[idx])
            return default

        tide_height = _val("sea_level_height_msl")
        # Near coast or shallow reef where models may return None, fallback safely
        if tide_height is None:
            return mock_adapter.tide(lat, lon, time_window_utc)

        # ocean_current_velocity is km/h in Open-Meteo -> convert to m/s (/ 3.6)
        current_kmh = _val("ocean_current_velocity", 1.5) or 1.5
        tidal_current_ms = round(current_kmh / 3.6, 2)

        return {
            "tide_height_m": _measurement(
                parameter="tide_height_m",
                value=round(tide_height, 2),
                source="Open-Meteo-Marine",
                product_id="Tide-MSL",
                valid_time=vt,
                status="available",
            ),
            "tidal_current_ms": _measurement(
                parameter="tidal_current_ms",
                value=tidal_current_ms,
                source="Open-Meteo-Marine",
                product_id="Tide-Stream",
                valid_time=vt,
                status="available",
            ),
        }

    except Exception as exc:  # noqa: BLE001
        log.warning("[open_meteo:tide] Exception: %s - falling back to mock", exc)
        return mock_adapter.tide(lat, lon, time_window_utc)


FETCHERS = {
    "weather": weather,
    "ocean": ocean,
    "tide": tide,
}

