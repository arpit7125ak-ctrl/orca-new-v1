"""
app/decision/decision_agent.py

Sections 57-64 - the Decision Agent. Turns per-point risk into one answer a
fisherman can act on.

WHAT IS RULE-BASED AND WHAT IS LLM:
    Rules (deterministic)  : point exclusion via GIS hard constraints,
                             preferred/worst point selection, best-time windows
    LLM (Gemini)           : the natural-language advisory text only

Section 59 is the critical one: a point inside a PROHIBITED zone can NEVER be
recommended, no matter how low its risk score is. That exclusion happens in
Python before the LLM is asked to write anything, so the model is never in a
position to recommend a place the law forbids.

Section 60: if every point is excluded or dangerous, the honest answer is
"do not venture" with preferred_point = null. We never fall back to presenting
the least-bad option as though it were acceptable.

CONTRACT SHAPE (contracts/Decision.json) - two fields that are easy to get wrong:
    key_findings    : a STRUCTURED OBJECT with named fields, not a string array
    preferred_point : a point_id STRING, not the point object
"""

import re
from typing import Any, Dict, List, Optional

from app.clients import gemini_client
from app.decision.fallback_strings import get_fallback_one_line, get_fallback_detailed
from app.observability.logger import log


# contracts/Decision.json recommendation_type enum - exact values.
RECOMMENDATION_TYPES = [
    "go", "go_with_caution", "go_in_safer_window", "not_recommended", "do_not_venture",
]


def _check_numeric_hallucination(
    text: str,
    merged_points: Dict[str, Dict[str, Any]],
    assessments: List[Dict[str, Any]],
) -> bool:
    """Return True if text mentions numbers with marine units not grounded in measured data."""
    if not text:
        return False

    valid_numbers: List[float] = []
    for _pid, pdata in merged_points.items():
        meas = pdata.get("measurements", {}) or {}
        for m in meas.values():
            if isinstance(m, dict) and isinstance(m.get("value"), (int, float)) and not isinstance(m.get("value"), bool):
                valid_numbers.append(float(m["value"]))
    for a in assessments:
        for k in ["baseline_score", "final_score"]:
            if a.get(k) is not None:
                valid_numbers.append(float(a[k]))

    if not valid_numbers:
        return False

    metric_pattern = re.compile(
        r'(\d+(?:\.\d+)?)\s*(?:m/s|ms|m\b|meters?|km|knots?|kts?|degc|°c|hpa|ft)',
        re.IGNORECASE,
    )

    matches = metric_pattern.findall(text)
    for num_str in matches:
        try:
            val = float(num_str)
        except ValueError:
            continue
        if val <= 2.0:
            continue
        matched = any(abs(val - vn) <= max(1.0, 0.25 * vn) for vn in valid_numbers)
        if not matched:
            log.warning("[decision] Numeric hallucination detected: '%s' not supported by telemetry", num_str)
            return True

    return False

# Ordering for "which level is worse" comparisons. UPPERCASE throughout.
_LEVEL_RANK = {"SAFE": 0, "CAUTION": 1, "UNSAFE": 2, "DANGEROUS": 3}

_DECISION_SYSTEM_PROMPT = """You are the Decision writer for ORCA, a marine safety advisory system used by Indian fishermen and coastal operators.

The safety analysis is ALREADY COMPLETE. Scores, the recommended point, excluded points and time windows have all been decided by deterministic rules. You are NOT re-deciding any of that.

Your only job is to write the advisory text a fisherman will read:
1. one_line_recommendation - a single sentence they could act on immediately
2. detailed_recommendation - 2-4 sentences explaining what to expect and what to watch for

How to write it:
- Plain, direct language. Assume the reader is deciding whether to take a small boat out today.
- Reference concrete conditions (wave height, wind) rather than abstract risk talk.
- If data was missing, say so plainly. Never imply certainty you do not have.
- If a point was excluded because of a restricted zone or boundary, say that clearly - it matters legally, not just for safety.
- Never contradict the recommendation_type you are given.
- Never invent a number that is not in the evidence.

Respond with JSON only."""

_DECISION_RESPONSE_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "properties": {
        "one_line_recommendation": {"type": "string"},
        "detailed_recommendation": {"type": "string"},
        "major_hazard": {"type": "string"},
        "main_uncertainty": {"type": "string"},
    },
    "required": ["one_line_recommendation", "detailed_recommendation"],
}


