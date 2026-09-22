"""
app/planner/router.py

Deterministic Marine Route Evaluation Engine.
Conforms strictly to contracts/RouteResult.json.

Calculates safe coastal corridors between origins and destinations in Indian waters.
- Snaps origin and destination using GEBCO bathymetry / location resolution; fails closed.
- Evaluates candidate waypoints along track against GEBCO elevation (land/coast check).
- Scores each waypoint using real Open-Meteo forecasts with baseline.score_point
  for the given vessel and time of passage.
- If forecast data is unavailable for a waypoint, its risk score is null.
"""

from datetime import datetime, timedelta, timezone
import math
from typing import Any, Dict, List, Optional, Tuple

from app.adapters import open_meteo
from app.observability.logger import log
from app.planner import location
from app.risk import baseline

# Cruising speeds by vessel type in km/h
VESSEL_SPEEDS_KMH: Dict[str, float] = {
    "traditional_non_motorized": 7.4,     # ~4 kts
    "motorized_country_craft": 14.8,       # ~8 kts
    "mechanized_fishing_vessel": 18.5,     # ~10 kts
    "mechanized_trawler": 16.5,            # ~9 kts
    "recreational_boat": 33.3,             # ~18 kts
    "large_commercial_vessel": 25.9,       # ~14 kts
}


