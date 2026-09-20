"""
app/planner/location.py

Section 13 - Location Resolution and Validation, including offshore snapping.

This is squarely the AI Service's job, NOT the Backend's (Section 7.10). The
Backend deliberately does no geocoding and no land/sea determination - it
accepts a land coordinate without complaint and leaves the judgement here.

CONTRACT SHAPE (contracts/shared/Location.json):
    {
      "original":  { "name": str|null, "lat": float, "lon": float },
      "validated": { "lat": float, "lon": float, "snapped": bool,
                     "snap_distance_km": float|null, "snap_reference": str|null }
    }
original.lat and original.lon are REQUIRED - a place-name-only request must be
geocoded before a Location can be built at all.

MOCK MODE: the gazetteer below is a small hardcoded set of Indian coastal
places, enough for the demo and for offline development. Phase A4 replaces
_geocode() with a real geocoder; nothing else in this module changes.
"""

import math
from typing import Any, Dict, Optional, Tuple

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
    """Resolve a place name. Substring match so "Chennai Port" finds "chennai".

    Phase A4: replace with a real geocoder. Everything else stays identical.
    """
    key = place_name.strip().lower()
    if key in _GAZETTEER:
        return _GAZETTEER[key]
    for name, entry in _GAZETTEER.items():
        if name in key or key in name:
            return entry
    return None


def is_on_land(lat: float, lon: float) -> bool:
    """Crude land/sea test for the Indian coastal region.

    Deliberately simple and deliberately CONSERVATIVE: a point within ~12 km of
    a known coastal city centre is treated as land-side and snapped offshore.
    Erring toward snapping is the safe direction - analysing genuine open water
    a few km further out is harmless, whereas analysing a land pixel produces
    meaningless marine data.

    Phase A4: replace with a real land/sea mask raster.
    """
    for entry in _GAZETTEER.values():
        if haversine_km(lat, lon, entry["lat"], entry["lon"]) < 12.0:
            return True
    return False


def resolve(
    *,
    coordinate: Optional[Dict[str, float]],
    place_name: Optional[str],
    query: Optional[str] = None,
) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    """Resolve input into a contract-shaped Location.

    Returns (location, error_category). On failure, location is None and
    error_category is one of the ErrorInfo values - the caller turns that into
    a failed analysis rather than guessing a location.
    """
    original_lat: Optional[float] = None
    original_lon: Optional[float] = None
    original_name: Optional[str] = place_name

    # An explicit coordinate always wins over a name - it is unambiguous.
    if coordinate and coordinate.get("lat") is not None and coordinate.get("lon") is not None:
        original_lat = float(coordinate["lat"])
        original_lon = float(coordinate["lon"])
    elif place_name:
        hit = _geocode(place_name)
        if not hit:
            log.warning("[location] could not resolve place name: %r", place_name)
            return None, "unresolvable_place"
        original_lat, original_lon = hit["lat"], hit["lon"]
    elif query and isinstance(query, str) and query.strip():
        # Natural language extraction: check if any gazetteer place is mentioned in query
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
        else:
            # Fallback for general maritime queries (e.g., safety advice, general sea state)
            original_name = "Indian Coastal Waters (Baseline)"
            original_lat, original_lon = _GAZETTEER["kochi"]["lat"], _GAZETTEER["kochi"]["lon"]
            log.info("[location] Used baseline Indian coastal location for general query: %r", query)
    else:
        return None, "invalid_location"

    # Section 13: coverage check. Outside the Indian marine region we have no
    # data, and saying so is better than returning confident nonsense.
    if not (5.0 <= original_lat <= 25.0 and 66.0 <= original_lon <= 95.0):
        log.warning("[location] outside supported region: %s, %s", original_lat, original_lon)
        return None, "unsupported_region"

    # Section 13.3: snap a land-side coastal point to water.
    validated_lat, validated_lon = original_lat, original_lon
    snapped = False
    snap_distance_km: Optional[float] = None
    snap_reference: Optional[str] = None

    if is_on_land(original_lat, original_lon):
        nearest_name, nearest = _nearest_gazetteer_entry(original_lat, original_lon)
        if nearest:
            validated_lat, validated_lon = nearest["offshore"]
            snapped = True
            snap_distance_km = round(
                haversine_km(original_lat, original_lon, validated_lat, validated_lon), 2
            )
            snap_reference = f"offshore of {nearest_name.title()}"
            log.info(
                "[location] snapped %.4f,%.4f -> %.4f,%.4f (%.1f km, %s)",
                original_lat, original_lon, validated_lat, validated_lon,
                snap_distance_km, snap_reference,
            )

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


def _nearest_gazetteer_entry(lat: float, lon: float):
    best_name, best_entry, best_dist = None, None, float("inf")
    for name, entry in _GAZETTEER.items():
        d = haversine_km(lat, lon, entry["lat"], entry["lon"])
        if d < best_dist:
            best_name, best_entry, best_dist = name, entry, d
    return best_name, best_entry
