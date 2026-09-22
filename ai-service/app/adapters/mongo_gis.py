"""
app/adapters/mongo_gis.py
---------------------------------------------------------------------------
Production GIS Adapter for ORCA AI Service.

Connects to MongoDB `gis_layers` collection to perform real-time spatial
geometry queries against authoritative maritime boundaries, MPAs, and zones.
Enforces the Measurement contract (contracts/Measurement.json) and SI units
(shared-config/canonical-units.json) -- see Sections 24.2, 43, and 65.1.

Parameters Produced:
  - inside_prohibited_zone (Boolean, unit=None)
  - distance_to_boundary_km (Number, unit="km")
  - water_depth_m (Number, unit="m")
  - zone_name (String, unit=None)
  - zone_category (String, unit=None)
  - constraint_type (String, unit=None)
  - nearest_boundary_name (String, unit=None)
---------------------------------------------------------------------------
"""

import logging
import math
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import httpx
import pymongo
from app.config.settings import settings

log = logging.getLogger("orca.ai_service.adapters.gis")

_mongo_client: Optional[pymongo.MongoClient] = None


def _get_db() -> pymongo.database.Database:
    global _mongo_client
    if _mongo_client is None:
        _mongo_client = pymongo.MongoClient(
            settings.MONGO_URI,
            serverSelectionTimeoutMS=3000,
        )
    return _mongo_client[settings.MONGO_DB]


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0088
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    return 2 * r * math.asin(math.sqrt(a))


def _nearest_point_on_geometry(
    geometry: Optional[Dict[str, Any]], lat: float, lon: float
) -> Optional[Tuple[float, float, float]]:
    if not geometry or not geometry.get("coordinates"):
        return None

    best_dist = float("inf")
    best_coords = None

    def walk(coords):
        nonlocal best_dist, best_coords
        if (
            isinstance(coords, (list, tuple))
            and len(coords) >= 2
            and isinstance(coords[0], (int, float))
            and isinstance(coords[1], (int, float))
        ):
            pt_lon, pt_lat = float(coords[0]), float(coords[1])
            d = _haversine_km(lat, lon, pt_lat, pt_lon)
            if d < best_dist:
                best_dist = d
                best_coords = (pt_lat, pt_lon)
            return

        if isinstance(coords, (list, tuple)):
            for child in coords:
                walk(child)

    walk(geometry["coordinates"])
    if best_coords is not None:
        return (best_coords[0], best_coords[1], best_dist)
    return None


def _is_season_active(season_start: Optional[str], season_end: Optional[str]) -> bool:
    if not season_start or not season_end:
        return True

    today_str = datetime.now(timezone.utc).strftime("%m-%d")
    if season_start <= season_end:
        return season_start <= today_str <= season_end
    return today_str >= season_start or today_str <= season_end


import time as _time

_gebco_cache: Dict[Tuple[float, float], Tuple[Optional[float], str, str, str]] = {}
_gebco_cooldown_until: float = 0.0


def _fetch_gebco_depth(lat: float, lon: float) -> Tuple[Optional[float], str, str, str]:
    global _gebco_cooldown_until
    key = (round(lat, 2), round(lon, 2))
    if key in _gebco_cache:
        return _gebco_cache[key]

    now_ts = _time.time()
    if now_ts >= _gebco_cooldown_until:
        url = f"{settings.GEBCO_BATHYMETRY_URL}?locations={lat:.4f},{lon:.4f}"
        try:
            resp = httpx.get(url, timeout=1.5)
            if resp.status_code == 200:
                data = resp.json()
                results = data.get("results", [])
                if results and "elevation" in results[0]:
                    elev = results[0]["elevation"]
                    if elev is not None:
                        elev = float(elev)
                        depth = abs(elev) if elev < 0 else 1.0
                        res = (round(depth, 2), "GEBCO", "gebco2020", "available")
                        _gebco_cache[key] = res
                        return res
            elif resp.status_code == 429:
                log.warning("[mongo_gis] GEBCO rate limit encountered. Cooldown 30s.")
                _gebco_cooldown_until = now_ts + 30.0
        except Exception as exc:
            log.warning("[mongo_gis] GEBCO API call failed or timed out: %s. Cooldown 30s.", exc)
            _gebco_cooldown_until = now_ts + 30.0

    # If GEBCO fails, report water_depth_m as status "missing" without sine formula
    res = (None, "GEBCO", "gebco2020", "missing")
    return res