def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in kilometers."""
    r = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = math.sin(delta_phi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    return 2.0 * r * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))


def _format_location(loc: Dict[str, Any], default_name: str = "Location") -> Dict[str, Any]:
    """Format into contracts/shared/Location.json shape."""
    if not loc:
        loc = {}
    if "original" in loc and "validated" in loc:
        return loc
    coord = loc.get("coordinate") if isinstance(loc.get("coordinate"), dict) else {}
    lat = float(loc.get("lat") or loc.get("latitude") or coord.get("lat") or 0.0)
    lon = float(loc.get("lon") or loc.get("longitude") or coord.get("lon") or 0.0)
    name = loc.get("name") or loc.get("place_name") or default_name
    return {
        "original": {
            "name": name,
            "lat": round(lat, 4),
            "lon": round(lon, 4),
        },
        "validated": {
            "lat": round(lat, 4),
            "lon": round(lon, 4),
            "snapped": False,
            "snap_distance_km": None,
            "snap_reference": None,
        },
    }


def _extract_coord_and_name(loc_input: Dict[str, Any], default_name: str) -> Tuple[Optional[Dict[str, float]], Optional[str]]:
    if not loc_input:
        return None, default_name
    coord = loc_input.get("coordinate") if isinstance(loc_input.get("coordinate"), dict) else None
    if not coord:
        if "lat" in loc_input and "lon" in loc_input:
            coord = {"lat": float(loc_input["lat"]), "lon": float(loc_input["lon"])}
        elif "validated" in loc_input and isinstance(loc_input["validated"], dict):
            coord = {
                "lat": float(loc_input["validated"]["lat"]),
                "lon": float(loc_input["validated"]["lon"]),
            }
        elif "original" in loc_input and isinstance(loc_input["original"], dict):
            coord = {
                "lat": float(loc_input["original"]["lat"]),
                "lon": float(loc_input["original"]["lon"]),
            }
    name = loc_input.get("place_name") or loc_input.get("name")
    if not name and "original" in loc_input and isinstance(loc_input["original"], dict):
        name = loc_input["original"].get("name")
    return coord, name or default_name


def evaluate_route(
    *,
    route_id: str,
    analysis_id: Optional[str],
    origin: Dict[str, Any],
    destination: Dict[str, Any],
    vessel_type: str,
    departure_time: Optional[str] = None,
    num_waypoints: int = 6,
) -> Dict[str, Any]:
    """Compute deterministic waypoint route and risk profile."""
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat().replace("+00:00", "Z")

    # 1. Resolve and snap origin and destination using GEBCO; fail closed if invalid
    o_coord, o_name = _extract_coord_and_name(origin, "Origin")
    d_coord, d_name = _extract_coord_and_name(destination, "Destination")

    origin_loc, o_err = location.resolve(coordinate=o_coord, place_name=o_name)
    if o_err or not origin_loc:
        log.error("[router] Origin resolution failed with %s", o_err)
        return {
            "route_id": route_id,
            "analysis_id": analysis_id,
            "status": "failed",
            "error": {
                "error_category": o_err or "invalid_location",
                "message": f"Origin location could not be validated: {o_err}",
                "retryable": False,
            },
            "origin": origin_loc or _format_location(origin, "Origin"),
            "destination": _format_location(destination, "Destination"),
            "vessel_type": vessel_type,
            "waypoints": [],
            "total_distance_km": None,
            "estimated_duration_hours": None,
            "max_risk_score": None,
            "max_risk_level": None,
            "time_of_passage_risk": [],
            "blocking_reasons": ["Origin is inland, unreachable, or terrain check failed"],
            "generated_at": now_iso,
        }

    dest_loc, d_err = location.resolve(coordinate=d_coord, place_name=d_name)
    if d_err or not dest_loc:
        log.error("[router] Destination resolution failed with %s", d_err)
        return {
            "route_id": route_id,
            "analysis_id": analysis_id,
            "status": "failed",
            "error": {
                "error_category": d_err or "invalid_location",
                "message": f"Destination location could not be validated: {d_err}",
                "retryable": False,
            },
            "origin": origin_loc,
            "destination": dest_loc or _format_location(destination, "Destination"),
            "vessel_type": vessel_type,
            "waypoints": [],
            "total_distance_km": None,
            "estimated_duration_hours": None,
            "max_risk_score": None,
            "max_risk_level": None,
            "time_of_passage_risk": [],
            "blocking_reasons": ["Destination is inland, unreachable, or terrain check failed"],
            "generated_at": now_iso,
        }

    o_lat = origin_loc["validated"]["lat"]
    o_lon = origin_loc["validated"]["lon"]
    d_lat = dest_loc["validated"]["lat"]
    d_lon = dest_loc["validated"]["lon"]

    if departure_time:
        try:
            dep_clean = departure_time.replace("Z", "+00:00")
            dep_dt = datetime.fromisoformat(dep_clean).astimezone(timezone.utc)
        except Exception:
            dep_dt = now
    else:
        dep_dt = now

    speed_kmh = VESSEL_SPEEDS_KMH.get(vessel_type, 14.8)

    # 2. Generate candidate waypoints along track
    raw_points: List[Tuple[float, float]] = []
    for i in range(num_waypoints):
        frac = i / float(num_waypoints - 1) if num_waypoints > 1 else 0.0
        w_lat = round(o_lat + (d_lat - o_lat) * frac, 4)
        w_lon = round(o_lon + (d_lon - o_lon) * frac, 4)
        raw_points.append((w_lat, w_lon))

    # 3. Dense corridor land / coast check with GEBCO (fail closed)
    # Check intermediate waypoints AND intermediate probe points along each leg
    # to catch any land crossings between waypoints.
    probe_points: List[Tuple[float, float]] = []
    sub_samples_per_leg = 4
    for i in range(len(raw_points) - 1):
        p1 = raw_points[i]
        p2 = raw_points[i + 1]
        for step in range(1, sub_samples_per_leg + 1):
            sub_frac = step / float(sub_samples_per_leg + 1)
            probe_lat = round(p1[0] + (p2[0] - p1[0]) * sub_frac, 4)
            probe_lon = round(p1[1] + (p2[1] - p1[1]) * sub_frac, 4)
            probe_points.append((probe_lat, probe_lon))
        if i + 1 < len(raw_points) - 1:
            probe_points.append(raw_points[i + 1])

    elevations, g_err = location.check_gebco_elevations_batch(probe_points)
    if g_err or elevations is None:
        log.error("[router] GEBCO terrain check failed for route corridor: %s", g_err)
        return {
            "route_id": route_id,
            "analysis_id": analysis_id,
            "status": "failed",
            "error": {
                "error_category": "upstream_unavailable",
                "message": f"Terrain elevation check failed for route corridor: {g_err}",
                "retryable": True,
            },
            "origin": origin_loc,
            "destination": dest_loc,
            "vessel_type": vessel_type,
            "waypoints": [],
            "total_distance_km": None,
            "estimated_duration_hours": None,
            "max_risk_score": None,
            "max_risk_level": None,
            "time_of_passage_risk": [],
            "blocking_reasons": ["Terrain elevation service unreachable along candidate corridor"],
            "generated_at": now_iso,
        }

    blocking_reasons: List[str] = []
    for (p_lat, p_lon), elev in zip(probe_points, elevations):
        if elev is not None and elev >= 0.0:
            blocking_reasons.append(
                f"Candidate corridor at ({p_lat:.4f}, {p_lon:.4f}) intersects land (elevation {elev:.1f} m)"
            )

    if blocking_reasons:
        return {
            "route_id": route_id,
            "analysis_id": analysis_id,
            "status": "no_safe_route",
            "error": None,
            "origin": origin_loc,
            "destination": dest_loc,
            "vessel_type": vessel_type,
            "waypoints": [],
            "total_distance_km": None,
            "estimated_duration_hours": None,
            "max_risk_score": None,
            "max_risk_level": None,
            "time_of_passage_risk": [],
            "blocking_reasons": blocking_reasons,
            "generated_at": now_iso,
        }


    # 4. Score waypoints from real Open-Meteo forecasts with baseline.score_point
    waypoints: List[Dict[str, Any]] = []
    time_of_passage: List[Dict[str, Any]] = []
    cum_dist = 0.0
    prev_pt = raw_points[0]
    scores: List[int] = []

    for seq, (w_lat, w_lon) in enumerate(raw_points):
        if seq > 0:
            cum_dist += _haversine(prev_pt[0], prev_pt[1], w_lat, w_lon)
            prev_pt = (w_lat, w_lon)

        elapsed_h = cum_dist / speed_kmh
        passage_time = dep_dt + timedelta(hours=elapsed_h)
        passage_iso = passage_time.isoformat().replace("+00:00", "Z")
        time_window = f"{passage_iso}/{passage_iso}"

        # Fetch real Open-Meteo weather and marine forecast for waypoint at passage time
        try:
            w_meas = open_meteo.weather(w_lat, w_lon, time_window)
            o_meas = open_meteo.ocean(w_lat, w_lon, time_window)
            combined = {**w_meas, **o_meas}
            scored_pt = baseline.score_point(combined, vessel_type)
            raw_score = scored_pt.get("score")
            pt_risk = int(round(raw_score)) if raw_score is not None else None
        except Exception as exc:
            log.warning("[router] Failed to score waypoint %d at (%.4f, %.4f): %s", seq, w_lat, w_lon, exc)
            pt_risk = None

        if pt_risk is not None:
            scores.append(pt_risk)

        waypoints.append({
            "seq": seq,
            "lat": w_lat,
            "lon": w_lon,
            "point_id": f"W{seq:04d}",
            "cumulative_distance_km": round(cum_dist, 2),
            "risk_score": pt_risk,
        })

        time_of_passage.append({
            "waypoint_seq": seq,
            "valid_time": passage_iso,
            "risk_score": pt_risk,
        })

    max_score = max(scores) if scores else None
    max_level = baseline.level_for_score(max_score) if max_score is not None else None
    duration_hours = round(cum_dist / speed_kmh, 2)

    return {
        "route_id": route_id,
        "analysis_id": analysis_id,
        "status": "completed",
        "error": None,
        "origin": origin_loc,
        "destination": dest_loc,
        "vessel_type": vessel_type,
        "waypoints": waypoints,
        "total_distance_km": round(cum_dist, 2),
        "estimated_duration_hours": duration_hours,
        "max_risk_score": max_score,
        "max_risk_level": max_level,
        "time_of_passage_risk": time_of_passage,
        "blocking_reasons": [],
        "generated_at": now_iso,
    }
