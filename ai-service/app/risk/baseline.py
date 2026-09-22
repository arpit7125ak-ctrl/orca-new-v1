"""
app/risk/baseline.py

Section 48 - the Deterministic Safety Baseline.

This runs BEFORE any LLM involvement and produces the score the LLM is only
allowed to nudge. It is pure arithmetic over thresholds: no model, no
randomness, fully reproducible and auditable.

WHY DETERMINISTIC FIRST: a language model must never be the sole author of a
safety verdict. The baseline is what the system can defend in front of a judge
or an inquiry - "this score came from these numbers against these published
thresholds." The LLM adds explanation on top, within a narrow band.

SECTION 48.4.1 LOCKED RULE: baseline_score = max(hourly scores) over hours with
computable data - the WORST hour, not the average. An average would let one
calm hour mask a dangerous one, which is exactly the failure mode this system
exists to prevent. Null when no hour is computable.

VESSEL-AWARE (Section 18): thresholds scale with the vessel's conservatism
rank. A traditional non-motorised craft is endangered by conditions a large
commercial vessel would barely notice.
"""

from typing import Any, Dict, List, Optional, Tuple

from app.config.registry import vessel_conservatism_rank
from app.config.settings import settings

# Section 48.2 - per-parameter thresholds for the MOST conservative vessel
# (rank 1). Each tuple is (safe_max, caution_max, unsafe_max); above the last
# value is DANGEROUS. Values are in canonical units.
_BASE_THRESHOLDS: Dict[str, Tuple[float, float, float]] = {
    "wind_speed_ms":   (5.0,  8.0,  12.0),   # m/s
    "wind_gust_ms":    (7.0, 11.0,  16.0),
    "wave_height_m":   (0.8,  1.5,   2.5),   # m
    "swell_height_m":  (0.7,  1.3,   2.2),
    "current_speed_ms": (0.4, 0.8,   1.5),
    "visibility_km":   (8.0,  4.0,   2.0),   # INVERTED: lower is worse
    "precipitation_mm": (2.0, 6.0,  15.0),
}

# Parameters where a LOWER reading is more dangerous.
_INVERTED = {"visibility_km"}

# How much each parameter contributes to the combined score. Wave and wind
# dominate because they are what actually capsize small craft.
_WEIGHTS: Dict[str, float] = {
    "wave_height_m": 1.0,
    "wind_speed_ms": 0.9,
    "wind_gust_ms": 0.7,
    "swell_height_m": 0.6,
    "current_speed_ms": 0.5,
    "visibility_km": 0.5,
    "precipitation_mm": 0.3,
}


def _vessel_factor(vessel_type: Optional[str]) -> float:
    """Scale thresholds by vessel sturdiness.

    rank 1 (traditional non-motorised) -> 1.0, thresholds unchanged.
    rank 6 (large commercial)          -> 1.75, thresholds 75% higher.
    A missing or unknown vessel_type resolves to rank 1, so an unknown vessel
    is always treated as the most fragile - never the other way round.
    """
    rank = vessel_conservatism_rank(vessel_type)
    return 1.0 + (rank - 1) * 0.15


def score_parameter(
    parameter: str, value: Optional[float], vessel_type: Optional[str]
) -> Optional[float]:
    """Score one parameter 0-100. None when it cannot be scored.

    Returning None (rather than 0) for an unscoreable parameter is the
    never-fabricate rule at the arithmetic level: a missing wave height must
    not read as "0 m, perfectly calm".
    """
    if value is None or parameter not in _BASE_THRESHOLDS:
        return None
    if isinstance(value, bool):  # booleans are flags, not magnitudes
        return None

    safe_max, caution_max, unsafe_max = _BASE_THRESHOLDS[parameter]
    factor = _vessel_factor(vessel_type)

    if parameter in _INVERTED:
        # Lower is worse, so the thresholds tighten rather than loosen for a
        # sturdier vessel: divide instead of multiply.
        safe_max, caution_max, unsafe_max = (
            safe_max / factor, caution_max / factor, unsafe_max / factor,
        )
        if value >= safe_max:
            return _interp(value, safe_max * 2, safe_max, 0, 34)
        if value >= caution_max:
            return _interp(value, safe_max, caution_max, 34, 64)
        if value >= unsafe_max:
            return _interp(value, caution_max, unsafe_max, 64, 84)
        return _interp(value, unsafe_max, 0, 84, 100)

    safe_max, caution_max, unsafe_max = (
        safe_max * factor, caution_max * factor, unsafe_max * factor,
    )
    if value <= safe_max:
        return _interp(value, 0, safe_max, 0, 34)
    if value <= caution_max:
        return _interp(value, safe_max, caution_max, 34, 64)
    if value <= unsafe_max:
        return _interp(value, caution_max, unsafe_max, 64, 84)
    # Beyond the unsafe threshold, saturate toward 100 rather than growing
    # unbounded - a 6 m wave and a 9 m wave are both simply DANGEROUS.
    over = min((value - unsafe_max) / max(unsafe_max, 0.1), 1.0)
    return 84 + over * 16


