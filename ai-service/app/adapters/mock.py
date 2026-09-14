"""
app/adapters/mock.py

Phase A3 - deterministic mock data source.

WHY MOCKS COME BEFORE REAL ADAPTERS (roadmap Phase A3 -> A4): they let the
whole pipeline and the Backend integration be proven correct before any real
API credentials, rate limits, or upstream outages enter the picture. When
Phase A4 swaps in real adapters, any bug that appears is provably in the
adapter, not the pipeline.

DETERMINISTIC, NOT RANDOM: values are derived from a hash of (lat, lon,
parameter, hour). The same point always yields the same reading, so a demo is
repeatable and a regression is visible. Random values would make it impossible
to tell a real change from noise.

EVERY VALUE IS ALREADY IN THE CANONICAL UNIT (Section 24.2). Conversion is the
adapter's job, never the pipeline's - a wrong unit downstream is treated as
missing data, not silently converted.

HONEST GAPS ARE BUILT IN: some parameters deliberately return status="missing"
or "not_mapped" so the never-fabricate path is exercised end-to-end rather than
only in theory.
"""

import hashlib
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from app.config.registry import canonical_unit

# Parameters that deliberately come back unavailable, to exercise the
# never-fabricate path. tide is "missing" (source asked, nothing returned);
# tidal_current_ms is "not_mapped" (no adapter mapping exists yet).
_ALWAYS_MISSING = {"tide_height_m"}
_ALWAYS_NOT_MAPPED = {"tidal_current_ms"}


def _seed(lat: float, lon: float, parameter: str, hour: int = 0) -> float:
    """Stable pseudo-random in [0, 1) from the inputs. Never uses random()."""
    key = f"{lat:.3f}:{lon:.3f}:{parameter}:{hour}"
    digest = hashlib.sha256(key.encode()).hexdigest()
    return int(digest[:8], 16) / 0xFFFFFFFF


def _scaled(lat: float, lon: float, parameter: str, low: float, high: float, hour: int = 0) -> float:
    return round(low + _seed(lat, lon, parameter, hour) * (high - low), 2)


def _measurement(
    *,
    parameter: str,
    value: Optional[float],
    source: Optional[str],
    valid_time: str,
    status: str = "available",
    product_id: Optional[str] = None,
    confidence: Optional[float] = 0.8,
) -> Dict[str, Any]:
    """Build a contract-shaped Measurement (contracts/Measurement.json).

    Required by contract: value, status, freshness, source.

    NEVER-FABRICATE RULES enforced here:
      - value is None whenever status is missing/not_mapped
      - source and retrieved_at are None for those statuses too, because data
        that was never retrieved genuinely has no source and no retrieval time
    """
    unavailable = status in ("missing", "not_mapped")
    now_iso = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    return {
        "parameter": parameter,
        "value": None if unavailable else value,
        "unit": canonical_unit(parameter.replace("_ms", "_speed").replace("_m", "")) or _unit_for(parameter),
        "source": None if unavailable else source,
        "product_id": None if unavailable else product_id,
        "retrieved_at": None if unavailable else now_iso,
        "valid_time": valid_time,
        "observation_type": "forecast",
        "status": status,
        "freshness": {"state": "unknown"} if unavailable else {
            "state": "fresh", "age_hours": 0.5, "max_age_hours": 6,
        },
        "confidence": None if unavailable else confidence,
        # contracts/Measurement.json: official_source is an OBJECT (or null),
        # NOT a boolean. It carries the provenance a safety-critical warning
        # needs - issuing authority, bulletin id, warning level (Section 43.1).
        # Ordinary measurements have no official source, so null.
        "official_source": None,
    }


def _unit_for(parameter: str) -> Optional[str]:
    """Canonical unit by convention from the parameter suffix.

    Parameter names carry their unit (wind_speed_ms -> m/s), which is what
    makes a mismatch detectable at all.
    """
    suffixes = {
        "_ms": "m/s", "_m": "m", "_s": "s", "_deg": "deg", "_c": "degC",
        "_km": "km", "_pct": "percent", "_mm": "mm",
        "_mg_m3": "mg/m3", "_mmol_m3": "mmol/m3", "_psu": "PSU",
    }
    for suffix, unit in sorted(suffixes.items(), key=lambda kv: -len(kv[0])):
        if parameter.endswith(suffix):
            return unit
    return None


