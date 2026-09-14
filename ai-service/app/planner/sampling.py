"""
app/planner/sampling.py

Sections 15-17 - Spatial Sampling. Turns one validated location into the set of
points every data agent will be queried for.

CONTRACT (contracts/PointObservation.json):
    required: point_id, lat, lon, point_status, land_sea
    point_status enum: applicable | not_applicable | prohibited
    land_sea enum:     land | sea

NOTE the enum is "applicable", not "analysed" - easy to get wrong.

Section 15: a land point inside an otherwise valid grid is NOT an error. It is
marked not_applicable and KEPT in the array. Dropping it would silently shrink
the grid and hide the fact that part of the requested area is unusable.
"""

import math
from typing import Any, Dict, List

from app.planner.location import is_on_land

EARTH_RADIUS_KM = 6371.0088


def _offset(lat: float, lon: float, north_km: float, east_km: float):
    """Shift a coordinate by a north/east offset in km."""
    d_lat = north_km / 111.32
    # Longitude degrees shrink with latitude, so scale by cos(lat).
    d_lon = east_km / (111.32 * math.cos(math.radians(lat)) or 1e-9)
    return lat + d_lat, lon + d_lon


def _point(point_id: str, lat: float, lon: float, *, center=None) -> Dict[str, Any]:
    """Build one contract-shaped PointObservation."""
    on_land = is_on_land(lat, lon)
    p: Dict[str, Any] = {
        "point_id": point_id,
        "lat": round(lat, 4),
        "lon": round(lon, 4),
        # A land point is not_applicable, never dropped (Section 15).
        "point_status": "not_applicable" if on_land else "applicable",
        "land_sea": "land" if on_land else "sea",
    }

    if center:
        c_lat, c_lon = center
        from app.planner.location import haversine_km

        p["distance_km"] = round(haversine_km(c_lat, c_lon, lat, lon), 2)
        p["bearing_deg"] = round(_bearing(c_lat, c_lon, lat, lon), 1)

    return p


def _bearing(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_lambda = math.radians(lon2 - lon1)
    y = math.sin(d_lambda) * math.cos(phi2)
    x = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(d_lambda)
    return (math.degrees(math.atan2(y, x)) + 360) % 360


def single_point(lat: float, lon: float) -> List[Dict[str, Any]]:
    """One point. Used for quick information and simple point queries."""
    return [_point("P1", lat, lon)]


def nine_point_grid(lat: float, lon: float, radius_km: float = 5.0) -> List[Dict[str, Any]]:
    """Section 15 - the 3x3 grid: centre plus 8 surrounding points.

    P1 is always the centre so downstream code can rely on that. The rest run
    N, NE, E, SE, S, SW, W, NW.
    """
    points = [_point("P1", lat, lon, center=(lat, lon))]

    directions = [
        ("P2", radius_km, 0.0),          # N
        ("P3", radius_km, radius_km),    # NE
        ("P4", 0.0, radius_km),          # E
        ("P5", -radius_km, radius_km),   # SE
        ("P6", -radius_km, 0.0),         # S
        ("P7", -radius_km, -radius_km),  # SW
        ("P8", 0.0, -radius_km),         # W
        ("P9", radius_km, -radius_km),   # NW
    ]

    for pid, north, east in directions:
        p_lat, p_lon = _offset(lat, lon, north, east)
        points.append(_point(pid, p_lat, p_lon, center=(lat, lon)))

    return points


def regional_scan(
    lat: float, lon: float, radius_km: float = 50.0, spacing_km: float = 25.0
) -> List[Dict[str, Any]]:
    """Section 16 - a coarser, wider grid for 'where should I go' questions.

    Capped at 25 points: beyond that the agent fan-out cost outweighs the extra
    spatial resolution.
    """
    points: List[Dict[str, Any]] = []
    steps = int(radius_km / spacing_km)
    idx = 1

    for i in range(-steps, steps + 1):
        for j in range(-steps, steps + 1):
            if idx > 25:
                break
            p_lat, p_lon = _offset(lat, lon, i * spacing_km, j * spacing_km)
            points.append(_point(f"P{idx}", p_lat, p_lon, center=(lat, lon)))
            idx += 1

    return points


def route_corridor(
    origin: Dict[str, float], destination: Dict[str, float], samples: int = 9
) -> List[Dict[str, Any]]:
    """Section 16 - points sampled along the straight line between two places.

    A real pathfinder refines this later; this is the corridor the risk-cost
    grid is built from.
    """
    points = []
    for i in range(samples):
        t = i / (samples - 1) if samples > 1 else 0.0
        lat = origin["lat"] + (destination["lat"] - origin["lat"]) * t
        lon = origin["lon"] + (destination["lon"] - origin["lon"]) * t
        points.append(_point(f"P{i + 1}", lat, lon))
    return points


def build(
    *,
    mode: str,
    lat: float,
    lon: float,
    radius_km: float = 5.0,
    origin: Dict[str, float] = None,
    destination: Dict[str, float] = None,
) -> Dict[str, Any]:
    """Return {"sampling": <contract sampling object>, "points": [...]}.

    `mode` must be one of the contract's enum values:
    single_point | local_grid | regional_scan | route_corridor | historical
    """
    if mode == "single_point":
        points = single_point(lat, lon)
        sampling = {"mode": "single_point", "radius_km": None}

    elif mode == "regional_scan":
        points = regional_scan(lat, lon, radius_km=50.0, spacing_km=25.0)
        sampling = {"mode": "regional_scan", "radius_km": 50.0, "spacing_km": 25.0}

    elif mode == "route_corridor" and origin and destination:
        points = route_corridor(origin, destination)
        sampling = {"mode": "route_corridor", "radius_km": None}

    elif mode == "historical":
        # Historical questions are about one place over time, not many places.
        points = single_point(lat, lon)
        sampling = {"mode": "historical", "radius_km": None}

    else:  # local_grid is the default for point-safety work
        points = nine_point_grid(lat, lon, radius_km)
        sampling = {"mode": "local_grid", "radius_km": radius_km, "shape": "square"}

    return {"sampling": sampling, "points": points}
