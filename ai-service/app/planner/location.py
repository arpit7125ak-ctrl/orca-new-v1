"""
app/planner/location.py

Section 13 - Location Resolution and Validation, including offshore snapping.

This is squarely the AI Service's job, NOT the Backend's (Section 7.10). The
Backend deliberately does no geocoding and no land/sea determination - it
accepts a land coordinate without complaint and leaves the judgement here.

RULES:
  1. Use coordinates at sea AS GIVEN, never snap. (Elevation < 0)
  2. Snap ONLY if GEBCO elevation >= 0 (land) to nearest water within 25 km.
  3. Reject inland points > 25 km from coastal water.
  4. Fail closed (upstream_unavailable) if terrain service unreachable.
"""

import json
import math
from typing import Any, Dict, List, Optional, Tuple
import urllib.request

from app.config.settings import settings
from app.observability.logger import log

# Minimal coastal gazetteer. Each entry carries an offshore reference point so
# a land-side city can be snapped to water deterministically.
_GAZETTEER: Dict[str, Dict[str, Any]] = {
    "chennai":        {"lat": 13.0827, "lon": 80.2707, "offshore": (13.05, 80.45), "state": "Tamil Nadu"},
    "kasimedu":       {"lat": 13.1300, "lon": 80.2950, "offshore": (13.15, 80.45), "state": "Tamil Nadu"},
    "puducherry":     {"lat": 11.9416, "lon": 79.8083, "offshore": (11.93, 79.95), "state": "Puducherry"},
    "visakhapatnam":  {"lat": 17.6868, "lon": 83.2185, "offshore": (17.65, 83.45), "state": "Andhra Pradesh"},
    "paradip":        {"lat": 20.3160, "lon": 86.6110, "offshore": (20.20, 86.80), "state": "Odisha"},
    "kolkata":        {"lat": 22.5726, "lon": 88.3639, "offshore": (21.60, 88.30), "state": "West Bengal"},
    "mumbai":         {"lat": 19.0760, "lon": 72.8777, "offshore": (19.00, 72.70), "state": "Maharashtra"},
    "goa":            {"lat": 15.2993, "lon": 74.1240, "offshore": (15.30, 73.70), "state": "Goa"},
    "mangalore":      {"lat": 12.9141, "lon": 74.8560, "offshore": (12.90, 74.70), "state": "Karnataka"},
    "kochi":          {"lat": 9.9312,  "lon": 76.2673, "offshore": (9.93, 76.10),  "state": "Kerala"},
    "kozhikode":      {"lat": 11.2588, "lon": 75.7804, "offshore": (11.26, 75.60), "state": "Kerala"},
    "tuticorin":      {"lat": 8.7642,  "lon": 78.1348, "offshore": (8.75, 78.30),  "state": "Tamil Nadu"},
    "rameswaram":     {"lat": 9.2876,  "lon": 79.3129, "offshore": (9.30, 79.45),  "state": "Tamil Nadu"},
    "veraval":        {"lat": 20.9077, "lon": 70.3670, "offshore": (20.85, 70.35), "state": "Gujarat"},
    "kandla":         {"lat": 23.0333, "lon": 70.2167, "offshore": (22.90, 70.10), "state": "Gujarat"},
    "port blair":     {"lat": 11.6234, "lon": 92.7265, "offshore": (11.60, 92.85), "state": "Andaman & Nicobar"},
    "digha":          {"lat": 21.6270, "lon": 87.5070, "offshore": (21.55, 87.55), "state": "West Bengal"},
    "gopalpur":       {"lat": 19.2647, "lon": 84.9126, "offshore": (19.22, 85.00), "state": "Odisha"},
}