def _interp(value: float, lo_in: float, hi_in: float, lo_out: float, hi_out: float) -> float:
    """Linear interpolation, clamped to the output band."""
    if hi_in == lo_in:
        return lo_out
    t = (value - lo_in) / (hi_in - lo_in)
    t = max(0.0, min(1.0, t))
    return lo_out + t * (hi_out - lo_out)


def level_for_score(score: Optional[float]) -> Optional[str]:
    """Section 52 - map a 0-100 score to a level.

    UPPERCASE, matching contracts/RiskAssessment.json exactly:
    SAFE | CAUTION | UNSAFE | DANGEROUS.
    """
    if score is None:
        return None
    if score <= settings.RISK_SAFE_MAX:
        return "SAFE"
    if score <= settings.RISK_CAUTION_MAX:
        return "CAUTION"
    if score <= settings.RISK_UNSAFE_MAX:
        return "UNSAFE"
    return "DANGEROUS"


def score_point(
    measurements: Dict[str, Any], vessel_type: Optional[str]
) -> Dict[str, Any]:
    """Combined weighted score for one point at one moment.

    Returns {score, contributing, risk_factors, scoreable_count}. `score` is
    None when NOTHING could be scored - which is different from a score of 0
    and is handled explicitly by the caller.
    """
    contributing: Dict[str, float] = {}
    weighted_sum = 0.0
    weight_total = 0.0

    for parameter, measurement in measurements.items():
        if not isinstance(measurement, dict):
            continue
        # Only usable statuses feed the score. missing / not_mapped contribute
        # nothing at all rather than contributing a zero.
        if measurement.get("status") not in ("available", "derived"):
            continue

        s = score_parameter(parameter, measurement.get("value"), vessel_type)
        if s is None:
            continue

        weight = _WEIGHTS.get(parameter, 0.3)
        contributing[parameter] = round(s, 1)
        weighted_sum += s * weight
        weight_total += weight

    if weight_total == 0:
        return {"score": None, "contributing": {}, "risk_factors": [], "scoreable_count": 0}

    # Spec Section 48.3 Combining Factors:
    # dominant   = max(factor sub-scores)
    # elevated   = number of other factors with sub-score >= 35
    # uplift     = min(3 * elevated, 10)
    # baseline   = min(dominant + uplift, 100)
    sorted_factors = sorted(contributing.items(), key=lambda kv: -kv[1])
    dominant_param, dominant_score = sorted_factors[0]

    elevated = sum(1 for _, s in sorted_factors[1:] if s >= 35)
    uplift = min(3.0 * elevated, 10.0)
    score_base = round(min(100.0, dominant_score + uplift), 1)

    # Section 54 - the parameters actually driving this score, for explanation.
    risk_factors = [p for p, s in sorted_factors if s >= 45]

    return {
        "score": score_base,
        "contributing": contributing,
        "risk_factors": risk_factors[:4],
        "scoreable_count": len(contributing),
    }


def compute_baseline(
    *,
    measurements: Dict[str, Any],
    hourly_measurements: Optional[List[Dict[str, Any]]],
    vessel_type: Optional[str],
) -> Dict[str, Any]:
    """Section 48.4 - the point's baseline score plus its hourly series.

    LOCKED RULE (48.4.1): baseline_score = max(hourly scores) over hours with
    computable data. Worst hour, not average. Null if no hour is computable.

    Falls back to the single-moment score when no hourly data exists, so a
    point is not left unscored just because hourly expansion was unavailable.
    """
    snapshot = score_point(measurements, vessel_type)

    hourly_scores: List[Dict[str, Any]] = []
    computable: List[float] = []

    for hour_entry in (hourly_measurements or []):
        h_score = score_point(hour_entry.get("measurements", {}), vessel_type)
        entry: Dict[str, Any] = {"time": hour_entry.get("time")}
        if h_score["score"] is not None:
            entry["score"] = int(round(h_score["score"]))
            computable.append(h_score["score"])
        else:
            # An hour with no computable data records null, never 0.
            entry["score"] = None
        hourly_scores.append(entry)

    if computable:
        baseline = max(computable)          # <-- the worst hour (48.4.1)
    elif snapshot["score"] is not None:
        baseline = snapshot["score"]
        hourly_scores = hourly_scores or []
    else:
        baseline = None

    return {
        "baseline_score": int(round(baseline)) if baseline is not None else None,
        "hourly_scores": hourly_scores,
        "risk_factors": snapshot["risk_factors"],
        "contributing": snapshot["contributing"],
        "scoreable_count": snapshot["scoreable_count"],
    }
