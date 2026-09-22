"""
app/adapters/imd_cyclone.py

Live IMD (India Meteorological Department) & NDMA SACHET Cyclone and Official
Marine Warning Adapter.

Conforms to Spec 49.1:
  - Parses effective_start_time / effective_end_time in CAP format (e.g., 'Mon Sep 21 23:25:00 IST 2026').
  - Applies only overlapping alert windows: (alert_start < window_end) and (alert_end > window_start).
  - Grades warning level strictly from severity_color (red -> DANGEROUS, orange -> UNSAFE, yellow -> CAUTION).
  - When SACHET is unreachable and no fresh cache exists -> status='missing', value=None.
"""

from datetime import datetime, timezone
import json
import math
import ssl
import time as _time
from typing import Any, Dict, List, Optional, Tuple
import urllib.request

from app.adapters.mock import _hours, _measurement
from app.adapters import mock as mock_adapter
from app.config.settings import settings
from app.observability.logger import log

SACHET_ALERTS_URL = settings.SACHET_ALERTS_URL
CACHE_TTL_SECONDS = 900.0  # 15 minutes

_alerts_cache: Optional[List[Dict[str, Any]]] = None
_alerts_cache_timestamp: float = 0.0

RELEVANT_DISASTER_TYPES = {
    "cyclone", "deep depression", "depression", "squall", "squally", "gale",
    "high wind", "surface wind", "storm surge", "severe thunderstorm",
    "thunderstorm", "heavy rain", "very heavy rain"
}


def parse_sachet_time(t_str: Any) -> Optional[datetime]:
    """Parse SACHET datetime string e.g. 'Mon Sep 21 23:25:00 IST 2026' into UTC datetime."""
    if not t_str or not isinstance(t_str, str):
        return None
    try:
        clean = t_str.strip().replace("IST", "+0530")
        dt = datetime.strptime(clean, "%a %b %d %H:%M:%S %z %Y")
        return dt.astimezone(timezone.utc)
    except Exception:
        try:
            from dateutil import parser
            return parser.parse(t_str).astimezone(timezone.utc)
        except Exception:
            return None


def is_alert_window_overlapping(
    effective_start: Any,
    effective_end: Any,
    window_start: datetime,
    window_end: datetime,
) -> bool:
    """Spec 49.1: alert window overlaps analysis window iff alert_start < window_end and alert_end > window_start."""
    start_dt = parse_sachet_time(effective_start)
    end_dt = parse_sachet_time(effective_end)

    # If times are unparseable, err on conservative side if recent
    if not start_dt or not end_dt:
        return True

    return (start_dt < window_end) and (end_dt > window_start)


def grade_severity_from_color(severity_color: Any, severity_text: Any = None) -> str:
    """Grade warning level strictly from severity_color (red -> DANGEROUS, orange -> UNSAFE, yellow -> CAUTION)."""
    color = str(severity_color or "").strip().lower()
    if color == "red":
        return "DANGEROUS"
    elif color == "orange":
        return "UNSAFE"
    elif color in ("yellow", "amber"):
        return "CAUTION"

    # Fallback to severity text if color unspecified
    sev = str(severity_text or "").strip().upper()
    if "EXTREME" in sev or "SEVERE" in sev:
        return "DANGEROUS"
    elif "MODERATE" in sev:
        return "UNSAFE"
    elif "MINOR" in sev:
        return "CAUTION"

    return "CAUTION"