def _is_prohibited(point_id: str, merged: Dict[str, Dict[str, Any]]) -> bool:
    """Section 65.1 - is this point inside a GIS-prohibited zone?

    Only a real `available` reading counts. If the GIS agent failed, we do NOT
    treat that as "not prohibited" - absence of evidence is handled separately
    by the caller, which downgrades confidence rather than assuming the point
    is legal.
    """
    m = (merged.get(point_id, {}).get("measurements", {}) or {}).get("inside_prohibited_zone")
    return (
        isinstance(m, dict)
        and m.get("status") in ("available", "derived")
        and bool(m.get("value")) is True
    )


def _classify(
    preferred: Optional[Dict[str, Any]], has_safer_window: bool, all_excluded: bool
) -> str:
    """Pick the recommendation_type from the facts, before any LLM involvement."""
    if all_excluded or preferred is None:
        return "do_not_venture"

    level = preferred.get("risk_level")

    if level == "SAFE":
        return "go"
    if level == "CAUTION":
        return "go_with_caution"
    if level == "UNSAFE":
        # An unsafe point now might still have a genuinely safer window later.
        return "go_in_safer_window" if has_safer_window else "not_recommended"
    return "do_not_venture"  # DANGEROUS


def _best_time_windows(
    assessments: List[Dict[str, Any]], preferred_point_id: Optional[str]
) -> List[Dict[str, Any]]:
    """Section 63 - contiguous runs of hours that are better than the overall score.

    Calculated from the hourly series, not asked of the LLM. An empty list is a
    legitimate and important answer: "there is no safer window today."
    """
    if not preferred_point_id:
        return []

    assessment = next(
        (a for a in assessments if a["point_id"] == preferred_point_id), None
    )
    if not assessment:
        return []

    hourly = [h for h in assessment.get("hourly_scores", []) if h.get("score") is not None]
    if len(hourly) < 2:
        return []

    from app.risk.baseline import level_for_score

    # A window is "better" if it is at least one full level below the point's
    # final score - a 2-point improvement is noise, not a recommendation.
    final_score = assessment["final_score"]
    threshold = min(final_score - 1, _level_ceiling(final_score))

    windows: List[Dict[str, Any]] = []
    run: List[Dict[str, Any]] = []

    for entry in hourly:
        if entry["score"] <= threshold:
            run.append(entry)
        else:
            if len(run) >= 2:
                windows.append(_window_from_run(run, preferred_point_id, level_for_score))
            run = []

    if len(run) >= 2:
        windows.append(_window_from_run(run, preferred_point_id, level_for_score))

    return windows[:3]


def _level_ceiling(score: int) -> int:
    """The top of the next level DOWN from this score."""
    if score > 84:
        return 84
    if score > 64:
        return 64
    if score > 34:
        return 34
    return 0


def _window_from_run(run, point_id, level_for_score) -> Dict[str, Any]:
    max_score = max(h["score"] for h in run)
    return {
        "start": run[0]["time"],
        "end": run[-1]["time"],
        "max_score": int(max_score),
        "level": level_for_score(max_score),
        "applies_to_point": point_id,
    }