def _measurement(
    *,
    parameter: str,
    value: Any,
    unit: Optional[str],
    source: str,
    product_id: str,
    valid_time: str,
    status: str = "available",
    confidence: float = 0.95,
) -> Dict[str, Any]:
    now_iso = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    return {
        "parameter": parameter,
        "value": value,
        "unit": unit,
        "source": source,
        "product_id": product_id,
        "retrieved_at": now_iso,
        "valid_time": valid_time,
        "observation_type": "observation",
        "status": status,
        "freshness": {
            "state": "fresh",
            "age_hours": 0.1,
            "max_age_hours": 24.0,
        },
        "confidence": confidence,
        "official_source": None,
    }


def gis(lat: float, lon: float, time_window_utc: str) -> Dict[str, Any]:
    valid_time = time_window_utc.split("/")[0] if "/" in time_window_utc else time_window_utc
    db = _get_db()
    point_geom = {"type": "Point", "coordinates": [lon, lat]}

    is_prohibited = False
    prohibited_source = "MongoDB gis_layers (WDPA)"
    prohibited_product = "WDPA-2024"
    matched_zone_name = "Indian EEZ (Open Waters)"
    matched_zone_category = "exclusive_economic_zone"
    matched_constraint_type = "warning_only"

    try:
        # Check explicit prohibited zones (MPAs, military boundaries, etc.)
        prohibited_match = db.gis_layers.find_one({
            "active": True,
            "constraint_type": "prohibited",
            "geometry_full": {"$geoIntersects": {"$geometry": point_geom}},
        })

        if prohibited_match:
            is_auth = prohibited_match.get("verification") == "authoritative"
            prohibited_source = prohibited_match.get("source", "WDPA")
            prohibited_product = prohibited_match.get("layer_name", "prohibited_zone")
            matched_zone_category = prohibited_match.get("layer_type", "marine_protected_area")

            if is_auth:
                is_prohibited = True
                matched_constraint_type = "prohibited"
                matched_zone_name = prohibited_match.get("layer_name", "Prohibited Maritime Zone")
            else:
                is_prohibited = False
                matched_constraint_type = "warning_only"
                raw_name = prohibited_match.get("layer_name", "Prohibited Maritime Zone")
                clean_name = raw_name.replace(" (approximate boundary, unverified)", "")
                matched_zone_name = f"{clean_name} (approximate boundary, unverified)"
        else:
            # Check seasonal fishing ban zones
            seasonal_matches = db.gis_layers.find({
                "active": True,
                "layer_type": "seasonal_fishing_ban_area",
                "geometry_full": {"$geoIntersects": {"$geometry": point_geom}},
            })
            seasonal_found = False
            for s_match in seasonal_matches:
                if _is_season_active(s_match.get("season_start"), s_match.get("season_end")):
                    is_auth = s_match.get("verification") == "authoritative"
                    prohibited_source = s_match.get("source", "Department of Fisheries")
                    prohibited_product = s_match.get("layer_name", "seasonal_ban")
                    matched_zone_category = "seasonal_fishing_ban_area"

                    if is_auth:
                        is_prohibited = True
                        matched_constraint_type = "prohibited"
                        matched_zone_name = s_match.get("layer_name", "Seasonal Fishing Ban Area")
                    else:
                        is_prohibited = False
                        matched_constraint_type = "warning_only"
                        raw_name = s_match.get("layer_name", "Seasonal Fishing Ban Area")
                        clean_name = raw_name.replace(" (approximate boundary, unverified)", "")
                        matched_zone_name = f"{clean_name} (approximate boundary, unverified)"

                    seasonal_found = True
                    break

            if not seasonal_found:
                # Find any other active layer that covers this point
                any_match = db.gis_layers.find_one({
                    "active": True,
                    "geometry_full": {"$geoIntersects": {"$geometry": point_geom}},
                })
                if any_match:
                    matched_zone_name = any_match.get("layer_name", "Indian EEZ (Open Waters)")
                    matched_zone_category = any_match.get("layer_type", "exclusive_economic_zone")
                    matched_constraint_type = any_match.get("constraint_type", "warning_only")
    except Exception as exc:
        log.error("[mongo_gis] Error querying inside_prohibited_zone: %s", exc)

    distance_km: float = 0.0
    boundary_source = "Marine Regions"
    boundary_product = "EEZ-v11"
    nearest_boundary_name = "Indian Maritime Boundary"

    if is_prohibited:
        distance_km = 0.0
        nearest_boundary_name = matched_zone_name
    else:
        try:
            nearby_layers = list(
                db.gis_layers.find({
                    "active": True,
                    "$or": [
                        {"constraint_type": "prohibited"},
                        {"layer_type": "international_maritime_boundary"},
                        {"layer_type": "exclusive_economic_zone"},
                    ],
                    "geometry_full": {
                        "$near": {
                            "$geometry": point_geom,
                            "$maxDistance": 500000,
                        }
                    },
                }).limit(5)
            )

            if nearby_layers:
                min_dist = float("inf")
                best_layer = None
                for layer in nearby_layers:
                    res = _nearest_point_on_geometry(layer.get("geometry_full"), lat, lon)
                    if res and res[2] < min_dist:
                        min_dist = res[2]
                        best_layer = layer

                if min_dist < float("inf") and best_layer:
                    distance_km = round(min_dist, 2)
                    boundary_source = best_layer.get("source", "Marine Regions")
                    boundary_product = best_layer.get("layer_name", "EEZ-v11")
                    nearest_boundary_name = best_layer.get("layer_name", "Indian Maritime Boundary")
                else:
                    distance_km = 50.0
                    nearest_boundary_name = "Indian EEZ Perimeter"
            else:
                distance_km = 50.0
                nearest_boundary_name = "Indian EEZ Perimeter"
        except Exception as exc:
            log.error("[mongo_gis] Error querying distance_to_boundary_km: %s", exc)
            distance_km = 25.0
            nearest_boundary_name = "Indian EEZ Perimeter"

    depth_m, depth_source, depth_product, depth_status = _fetch_gebco_depth(lat, lon)

    return {
        "water_depth_m": _measurement(
            parameter="water_depth_m",
            value=depth_m,
            unit="m" if depth_m is not None else None,
            source=depth_source,
            product_id=depth_product,
            valid_time=valid_time,
            status=depth_status,
            confidence=0.95 if depth_status == "available" else None,
        ),
        "distance_to_boundary_km": _measurement(
            parameter="distance_to_boundary_km",
            value=distance_km,
            unit="km",
            source=boundary_source,
            product_id=boundary_product,
            valid_time=valid_time,
        ),
        "inside_prohibited_zone": _measurement(
            parameter="inside_prohibited_zone",
            value=is_prohibited,
            unit=None,
            source=prohibited_source,
            product_id=prohibited_product,
            valid_time=valid_time,
        ),
        "zone_name": _measurement(
            parameter="zone_name",
            value=matched_zone_name,
            unit=None,
            source=prohibited_source if is_prohibited else "MongoDB gis_layers",
            product_id=prohibited_product if is_prohibited else "EEZ-v11",
            valid_time=valid_time,
        ),
        "zone_category": _measurement(
            parameter="zone_category",
            value=matched_zone_category,
            unit=None,
            source=prohibited_source if is_prohibited else "MongoDB gis_layers",
            product_id=prohibited_product if is_prohibited else "EEZ-v11",
            valid_time=valid_time,
        ),
        "constraint_type": _measurement(
            parameter="constraint_type",
            value=matched_constraint_type,
            unit=None,
            source=prohibited_source if is_prohibited else "MongoDB gis_layers",
            product_id=prohibited_product if is_prohibited else "EEZ-v11",
            valid_time=valid_time,
        ),
        "nearest_boundary_name": _measurement(
            parameter="nearest_boundary_name",
            value=nearest_boundary_name,
            unit=None,
            source=boundary_source,
            product_id=boundary_product,
            valid_time=valid_time,
        ),
    }


FETCHERS = {
    "gis": gis,
}