def _hours(time_window_utc: str, limit: int = 6) -> List[str]:
    """Expand a "start/end" interval into hourly ISO timestamps."""
    try:
        start_s, end_s = time_window_utc.split("/")
        start = datetime.fromisoformat(start_s.replace("Z", "+00:00"))
        end = datetime.fromisoformat(end_s.replace("Z", "+00:00"))
    except Exception:  # noqa: BLE001
        start = datetime.now(timezone.utc)
        end = start + timedelta(hours=6)

    out, cursor = [], start
    while cursor < end and len(out) < limit:
        out.append(cursor.isoformat().replace("+00:00", "Z"))
        cursor += timedelta(hours=1)
    return out or [start.isoformat().replace("+00:00", "Z")]


# --- Per-agent mock fetchers ----------------------------------------------
# Each returns { parameter -> Measurement } for one point.

def weather(lat: float, lon: float, time_window_utc: str) -> Dict[str, Any]:
    vt = _hours(time_window_utc)[0]
    return {
        "wind_speed_ms": _measurement(
            parameter="wind_speed_ms", value=_scaled(lat, lon, "wind", 2.0, 14.0),
            source="IMD", product_id="IMD-FC-v1", valid_time=vt),
        "wind_gust_ms": _measurement(
            parameter="wind_gust_ms", value=_scaled(lat, lon, "gust", 3.0, 20.0),
            source="IMD", product_id="IMD-FC-v1", valid_time=vt),
        "wind_direction_deg": _measurement(
            parameter="wind_direction_deg", value=_scaled(lat, lon, "winddir", 0, 359),
            source="IMD", product_id="IMD-FC-v1", valid_time=vt),
        "visibility_km": _measurement(
            parameter="visibility_km", value=_scaled(lat, lon, "vis", 2.0, 12.0),
            source="IMD", product_id="IMD-FC-v1", valid_time=vt),
        "precipitation_mm": _measurement(
            parameter="precipitation_mm", value=_scaled(lat, lon, "precip", 0.0, 8.0),
            source="IMD", product_id="IMD-FC-v1", valid_time=vt),
    }


def ocean(lat: float, lon: float, time_window_utc: str) -> Dict[str, Any]:
    vt = _hours(time_window_utc)[0]
    return {
        "wave_height_m": _measurement(
            parameter="wave_height_m", value=_scaled(lat, lon, "wave", 0.3, 3.5),
            source="INCOIS", product_id="OSF-v2", valid_time=vt),
        "swell_height_m": _measurement(
            parameter="swell_height_m", value=_scaled(lat, lon, "swell", 0.2, 2.5),
            source="INCOIS", product_id="OSF-v2", valid_time=vt),
        "wave_period_s": _measurement(
            parameter="wave_period_s", value=_scaled(lat, lon, "period", 4.0, 14.0),
            source="INCOIS", product_id="OSF-v2", valid_time=vt),
        "current_speed_ms": _measurement(
            parameter="current_speed_ms", value=_scaled(lat, lon, "current", 0.05, 1.2),
            source="INCOIS", product_id="OSF-v2", valid_time=vt),
        "sst_c": _measurement(
            parameter="sst_c", value=_scaled(lat, lon, "sst", 26.0, 31.0),
            source="INCOIS", product_id="OSF-v2", valid_time=vt),
    }


def tide(lat: float, lon: float, time_window_utc: str) -> Dict[str, Any]:
    """Deliberately returns unavailable data to exercise never-fabricate."""
    vt = _hours(time_window_utc)[0]
    return {
        "tide_height_m": _measurement(
            parameter="tide_height_m", value=None, source=None,
            valid_time=vt, status="missing"),
        "tidal_current_ms": _measurement(
            parameter="tidal_current_ms", value=None, source=None,
            valid_time=vt, status="not_mapped"),
    }