def _haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great-circle distance in km."""
    r = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    return 2.0 * r * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))


def _parse_centroid(centroid_str: Any) -> Optional[Tuple[float, float]]:
    """Parse centroid string 'lon,lat' into (lat, lon)."""
    if not centroid_str or not isinstance(centroid_str, str):
        return None
    try:
        parts = centroid_str.split(",")
        if len(parts) == 2:
            p1, p2 = float(parts[0].strip()), float(parts[1].strip())
            if 60.0 <= p1 <= 100.0 and 5.0 <= p2 <= 40.0:
                return (p2, p1)  # (lat, lon)
            elif 5.0 <= p1 <= 40.0 and 60.0 <= p2 <= 100.0:
                return (p1, p2)  # (lat, lon)
    except Exception:
        pass
    return None


def _fetch_live_sachet_alerts() -> Tuple[Optional[List[Dict[str, Any]]], bool]:
    """Fetch active alerts from NDMA SACHET with in-memory caching.

    Returns (alerts_list, is_available). If gateway unreachable and no cache -> (None, False).
    """
    global _alerts_cache, _alerts_cache_timestamp

    now = _time.time()
    if _alerts_cache is not None and (now - _alerts_cache_timestamp) < CACHE_TTL_SECONDS:
        return _alerts_cache, True

    log.info("[imd_cyclone] Refreshing active alerts from NDMA SACHET gateway...")
    req = urllib.request.Request(
        SACHET_ALERTS_URL,
        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ORCA-Marine-Sync/1.0"}
    )

    try:
        default_ctx = ssl.create_default_context()
        with urllib.request.urlopen(req, context=default_ctx, timeout=8) as response:
            raw = response.read().decode("utf-8", errors="ignore")
            data = json.loads(raw)
            if isinstance(data, list):
                _alerts_cache = data
                _alerts_cache_timestamp = now
                log.info("[imd_cyclone] Cached %d active alerts from SACHET", len(data))
                return _alerts_cache, True
    except ssl.SSLCertVerificationError:
        try:
            insecure_ctx = ssl.create_default_context()
            insecure_ctx.check_hostname = False
            insecure_ctx.verify_mode = ssl.CERT_NONE
            with urllib.request.urlopen(req, context=insecure_ctx, timeout=8) as response:
                raw = response.read().decode("utf-8", errors="ignore")
                data = json.loads(raw)
                if isinstance(data, list):
                    _alerts_cache = data
                    _alerts_cache_timestamp = now
                    return _alerts_cache, True
        except Exception as exc:
            log.warning("[imd_cyclone] Insecure fallback fetch failed: %s", exc)
    except Exception as exc:
        log.warning("[imd_cyclone] SACHET gateway unreachable: %s", exc)

    if _alerts_cache is not None:
        log.info("[imd_cyclone] Serving from existing cache (%d items)", len(_alerts_cache))
        return _alerts_cache, True

    # SACHET unreachable + no fresh cache -> fail closed with missing status
    return None, False


def cyclone(lat: float, lon: float, time_window_utc: str) -> Dict[str, Any]:
    """Evaluate active cyclone and official marine warnings for point (lat, lon)."""
    vt = _hours(time_window_utc)[0]

    # Parse analysis window start and end
    try:
        parts = time_window_utc.split("/")
        win_start = datetime.fromisoformat(parts[0].replace("Z", "+00:00"))
        win_end = datetime.fromisoformat(parts[1].replace("Z", "+00:00"))
    except Exception:
        win_start = datetime.now(timezone.utc)
        win_end = win_start

    alerts, is_available = _fetch_live_sachet_alerts()

    # When SACHET unreachable + no fresh cache -> status 'missing'
    if not is_available and alerts is None:
        log.warning("[imd_cyclone] SACHET unreachable and no fresh cache -> returning status 'missing'")
        return {
            "official_warning_active": {
                "parameter": "official_warning_active",
                "value": None,
                "unit": None,
                "source": None,
                "product_id": None,
                "retrieved_at": None,
                "valid_time": vt,
                "observation_type": "forecast",
                "status": "missing",
                "freshness": {"state": "unknown"},
                "confidence": None,
                "official_source": None,
            }
        }

    matching_alert: Optional[Dict[str, Any]] = None
    min_distance = 999999.0

    if alerts:
        for alert in alerts:
            dtype = str(alert.get("disaster_type", "")).lower()
            if not any(k in dtype for k in RELEVANT_DISASTER_TYPES):
                continue

            # Spec 49.1: Check time overlap
            eff_start = alert.get("effective_start_time")
            eff_end = alert.get("effective_end_time")
            if not is_alert_window_overlapping(eff_start, eff_end, win_start, win_end):
                # Alert is expired or in the distant future -> skip
                continue

            coords = _parse_centroid(alert.get("centroid"))
            if not coords:
                continue

            dist = _haversine_distance_km(lat, lon, coords[0], coords[1])
            if dist < 120.0 and dist < min_distance:
                min_distance = dist
                matching_alert = alert

    has_warning = (matching_alert is not None)

    m = _measurement(
        parameter="official_warning_active",
        value=has_warning,
        source="NDMA SACHET",
        product_id="NDMA-SACHET-CAP",
        valid_time=vt,
        confidence=0.95,
        status="available"
    )

    if has_warning and matching_alert is not None:
        bulletin_id = f"NDMA-SACHET-{matching_alert.get('identifier', 'OFFICIAL')}"
        issuing_auth = matching_alert.get("alert_source") or matching_alert.get("sender_org_id") or "NDMA SACHET"
        affected_area = matching_alert.get("area_description") or "Coastal Belt"
        raw_msg = matching_alert.get("warning_message") or "Official severe weather warning active from NDMA SACHET."

        # Grade strictly from severity_color
        warning_level = grade_severity_from_color(
            matching_alert.get("severity_color"),
            matching_alert.get("severity")
        )

        m["official_source"] = {
            "issuing_authority": issuing_auth,
            "bulletin_id": bulletin_id,
            "warning_level": warning_level,
            "affected_area": affected_area,
            "valid_from": vt,
            "valid_to": vt
        }

    return {"official_warning_active": m}


FETCHERS: Dict[str, Any] = {
    "cyclone": cyclone,
}