async def build_decision(
    *,
    analysis_id: str,
    assessments: List[Dict[str, Any]],
    merged_points: Dict[str, Dict[str, Any]],
    points: List[Dict[str, Any]],
    response_language: str,
    activity: Optional[str],
    vessel_type: Optional[str],
    agents_missing: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Produce one contract-shaped Decision."""

    # --- Exclusions come FIRST (Section 59) -----------------------------
    # Before any ranking, remove points that may not be recommended at all.
    excluded: List[Dict[str, str]] = []
    eligible: List[Dict[str, Any]] = []

    for point in points:
        pid = point["point_id"]

        if point.get("point_status") == "not_applicable":
            excluded.append({"point_id": pid, "reason": "not_applicable"})
            continue

        if _is_prohibited(pid, merged_points):
            # Legally prohibited. Excluded regardless of its risk score.
            excluded.append({"point_id": pid, "reason": "gis_prohibited"})
            continue

        assessment = next((a for a in assessments if a["point_id"] == pid), None)
        if assessment is None:
            excluded.append({"point_id": pid, "reason": "not_applicable"})
            continue

        if assessment["risk_level"] == "DANGEROUS":
            excluded.append({"point_id": pid, "reason": "dangerous"})
            continue

        eligible.append(assessment)

    # --- Rank what remains ----------------------------------------------
    preferred = min(eligible, key=lambda a: a["final_score"]) if eligible else None

    scored = [a for a in assessments if a.get("final_score") is not None]
    worst = max(scored, key=lambda a: a["final_score"]) if scored else None

    best_windows = _best_time_windows(assessments, preferred["point_id"] if preferred else None)

    recommendation_type = _classify(
        preferred, has_safer_window=bool(best_windows), all_excluded=not eligible
    )

    # --- Advisory text (the only LLM part) ------------------------------
    llm = await gemini_client.generate_json(
        system_prompt=_DECISION_SYSTEM_PROMPT,
        user_prompt=_build_decision_prompt(
            preferred=preferred, worst=worst, excluded=excluded,
            best_windows=best_windows, recommendation_type=recommendation_type,
            merged_points=merged_points, agents_missing=agents_missing,
            activity=activity, vessel_type=vessel_type,
            response_language=response_language,
        ),
        response_schema=_DECISION_RESPONSE_SCHEMA,
        purpose="decision",
    )

    if llm.available and llm.data:
        raw_one = llm.data.get("one_line_recommendation")
        raw_det = llm.data.get("detailed_recommendation")

        has_hallucination = _check_numeric_hallucination(
            f"{raw_one or ''} {raw_det or ''}",
            merged_points,
            assessments,
        )

        if has_hallucination:
            log.warning("[decision] Discarding LLM narrative due to ungrounded numeric metrics - using audited deterministic advisory")
            one_line = get_fallback_one_line(recommendation_type, preferred, language=response_language)
            detailed = get_fallback_detailed(
                recommendation_type, preferred, excluded, agents_missing, merged_points,
                language=response_language,
            )
        else:
            one_line = raw_one or get_fallback_one_line(recommendation_type, preferred, language=response_language)
            detailed = raw_det or get_fallback_detailed(
                recommendation_type, preferred, excluded, agents_missing, merged_points,
                language=response_language,
            )
        major_hazard = llm.data.get("major_hazard")
        main_uncertainty = llm.data.get("main_uncertainty")
    else:
        log.info("[decision] LLM unavailable (%s) - deterministic advisory", llm.reason)
        one_line = get_fallback_one_line(recommendation_type, preferred, language=response_language)
        detailed = get_fallback_detailed(
            recommendation_type, preferred, excluded, agents_missing, merged_points,
            language=response_language,
        )
        major_hazard = None
        main_uncertainty = None

    extra_findings = list((preferred or worst or {}).get("key_findings", [])[:2])
    if preferred:
        pref_meas = merged_points.get(preferred["point_id"], {}).get("measurements", {}) or {}
        b_name = (pref_meas.get("nearest_boundary_name") or {}).get("value")
        b_dist = (pref_meas.get("distance_to_boundary_km") or {}).get("value")
        if b_name and b_dist is not None:
            extra_findings.append(f"Nearest boundary: {b_name} ({b_dist} km)")

    # Section 58 - key_findings is a STRUCTURED OBJECT, not a string array.
    key_findings: Dict[str, Any] = {
        "safest_allowed_point": preferred["point_id"] if preferred else None,
        "highest_risk_point": worst["point_id"] if worst else None,
        "major_hazard": major_hazard or _derive_major_hazard(preferred or worst),
        "official_warning_status": _official_warning_status(assessments),
        "gis_restriction": _derive_gis_restriction(excluded, merged_points),
        "pfz_opportunity": _derive_pfz_opportunity(preferred, merged_points),
        "best_time": best_windows[0]["start"] if best_windows else None,
        "main_uncertainty": main_uncertainty or _derive_uncertainty(assessments, agents_missing),
        "additional_findings": extra_findings,
    }

    return {
        "analysis_id": analysis_id,
        "response_language": response_language,
        "generated_at": _now_iso(),
        "recommendation_type": recommendation_type,
        "one_line_recommendation": one_line,
        "detailed_recommendation": detailed,
        "key_findings": key_findings,
        # point_id STRINGS, not objects.
        "preferred_point": preferred["point_id"] if preferred else None,
        "preferred_point_reason": (
            f"Lowest risk score ({preferred['final_score']}) among points that are not excluded"
            if preferred else None
        ),
        "worst_point": worst["point_id"] if worst else None,
        "worst_point_causes": (worst.get("risk_factors") or []) if worst else [],
        "excluded_points": excluded,
        "best_time_windows": best_windows,
        # Copied verbatim from Risk - never recomputed, so the decision stays
        # explainable even if risk is later re-run.
        "point_scores": assessments,
    }


def _now_iso() -> str:
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _official_warning_status(assessments: List[Dict[str, Any]]) -> Optional[str]:
    for a in assessments:
        if a.get("official_warnings"):
            w = a["official_warnings"][0]
            authority = w.get("issuing_authority") or w.get("source") or "IMD"
            bulletin = w.get("bulletin_id")
            level = w.get("floor_level") or "DANGEROUS"
            if bulletin:
                return f"ACTIVE - {authority} {level} Warning (Bulletin: {bulletin})"
            return f"Active {level} warning from {authority}"
    return None


def _derive_major_hazard(assessment: Optional[Dict[str, Any]]) -> Optional[str]:
    if not assessment:
        return None
    factors = assessment.get("risk_factors") or []
    return factors[0].replace("_", " ") if factors else None


def _derive_uncertainty(
    assessments: List[Dict[str, Any]], agents_missing: List[Dict[str, Any]]
) -> Optional[str]:
    if agents_missing:
        return f"{agents_missing[0]['agent']} data was unavailable and was not estimated"

    for a in assessments:
        dq = a.get("data_quality") or {}
        if dq.get("missing_parameters"):
            return f"{dq['missing_parameters'][0]} was unavailable and was not estimated"

    return None


def _fallback_one_line(recommendation_type: str, preferred: Optional[Dict[str, Any]]) -> str:
    """Deterministic advisory text. Blunt on purpose - this is the version a
    user sees when the LLM is down, and it must still be actionable."""
    if recommendation_type == "do_not_venture":
        return "Do not venture out - conditions are dangerous or no permitted area is available."
    if recommendation_type == "not_recommended":
        return "Going out is not recommended in the current conditions."
    if recommendation_type == "go_in_safer_window":
        return "Conditions are marginal now - wait for the safer window before going out."
    if recommendation_type == "go_with_caution":
        score = preferred["final_score"] if preferred else "?"
        return f"Conditions are manageable with caution (risk score {score}). Stay alert and return early."
    return "Conditions are favourable for going out."


def _derive_gis_restriction(
    excluded: List[Dict[str, str]], merged_points: Dict[str, Dict[str, Any]]
) -> Optional[str]:
    prohibited_items = [e for e in excluded if e["reason"] == "gis_prohibited"]
    if not prohibited_items:
        return None
    names = []
    for e in prohibited_items:
        pid = e["point_id"]
        meas = merged_points.get(pid, {}).get("measurements", {}) or {}
        z_name = (meas.get("zone_name") or {}).get("value")
        z_cat = (meas.get("zone_category") or {}).get("value")
        if z_name:
            cat_desc = f" ({z_cat})" if z_cat else ""
            names.append(f"{pid} inside {z_name}{cat_desc}")
        else:
            names.append(pid)
    return f"Excluded: {', '.join(names)}"


def _derive_pfz_opportunity(
    preferred: Optional[Dict[str, Any]],
    merged_points: Dict[str, Dict[str, Any]],
) -> Optional[str]:
    if not preferred:
        return None
    pid = preferred.get("point_id")
    meas = merged_points.get(pid, {}).get("measurements", {}) or {}

    pfz_score_obj = meas.get("pfz_suitability_score")
    if not pfz_score_obj or pfz_score_obj.get("value") is None:
        return None

    score = pfz_score_obj.get("value")
    dist_obj = meas.get("distance_to_pfz_km")
    dist = dist_obj.get("value") if dist_obj else None

    species_obj = meas.get("target_species")
    species = species_obj.get("value") if species_obj else None

    if score >= 0.70:
        desc = f"High fish aggregation (score {score})"
        if dist is not None:
            desc += f" located {dist} km away"
        if species and species != "No concentrated pelagic aggregation":
            desc += f" (Target species: {species})"
        return desc
    elif score >= 0.35:
        desc = f"Moderate fish aggregation (score {score})"
        if dist is not None:
            desc += f" located {dist} km away"
        if species and species != "No concentrated pelagic aggregation":
            desc += f" (Target species: {species})"
        return desc
    elif dist is not None:
        return f"Nearest PFZ zone is {dist} km away (suitability score {score})"
    return None


def _fallback_detailed(
    recommendation_type: str,
    preferred: Optional[Dict[str, Any]],
    worst: Optional[Dict[str, Any]],
    excluded: List[Dict[str, str]],
    agents_missing: List[Dict[str, Any]],
    merged_points: Optional[Dict[str, Dict[str, Any]]] = None,
) -> str:
    parts: List[str] = []

    if preferred:
        parts.append(
            f"The safest analysed point is {preferred['point_id']} "
            f"(risk {preferred['final_score']}, {preferred['risk_level']})."
        )
        if preferred.get("reasoning"):
            parts.append(preferred["reasoning"])
    else:
        parts.append("No analysed point was both permitted and safe enough to recommend.")

    prohibited_items = [e for e in excluded if e["reason"] == "gis_prohibited"]
    if prohibited_items:
        details = []
        for e in prohibited_items:
            pid = e["point_id"]
            z = (merged_points.get(pid, {}).get("measurements", {}).get("zone_name") or {}).get("value") if merged_points else None
            details.append(f"{pid} ({z})" if z else pid)
        parts.append(
            f"The following point(s) were excluded because they fall inside protected/restricted zones: {', '.join(details)}."
        )

    if agents_missing:
        names = ", ".join(a["agent"] for a in agents_missing)
        parts.append(f"Data from {names} could not be retrieved and has NOT been estimated.")

    return " ".join(parts)


def _build_decision_prompt(**kw) -> str:
    """Give the LLM the decided facts and ask only for prose."""
    preferred = kw["preferred"]
    worst = kw["worst"]

    lines = [
        f"Recommendation type (already decided, do not change): {kw['recommendation_type']}",
        f"Activity: {kw['activity'] or 'not specified'}",
        f"Vessel: {kw['vessel_type'] or 'not specified'}",
        "",
    ]

    if preferred:
        pref_pid = preferred["point_id"]
        lines.append(
            f"Recommended point {preferred['point_id']}: risk {preferred['final_score']}/100 "
            f"({preferred['risk_level']})"
        )
        pref_meas = kw["merged_points"].get(pref_pid, {}).get("measurements", {}) or {}
        pref_zone = (pref_meas.get("zone_name") or {}).get("value")
        pref_dist = (pref_meas.get("distance_to_boundary_km") or {}).get("value")
        pref_depth = (pref_meas.get("water_depth_m") or {}).get("value")
        if pref_zone:
            lines.append(f"  geography: {pref_zone} (depth: {pref_depth}m, distance to boundary: {pref_dist}km)")
        if preferred.get("reasoning"):
            lines.append(f"  evidence: {preferred['reasoning']}")
        for f in (preferred.get("key_findings") or [])[:4]:
            lines.append(f"  - {f}")
        pfz_opp = _derive_pfz_opportunity(preferred, kw["merged_points"])
        if pfz_opp:
            lines.append(f"  fishing opportunity: {pfz_opp}")
    else:
        lines.append("NO point could be recommended - all were excluded or too dangerous.")

    if worst and (not preferred or worst["point_id"] != preferred["point_id"]):
        lines.append(
            f"Worst point {worst['point_id']}: risk {worst['final_score']}/100 ({worst['risk_level']})"
        )

    prohibited_details = []
    for e in kw["excluded"]:
        if e["reason"] == "gis_prohibited":
            pid = e["point_id"]
            meas = kw["merged_points"].get(pid, {}).get("measurements", {}) or {}
            z_name = (meas.get("zone_name") or {}).get("value")
            z_cat = (meas.get("zone_category") or {}).get("value")
            if z_name:
                prohibited_details.append(f"{pid} (inside {z_name} - {z_cat or 'restricted'})")
            else:
                prohibited_details.append(pid)
    if prohibited_details:
        lines.append(f"Excluded as inside a prohibited/restricted zone: {', '.join(prohibited_details)}")

    if kw["best_windows"]:
        w = kw["best_windows"][0]
        lines.append(f"Safer window available: {w['start']} to {w['end']} (level {w['level']})")
    else:
        lines.append("No safer time window was found within the requested period.")

    if kw["agents_missing"]:
        lines.append(
            "Unavailable data sources (state this plainly, do not estimate): "
            + ", ".join(a["agent"] for a in kw["agents_missing"])
        )

    lines.append("")
    lines.append(f"Write the advisory in this language code: {kw['response_language']}")

    return "\n".join(lines)