EARTH_RADIUS_KM = 6371.0088


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in km."""
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lon / 2) ** 2
    )
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(a))


def _geocode(place_name: str) -> Optional[Dict[str, Any]]:
    """Resolve a place name against coastal gazetteer."""
    key = place_name.strip().lower()
    if key in _GAZETTEER:
        return _GAZETTEER[key]
    for name, entry in _GAZETTEER.items():
        if name in key or key in name:
            return entry
    return None


def check_gebco_elevations_batch(
    points: List[Tuple[float, float]]
) -> Tuple[Optional[List[Optional[float]]], Optional[str]]:
    """Query GEBCO bathymetry / elevation in batch from settings.GEBCO_BATHYMETRY_URL.

    Returns (list_of_elevations, error_category).
    If elevation < 0.0: coordinate is at sea.
    If elevation >= 0.0: coordinate is on land.
    If service is unreachable: returns (None, 'upstream_unavailable').
    """
    if not points:
        return [], None

    all_elevations: List[Optional[float]] = []
    chunk_size = 50
    for i in range(0, len(points), chunk_size):
        chunk = points[i : i + chunk_size]
        loc_str = "|".join(f"{lat:.4f},{lon:.4f}" for lat, lon in chunk)
        url = f"{settings.GEBCO_BATHYMETRY_URL}?locations={loc_str}"
        try:
            req = urllib.request.Request(
                url, headers={"User-Agent": "ORCA-Marine-Platform/1.0"}
            )
            with urllib.request.urlopen(req, timeout=12) as resp:
                if resp.status != 200:
                    log.error("[location:gebco] GEBCO batch status code %s", resp.status)
                    return None, "upstream_unavailable"
                data = json.loads(resp.read().decode("utf-8"))
                results = data.get("results", [])
                if len(results) != len(chunk):
                    log.error("[location:gebco] Expected %d results, got %d", len(chunk), len(results))
                    return None, "upstream_unavailable"
                for res in results:
                    elev = res.get("elevation")
                    all_elevations.append(float(elev) if elev is not None else None)
        except Exception as exc:
            log.error("[location:gebco] GEBCO batch check failed: %s", exc)
            return None, "upstream_unavailable"

    return all_elevations, None


def check_gebco_elevation(lat: float, lon: float) -> Tuple[Optional[float], Optional[str]]:
    """Query GEBCO bathymetry / elevation for a single point."""
    elevs, err = check_gebco_elevations_batch([(lat, lon)])
    if err or not elevs:
        return None, err or "upstream_unavailable"
    return elevs[0], None


def is_on_land(lat: float, lon: float) -> bool:
    """Determine if a coordinate is on land using GEBCO elevation."""
    elev, err = check_gebco_elevation(lat, lon)
    if elev is not None:
        return elev >= 0.0
    for entry in _GAZETTEER.values():
        if haversine_km(lat, lon, entry["lat"], entry["lon"]) < 12.0:
            return True
    return False


def _nearest_gazetteer_entry(lat: float, lon: float):
    best_name, best_entry, best_dist = None, None, float("inf")
    for name, entry in _GAZETTEER.items():
        d = haversine_km(lat, lon, entry["lat"], entry["lon"])
        if d < best_dist:
            best_name, best_entry, best_dist = name, entry, d
    return best_name, best_entry


def destination_point(lat: float, lon: float, dist_km: float, bearing_deg: float) -> Tuple[float, float]:
    """Calculate destination point given starting point, distance (km), and bearing (degrees)."""
    d = dist_km / EARTH_RADIUS_KM
    brg = math.radians(bearing_deg)
    lat1 = math.radians(lat)
    lon1 = math.radians(lon)
    lat2 = math.asin(
        math.sin(lat1) * math.cos(d) + math.cos(lat1) * math.sin(d) * math.cos(brg)
    )
    lon2 = lon1 + math.atan2(
        math.sin(brg) * math.sin(d) * math.cos(lat1),
        math.cos(d) - math.sin(lat1) * math.sin(lat2),
    )
    return round(math.degrees(lat2), 4), round(math.degrees(lon2), 4)


def find_nearest_navigable_water(
    lat: float, lon: float, max_dist_km: float = 25.0
) -> Tuple[Optional[Tuple[float, float, float]], Optional[str]]:
    """Concentric ring search for nearest water with depth >= 3.0 m (GEBCO elevation <= -3.0 m).

    Searches in concentric rings up to max_dist_km.
    Returns ((water_lat, water_lon, dist_km), error_category).
    """
    radii = [1.5, 3.0, 5.0, 7.5, 10.0, 13.0, 16.5, 20.5, 25.0]
    candidates = []
    for r in radii:
        if r > max_dist_km:
            continue
        # Inner rings (<= 5 km) 12 bearings (30 deg); outer rings 8 bearings (45 deg)
        bearings = [i * 30 for i in range(12)] if r <= 5.0 else [i * 45 for i in range(8)]
        for b in bearings:
            c_lat, c_lon = destination_point(lat, lon, r, b)
            candidates.append((r, b, c_lat, c_lon))

    loc_str = "|".join(f"{c[2]:.4f},{c[3]:.4f}" for c in candidates)
    url = f"{settings.GEBCO_BATHYMETRY_URL}?locations={loc_str}"
    try:
        req = urllib.request.Request(
            url, headers={"User-Agent": "ORCA-Marine-Platform/1.0"}
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            if resp.status != 200:
                log.error("[location:gebco] GEBCO radial search status %s", resp.status)
                return None, "upstream_unavailable"
            data = json.loads(resp.read().decode("utf-8"))
            results = data.get("results", [])
    except Exception as exc:
        log.error("[location:gebco] GEBCO radial search failed: %s", exc)
        return None, "upstream_unavailable"

    valid_water = []
    for (r, b, c_lat, c_lon), res in zip(candidates, results):
        elev = res.get("elevation")
        if elev is not None and elev <= -3.0:
            actual_dist = haversine_km(lat, lon, c_lat, c_lon)
            if actual_dist <= max_dist_km:
                valid_water.append((c_lat, c_lon, actual_dist))

    if not valid_water:
        log.warning("[location] No navigable water (depth >= 3m) found within %.1f km of %.4f, %.4f", max_dist_km, lat, lon)
        return None, "invalid_location"

    valid_water.sort(key=lambda x: x[2])
    best = valid_water[0]
    log.info("[location] Concentric ring search found navigable water at %.4f, %.4f (%.2f km, elevation <= -3m)", best[0], best[1], best[2])
    return (best[0], best[1], round(best[2], 2)), None


def resolve(
    *,
    coordinate: Optional[Dict[str, float]] = None,
    place_name: Optional[str] = None,
    query: Optional[str] = None,
) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    """Resolve input into a contract-shaped Location.

    Returns (location, error_category). On failure, location is None and
    error_category is one of ErrorInfo values.
    """
    original_lat: Optional[float] = None
    original_lon: Optional[float] = None
    original_name: Optional[str] = place_name
    is_coord_input = False

    # 1. Coordinate provided
    if coordinate and coordinate.get("lat") is not None and coordinate.get("lon") is not None:
        original_lat = float(coordinate["lat"])
        original_lon = float(coordinate["lon"])
        is_coord_input = True
    # 2. Place name provided
    elif place_name:
        hit = _geocode(place_name)
        if not hit:
            log.warning("[location] could not resolve place name: %r", place_name)
            return None, "unresolvable_place"
        original_lat, original_lon = hit["lat"], hit["lon"]
        is_coord_input = False
    # 3. Query string provided - search gazetteer places
    elif query and isinstance(query, str) and query.strip():
        q_lower = query.lower()
        matched = None
        for name, entry in _GAZETTEER.items():
            if name in q_lower:
                matched = (name, entry)
                break
        if matched:
            original_name = matched[0].title()
            original_lat, original_lon = matched[1]["lat"], matched[1]["lon"]
            log.info("[location] Resolved place %r from query text: %r", original_name, query)
            is_coord_input = False
        else:
            # Query has no resolvable place or coordinate -> canonical invalid_location
            return None, "invalid_location"
    else:
        return None, "invalid_location"

    # Coverage check: Indian marine domain
    if not (5.0 <= original_lat <= 25.0 and 66.0 <= original_lon <= 95.0):
        log.warning("[location] outside supported region: %s, %s", original_lat, original_lon)
        return None, "unsupported_region"

    # GEBCO Bathymetry Check: Fail closed if terrain service unreachable
    elevation, err = check_gebco_elevation(original_lat, original_lon)
    if err is not None:
        log.error("[location] Terrain service unreachable; failing closed with upstream_unavailable")
        return None, "upstream_unavailable"

    validated_lat, validated_lon = original_lat, original_lon
    snapped = False
    snap_distance_km: Optional[float] = None
    snap_reference: Optional[str] = None

    if elevation >= 0.0:
        if is_coord_input:
            # R11: Radial/concentric ring search for land coordinates snapping to nearest water (>= 3 m depth) within 25 km
            hit, ring_err = find_nearest_navigable_water(original_lat, original_lon, max_dist_km=25.0)
            if ring_err:
                return None, ring_err
            validated_lat, validated_lon, snap_dist = hit
            snapped = True
            snap_distance_km = snap_dist
            snap_reference = "nearest navigable water (concentric ring search)"
            log.info(
                "[location] snapped land coordinate %.4f,%.4f -> %.4f,%.4f (%.1f km, %s)",
                original_lat, original_lon, validated_lat, validated_lon,
                snap_distance_km, snap_reference,
            )
        else:
            # Place name: use gazetteer offshore reference point
            nearest_name, nearest = _nearest_gazetteer_entry(original_lat, original_lon)
            if not nearest:
                return None, "invalid_location"
            water_lat, water_lon = nearest["offshore"]
            dist_km = haversine_km(original_lat, original_lon, water_lat, water_lon)
            if dist_km > 25.0:
                log.warning("[location] Point %.4f, %.4f is inland (%.1f km > 25 km from water); rejected", original_lat, original_lon, dist_km)
                return None, "invalid_location"

            validated_lat, validated_lon = water_lat, water_lon
            snapped = True
            snap_distance_km = round(dist_km, 2)
            snap_reference = f"offshore of {nearest_name.title()}"
            log.info(
                "[location] snapped place name %.4f,%.4f -> %.4f,%.4f (%.1f km, %s)",
                original_lat, original_lon, validated_lat, validated_lon,
                snap_distance_km, snap_reference,
            )
    else:
        # Point is at sea: USE AS GIVEN, NEVER SNAP!
        snapped = False
        snap_distance_km = None
        snap_reference = None
        log.info("[location] Point %.4f, %.4f is at sea (elevation=%.1f m); kept as given", original_lat, original_lon, elevation)

    location = {
        "original": {
            "name": original_name,
            "lat": round(original_lat, 4),
            "lon": round(original_lon, 4),
        },
        "validated": {
            "lat": round(validated_lat, 4),
            "lon": round(validated_lon, 4),
            "snapped": snapped,
            "snap_distance_km": snap_distance_km,
            "snap_reference": snap_reference,
        },
    }
    return location, None