def cyclone(lat: float, lon: float, time_window_utc: str) -> Dict[str, Any]:
    """Official warnings. `official_source: True` matters - Section 49 lets an
    official warning force a risk floor that the LLM can never undercut."""
    vt = _hours(time_window_utc)[0]
    # Deterministic: only a small slice of the coordinate space has a warning,
    # so the demo can show both the warning and no-warning paths.
    has_warning = _seed(lat, lon, "cyclone") > 0.88

    m = _measurement(
        parameter="official_warning_active",
        value=has_warning,
        source="IMD", product_id="IMD-BULLETIN", valid_time=vt, confidence=0.95,
    )

    # Only a genuinely official warning carries this block. Its presence is
    # what allows the Risk Agent to force a floor (Section 49) - our own
    # derived data can never masquerade as an official warning.
    if has_warning:
        m["official_source"] = {
            "issuing_authority": "IMD",
            "bulletin_id": f"IMD-{abs(hash((lat, lon))) % 100000:05d}",
            "warning_level": "DANGEROUS",
        }

    return {"official_warning_active": m}


def ecosystem(lat: float, lon: float, time_window_utc: str) -> Dict[str, Any]:
    vt = _hours(time_window_utc)[0]
    return {
        "chlorophyll_mg_m3": _measurement(
            parameter="chlorophyll_mg_m3", value=_scaled(lat, lon, "chl", 0.1, 4.0),
            source="MOSDAC", product_id="OCM-3", valid_time=vt),
        "dissolved_oxygen_mmol_m3": _measurement(
            parameter="dissolved_oxygen_mmol_m3", value=_scaled(lat, lon, "do", 150.0, 250.0),
            source="MOSDAC", product_id="OCM-3", valid_time=vt),
    }


def pfz(lat: float, lon: float, time_window_utc: str) -> Dict[str, Any]:
    """Potential Fishing Zone evidence.

    NOTE: the real INCOIS prototype currently hardcodes
    potential_fish_aggregation=true, which violates never-fabricate. The mock
    does NOT copy that bug - it derives the value and reports honestly, so the
    correct behaviour is what the pipeline is built against.
    """
    vt = _hours(time_window_utc)[0]
    suitability = _scaled(lat, lon, "pfz", 0.0, 1.0)
    return {
        "pfz_suitability_score": _measurement(
            parameter="pfz_suitability_score", value=suitability,
            source="INCOIS", product_id="PFZ-ADV", valid_time=vt),
        "sst_gradient": _measurement(
            parameter="sst_gradient", value=_scaled(lat, lon, "sstgrad", 0.0, 0.8),
            source="INCOIS", product_id="PFZ-ADV", valid_time=vt),
    }


def gis(lat: float, lon: float, time_window_utc: str) -> Dict[str, Any]:
    """Boundaries, restricted zones, depth.

    `inside_prohibited_zone` is the field the Decision Agent uses to exclude a
    point outright (Section 65.1) - a prohibited point can never be
    recommended, regardless of how low its risk score is.
    """
    vt = _hours(time_window_utc)[0]
    prohibited = _seed(lat, lon, "prohibited") > 0.90
    return {
        "water_depth_m": _measurement(
            parameter="water_depth_m", value=_scaled(lat, lon, "depth", 5.0, 200.0),
            source="GEBCO", product_id="GEBCO-2024", valid_time=vt),
        "distance_to_boundary_km": _measurement(
            parameter="distance_to_boundary_km", value=_scaled(lat, lon, "boundary", 1.0, 90.0),
            source="Marine Regions", product_id="EEZ-v11", valid_time=vt),
        "inside_prohibited_zone": _measurement(
            parameter="inside_prohibited_zone", value=prohibited,
            source="WDPA", product_id="WDPA-2024", valid_time=vt),
    }


FETCHERS = {
    "weather": weather,
    "ocean": ocean,
    "tide": tide,
    "cyclone": cyclone,
    "ecosystem": ecosystem,
    "pfz": pfz,
    "gis": gis,
}


def hourly_series(lat: float, lon: float, parameter: str, time_window_utc: str,
                  low: float, high: float) -> List[Dict[str, Any]]:
    """Hourly values for one parameter, used by the risk baseline (Section 48.4)."""
    return [
        {"time": ts, "value": _scaled(lat, lon, parameter, low, high, hour=i)}
        for i, ts in enumerate(_hours(time_window_utc))
    ]
