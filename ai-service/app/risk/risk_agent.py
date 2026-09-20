"""
app/risk/risk_agent.py

Sections 46-56 - the Risk Agent. This is the safety heart of ORCA.

THE FOUR-STAGE PIPELINE, in this exact order (Section 47.2):

    1. Deterministic baseline        (Section 48)  - pure arithmetic
    2. Official warning override     (Section 49)  - IMD/INCOIS forces a floor
    3. Hard safety rules             (Section 50)  - absolute limits force a floor
    4. Bounded LLM interpretation    (Section 51)  - explanation + tiny nudge

Order is the whole point. The floors are computed BEFORE the LLM ever sees the
data, and the final formula (Section 51.3) makes it arithmetically impossible
for the model to talk the score below them:

    constraint_floor = max(official_warning_floor, hard_rule_floor)
    proposed         = baseline + llm_adjustment      # |adjustment| <= 10
    final_score      = clamp(max(proposed, constraint_floor), 0, 100)

So the LLM can raise a score, can explain a score, and can nudge it slightly -
but can never make dangerous conditions look safe. That property is what makes
an LLM acceptable anywhere near this decision at all.

Section 56: every LLM output is schema-validated. On any failure we fall back
to the deterministic baseline and set llm_interpretation_unavailable=true
rather than inventing a narrative.
"""

from typing import Any, Dict, List, Optional

from app.clients import gemini_client
from app.config.settings import settings
from app.observability.logger import log
from app.risk import baseline as baseline_mod

# Section 50 - hard safety rules. Absolute limits that force a minimum score
# regardless of how the weighted baseline came out. Each entry is
# (parameter, comparison, threshold, forced_minimum_score, human reason).
# Each entry: (rule_id, parameter, comparison, threshold, floor_score, description)
# rule_id is contract-required and must be stable - it is what an audit refers
# back to when asking why a score was forced.
HARD_RULES = [
    ("HR_WAVE_3M",      "wave_height_m",   ">=", 3.0,  85, "Significant wave height at or above 3 m is dangerous for any small craft"),
    ("HR_WIND_17MS",    "wind_speed_ms",   ">=", 17.0, 85, "Sustained wind at or above 17 m/s (gale force) is dangerous"),
    ("HR_GUST_22MS",    "wind_gust_ms",    ">=", 22.0, 85, "Gusts at or above 22 m/s are dangerous"),
    ("HR_VIS_1KM",      "visibility_km",   "<=", 1.0,  70, "Visibility at or below 1 km makes safe navigation impossible"),
    ("HR_CURRENT_2MS",  "current_speed_ms", ">=", 2.0, 70, "Current at or above 2 m/s exceeds safe handling for small craft"),
]

# Section 49 - an active official warning forces at least this score. Official
# sources outrank our own model entirely; if IMD says there is a cyclone
# warning, no computed baseline is allowed to contradict it.
OFFICIAL_WARNING_FLOOR = 85

_RISK_SYSTEM_PROMPT = """You are the Risk interpretation layer for ORCA, a marine safety advisory system for Indian fishermen.

A deterministic engine has ALREADY calculated a safety score from measured data. Your job is NOT to re-score it. Your job is to:
1. Explain, in plain language, what the evidence means for this specific vessel and activity
2. Identify the key findings a fisherman actually needs to know
3. Optionally suggest a SMALL adjustment to the score

Hard rules you must obey:
- You may adjust the score by at most +/-10 points. Larger suggestions will be clamped.
- Any adjustment MUST cite specific measured values from the evidence given to you.
- You may RAISE a score freely. You must NOT lower a score across a level boundary (e.g. from CAUTION into SAFE).
- If a constraint floor is present, it exists because of an official warning or a hard safety limit. Never argue against it.
- Reason ONLY from the evidence provided. If a parameter is missing, say it is missing - never estimate or assume a value.
- Write for someone deciding whether to take a small boat to sea. Be direct and concrete, not hedged.

Respond with JSON only."""

_RISK_RESPONSE_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "properties": {
        "reasoning": {"type": "string"},
        "key_findings": {"type": "array", "items": {"type": "string"}},
        "llm_adjustment": {"type": "integer"},
        "adjustment_reason": {"type": "string"},
        "confidence": {"type": "number"},
    },
    "required": ["reasoning", "key_findings", "llm_adjustment", "confidence"],
}

_RISK_BATCH_SYSTEM_PROMPT = """You are the Risk interpretation layer for ORCA, a marine safety advisory system for Indian fishermen.

A deterministic engine has ALREADY calculated safety scores from measured data for multiple marine grid points. Your job is NOT to re-score them. Your job is to:
1. Explain, in plain language, what the evidence means for this specific vessel and activity at each point.
2. Identify the key findings a fisherman actually needs to know for each point.
3. Compare conditions across points if relevant.
4. Optionally suggest a SMALL adjustment to each score (-10 to +10).

Hard rules you must obey:
- You may adjust any score by at most +/-10 points. Larger suggestions will be clamped.
- Any adjustment MUST cite specific measured values from the evidence given to you.
- You may RAISE a score freely. You must NOT lower a score across a level boundary (e.g. from CAUTION into SAFE).
- If a constraint floor is present, it exists because of an official warning or a hard safety limit. Never argue against it.
- Reason ONLY from the evidence provided. If a parameter is missing, say it is missing - never estimate or assume a value.
- Write for someone deciding whether to take a small boat to sea. Be direct and concrete, not hedged.

Respond with JSON only containing an "assessments" array with an object for every point_id."""

_RISK_BATCH_RESPONSE_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "properties": {
        "assessments": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "point_id": {"type": "string"},
                    "reasoning": {"type": "string"},
                    "key_findings": {"type": "array", "items": {"type": "string"}},
                    "llm_adjustment": {"type": "integer"},
                    "adjustment_reason": {"type": "string"},
                    "confidence": {"type": "number"},
                },
                "required": ["point_id", "reasoning", "key_findings", "llm_adjustment", "confidence"],
            },
        }
    },
    "required": ["assessments"],
}


def _check_hard_rules(measurements: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Section 50 - which absolute limits are breached at this point."""
    applied = []

    for rule_id, parameter, op, threshold, floor_score, description in HARD_RULES:
        m = measurements.get(parameter)
        if not isinstance(m, dict) or m.get("status") not in ("available", "derived"):
            continue

        value = m.get("value")
        if value is None or isinstance(value, bool):
            continue

        breached = (value >= threshold) if op == ">=" else (value <= threshold)
        if breached:
            # contracts/RiskAssessment.json permits ONLY these three keys
            # (additionalProperties: false). The observed value goes into the
            # description so it is still visible for explainability.
            applied.append({
                "rule_id": rule_id,
                "description": f"{description} (observed {parameter}={value})",
                "floor_score": floor_score,
            })

    return applied


def _check_official_warnings(measurements: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Section 49 - active official warnings from an authoritative source.

    Only a measurement flagged `official_source: true` can trigger this. Our
    own derived data can never masquerade as an official warning.
    """
    warnings = []
    m = measurements.get("official_warning_active")

    # official_source must be a populated OBJECT, not merely truthy - that
    # object is what proves the warning came from an authority rather than
    # from our own derived data.
    official = m.get("official_source") if isinstance(m, dict) else None

    if (
        isinstance(m, dict)
        and isinstance(official, dict)
        and m.get("status") in ("available", "derived")
        and bool(m.get("value")) is True
    ):
        # contracts/RiskAssessment.json permits ONLY these five keys.
        warnings.append({
            "warning_type": "marine_warning",
            "floor_score": OFFICIAL_WARNING_FLOOR,
            "floor_level": official.get("warning_level") or "DANGEROUS",
            "issuing_authority": official.get("issuing_authority") or m.get("source") or "unknown",
            "bulletin_id": official.get("bulletin_id") or "unknown",
        })

    return warnings


def _compute_confidence(
    *, scoreable_count: int, agents_missing: List[Dict[str, Any]], llm_available: bool
) -> float:
    """Section 55 - how much to trust this assessment.

    Driven by how much evidence actually existed, not by how confident the
    narrative sounds. Missing agents and thin parameter coverage both reduce it.
    """
    confidence = 0.9

    confidence -= 0.12 * len(agents_missing)

    if scoreable_count <= 1:
        confidence -= 0.30
    elif scoreable_count <= 3:
        confidence -= 0.15

    if not llm_available:
        # A deterministic-only assessment is still valid, just less nuanced.
        confidence -= 0.05

    return max(0.15, min(0.95, round(confidence, 2)))


def _clamp_adjustment(
    raw_adjustment: Any, baseline_score: int, constraint_floor: Optional[int]
) -> int:
    """Section 51.2 - enforce every limit on the LLM's suggested nudge.

    Three guards, applied in order:
      1. band      - |adjustment| <= LLM_ADJUSTMENT_BAND
      2. floor     - the result may never drop below the constraint floor
      3. boundary  - may not lower the score across a level boundary downward
    """
    try:
        adjustment = int(raw_adjustment)
    except (TypeError, ValueError):
        return 0

    band = settings.LLM_ADJUSTMENT_BAND
    adjustment = max(-band, min(band, adjustment))

    # The LLM cannot lower the score below the constraint floor
    if constraint_floor is not None and (baseline_score + adjustment) < constraint_floor:
        if baseline_score >= constraint_floor:
            adjustment = constraint_floor - baseline_score
        else:
            adjustment = max(0, adjustment)

    adjustment = max(-band, min(band, adjustment))

    # Downward moves may not cross a level boundary (CAUTION must not become
    # SAFE by LLM opinion alone). Upward moves are unrestricted.
    if adjustment < 0:
        baseline_level = baseline_mod.level_for_score(baseline_score)
        proposed_level = baseline_mod.level_for_score(baseline_score + adjustment)
        if proposed_level != baseline_level:
            log.info(
                "[risk] blocked LLM adjustment %+d: would drop %s -> %s",
                adjustment, baseline_level, proposed_level,
            )
            adjustment = 0

    return adjustment


def _build_batch_risk_prompt(
    *,
    items: List[Dict[str, Any]],
    vessel_type: Optional[str],
    activity: Optional[str],
    agents_missing: List[Dict[str, Any]],
    response_language: str,
) -> str:
    """Assemble a single batched evidence package for the Risk LLM across all grid points."""
    lines = [
        f"Vessel type: {vessel_type or 'not specified'}",
        f"Activity: {activity or 'not specified'}",
        f"Total points to evaluate: {len(items)}",
        f"Write all reasoning and findings in language code: {response_language}",
        "",
    ]
    if agents_missing:
        lines.append("Data sources that failed entirely for this analysis:")
        for a in agents_missing:
            lines.append(f"  - {a['agent']}: {a.get('error_category') or a.get('status')}")
        lines.append("")

    lines.append("POINTS EVIDENCE MATRIX:")
    for it in items:
        pid = it["point_id"]
        lines.append(f"--- Point {pid} ---")
        lines.append(f"Deterministic baseline score: {it['baseline_score']}/100")
        if it["constraint_floor"] is not None:
            lines.append(f"CONSTRAINT FLOOR: {it['constraint_floor']}. Final score cannot drop below this.")
        for w in it["official_warnings"]:
            lines.append(f"OFFICIAL WARNING: from {w['issuing_authority']} (bulletin {w['bulletin_id']}, level {w['floor_level']})")
        for r in it["hard_rules_applied"]:
            lines.append(f"HARD RULE BREACHED [{r['rule_id']}]: {r['description']}")

        lines.append("Measured evidence:")
        any_avail = False
        for parameter, m in sorted(it["measurements"].items()):
            if not isinstance(m, dict):
                continue
            if m.get("status") in ("available", "derived"):
                any_avail = True
                src = m.get("source") or "unknown"
                lines.append(f"  - {parameter} = {m.get('value')} {m.get('unit') or ''} (source: {src})")
            else:
                lines.append(f"  - {parameter}: NOT AVAILABLE (status: {m.get('status')})")
        if not any_avail:
            lines.append("  (no usable measurements at this point)")
        lines.append("")

    lines.append("Return JSON containing the assessments array for all points.")
    return "\n".join(lines)


async def assess_points(
    *,
    points: List[Dict[str, Any]],
    merged_points: Dict[str, Any],
    agents_missing: List[Dict[str, Any]],
    vessel_type: Optional[str],
    activity: Optional[str],
    response_language: str,
    hourly_measurements_by_point: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    """Produce contract-shaped RiskAssessments for all points in ONE single batched LLM call.

    Section 51 & NEVER-FABRICATE:
    1. Deterministic baselines and safety constraint floors are computed in Python for each point.
    2. A single batched prompt is sent to Gemini to interpret all points simultaneously.
    3. If LLM is unavailable or times out, every point falls back gracefully to deterministic logic.
    """
    items: List[Dict[str, Any]] = []

    # --- Stage 1, 2, 3: Deterministic baseline & floors for all points in Python ---
    for p in points:
        point_id = p["point_id"]
        entry = merged_points.get(point_id, {})
        measurements = entry.get("measurements", {})
        hourly = (hourly_measurements_by_point or {}).get(point_id)

        base = baseline_mod.compute_baseline(
            measurements=measurements,
            hourly_measurements=hourly,
            vessel_type=vessel_type,
        )
        baseline_score = base["baseline_score"]
        if baseline_score is None:
            log.warning("[risk] %s: no computable evidence - not scored", point_id)
            continue

        official_warnings = _check_official_warnings(measurements)
        hard_rules_applied = _check_hard_rules(measurements)

        floors = [w["floor_score"] for w in official_warnings]
        floors += [r["floor_score"] for r in hard_rules_applied]
        constraint_floor = max(floors) if floors else None

        items.append({
            "point_id": point_id,
            "base": base,
            "baseline_score": baseline_score,
            "official_warnings": official_warnings,
            "hard_rules_applied": hard_rules_applied,
            "constraint_floor": constraint_floor,
            "measurements": measurements,
        })

    if not items:
        return []

    # --- Stage 4: Single Batched LLM Call across all points (Section 51) ---
    llm_data_by_point: Dict[str, Dict[str, Any]] = {}

    try:
        llm = await gemini_client.generate_json(
            system_prompt=_RISK_BATCH_SYSTEM_PROMPT,
            user_prompt=_build_batch_risk_prompt(
                items=items,
                vessel_type=vessel_type,
                activity=activity,
                agents_missing=agents_missing,
                response_language=response_language,
            ),
            response_schema=_RISK_BATCH_RESPONSE_SCHEMA,
            purpose="risk_batch",
        )

        if llm.available and isinstance(llm.data, dict):
            raw_list = llm.data.get("assessments")
            if isinstance(raw_list, list):
                for it in raw_list:
                    if isinstance(it, dict) and "point_id" in it:
                        llm_data_by_point[it["point_id"]] = it
            else:
                for k, v in llm.data.items():
                    if isinstance(v, dict):
                        llm_data_by_point[k] = v
            log.info(
                "[risk] Batched LLM assessment completed for %d/%d points in 1 call",
                len(llm_data_by_point), len(items),
            )
        else:
            log.info(
                "[risk] Batched LLM unavailable (%s) - using deterministic fallback",
                getattr(llm, "reason", "unknown"),
            )
    except Exception as exc:  # noqa: BLE001
        log.warning("[risk] Batched LLM call exception: %s - using deterministic fallback", exc)

    # --- Assemble final assessments for all points ---
    assessments: List[Dict[str, Any]] = []

    for item in items:
        point_id = item["point_id"]
        baseline_score = item["baseline_score"]
        constraint_floor = item["constraint_floor"]
        base = item["base"]
        measurements = item["measurements"]

        point_llm = llm_data_by_point.get(point_id)
        pt_llm_avail = bool(point_llm)

        if pt_llm_avail:
            llm_adjustment = _clamp_adjustment(
                point_llm.get("llm_adjustment", 0), baseline_score, constraint_floor
            )
            adjustment_reason = point_llm.get("adjustment_reason") if llm_adjustment != 0 else None
            key_findings = [str(k) for k in (point_llm.get("key_findings") or [])][:6]
        else:
            llm_adjustment = 0
            adjustment_reason = None
            key_findings = _fallback_findings(base, measurements, agents_missing)

        proposed = baseline_score + llm_adjustment
        if constraint_floor is not None:
            proposed = max(proposed, constraint_floor)
        final_score = int(max(0, min(100, proposed)))

        if pt_llm_avail and point_llm.get("reasoning"):
            reasoning = point_llm.get("reasoning")
        else:
            reasoning = _fallback_reasoning(
                base,
                measurements,
                final_score=final_score,
                official_warnings=item["official_warnings"],
                hard_rules=item["hard_rules_applied"],
            )

        assessments.append({
            "point_id": point_id,
            "baseline_score": int(baseline_score),
            "llm_adjustment": llm_adjustment if llm_adjustment != 0 else None,
            "adjustment_reason": adjustment_reason,
            "official_warnings": item["official_warnings"],
            "hard_rules_applied": item["hard_rules_applied"],
            "constraint_floor": constraint_floor,
            "final_score": final_score,
            "risk_level": baseline_mod.level_for_score(final_score),
            "risk_factors": base["risk_factors"],
            "reasoning": reasoning,
            "key_findings": key_findings,
            "hourly_scores": base["hourly_scores"],
            "confidence": _compute_confidence(
                scoreable_count=base["scoreable_count"],
                agents_missing=agents_missing,
                llm_available=pt_llm_avail,
            ),
            "data_quality": _data_quality(measurements, agents_missing),
            "llm_interpretation_unavailable": not pt_llm_avail,
        })

    return assessments


async def assess_point(
    *,
    point_id: str,
    measurements: Dict[str, Any],
    hourly_measurements: Optional[List[Dict[str, Any]]],
    agents_missing: List[Dict[str, Any]],
    vessel_type: Optional[str],
    activity: Optional[str],
    response_language: str,
) -> Optional[Dict[str, Any]]:
    """Produce one contract-shaped RiskAssessment (backward-compatible single point caller)."""
    res = await assess_points(
        points=[{"point_id": point_id}],
        merged_points={point_id: {"measurements": measurements}},
        agents_missing=agents_missing,
        vessel_type=vessel_type,
        activity=activity,
        response_language=response_language,
        hourly_measurements_by_point={point_id: hourly_measurements} if hourly_measurements else None,
    )
    return res[0] if res else None


def _build_risk_prompt(**kw) -> str:
    """Assemble the evidence package for the Risk LLM.

    Every number the model is allowed to reason from appears here explicitly,
    with its source. Anything missing is stated as missing - the model is told
    what it does NOT have, so it cannot quietly assume a value.
    """
    lines = [
        f"Point: {kw['point_id']}",
        f"Vessel type: {kw['vessel_type'] or 'not specified'}",
        f"Activity: {kw['activity'] or 'not specified'}",
        f"Deterministic baseline score (already calculated): {kw['baseline_score']}/100",
    ]

    if kw["constraint_floor"] is not None:
        lines.append(
            f"CONSTRAINT FLOOR: {kw['constraint_floor']}. The final score cannot go below this."
        )

    for w in kw["official_warnings"]:
        lines.append(
            f"OFFICIAL WARNING ACTIVE from {w['issuing_authority']} "
            f"(bulletin {w['bulletin_id']}, level {w['floor_level']})"
        )

    for r in kw["hard_rules_applied"]:
        lines.append(f"HARD RULE BREACHED [{r['rule_id']}]: {r['description']}")

    lines.append("")
    lines.append("Measured evidence:")

    any_available = False
    for parameter, m in sorted(kw["measurements"].items()):
        if not isinstance(m, dict):
            continue
        if m.get("status") in ("available", "derived"):
            any_available = True
            src = m.get("source") or "unknown source"
            lines.append(f"  - {parameter} = {m.get('value')} {m.get('unit') or ''} (source: {src})")
        else:
            lines.append(f"  - {parameter}: NOT AVAILABLE (status: {m.get('status')})")

    if not any_available:
        lines.append("  (no usable measurements at this point)")

    if kw["agents_missing"]:
        lines.append("")
        lines.append("Data sources that failed entirely for this analysis:")
        for a in kw["agents_missing"]:
            lines.append(f"  - {a['agent']}: {a.get('error_category') or a.get('status')}")

    lines.append("")
    lines.append(f"Write the reasoning in this language code: {kw['response_language']}")

    return "\n".join(lines)


def _fallback_reasoning(
    base: Dict[str, Any],
    measurements: Dict[str, Any],
    final_score: Optional[int] = None,
    official_warnings: Optional[List[Dict[str, Any]]] = None,
    hard_rules: Optional[List[Dict[str, Any]]] = None,
) -> str:
    """Deterministic explanation when the LLM is unavailable.

    Describes only the actual numbers and binding official warnings/constraints.
    """
    parts = []
    for parameter, score in sorted(base["contributing"].items(), key=lambda kv: -kv[1])[:3]:
        m = measurements.get(parameter, {})
        parts.append(f"{parameter.replace('_', ' ')} at {m.get('value')} {m.get('unit') or ''}".strip())

    local_conds = f"Local conditions: {', '.join(parts)}." if parts else "Local sensor readings unavailable."

    effective_score = final_score if final_score is not None else base["baseline_score"]
    level = baseline_mod.level_for_score(effective_score)

    if official_warnings:
        w = official_warnings[0]
        auth = w.get("issuing_authority") or "Official Disaster Authority"
        bulletin = f" (Bulletin: {w['bulletin_id']})" if w.get("bulletin_id") else ""
        return (
            f"Assessed as {level} (Score {effective_score}) due to active official {w.get('warning_type', 'marine warning')} "
            f"from {auth}{bulletin}. {local_conds} This assessment is deterministic; narrative interpretation was unavailable."
        )

    if hard_rules:
        r = hard_rules[0]
        return (
            f"Assessed as {level} (Score {effective_score}) due to safety constraint '{r.get('rule_id', 'rule')}'. "
            f"{local_conds} This assessment is deterministic; narrative interpretation was unavailable."
        )

    if not parts:
        return "No usable measurements were available to assess this point."

    return (
        f"Assessed as {level} based on {', '.join(parts)}. "
        "This assessment is deterministic; narrative interpretation was unavailable."
    )


def _fallback_findings(
    base: Dict[str, Any], measurements: Dict[str, Any], agents_missing: List[Dict[str, Any]]
) -> List[str]:
    findings = []

    for parameter in base["risk_factors"][:3]:
        m = measurements.get(parameter, {})
        findings.append(f"{parameter.replace('_', ' ')}: {m.get('value')} {m.get('unit') or ''}".strip())

    unavailable = [
        p for p, m in measurements.items()
        if isinstance(m, dict) and m.get("status") in ("missing", "not_mapped")
    ]
    if unavailable:
        findings.append(f"Unavailable and not estimated: {', '.join(sorted(unavailable)[:3])}")

    for a in agents_missing[:2]:
        findings.append(f"{a['agent']} data could not be retrieved")

    return findings or ["Insufficient evidence for detailed findings"]


def _data_quality(
    measurements: Dict[str, Any], agents_missing: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """Per-field data quality (Section 80).

    contracts/shared/DataQuality.json is a MAP of field name ->
    { status, freshness, source_note? } - NOT a summary object with counts.
    Per-field detail is what lets the Frontend show exactly which reading was
    stale or missing, rather than a single opaque completeness number.
    """
    quality: Dict[str, Any] = {}

    for parameter, m in measurements.items():
        if not isinstance(m, dict):
            continue

        source_note = None
        if m.get("status") in ("missing", "not_mapped"):
            source_note = (
                "source queried, no data returned"
                if m["status"] == "missing"
                else "no adapter mapping for this field yet"
            )
        elif m.get("source"):
            note = m["source"]
            if m.get("product_id"):
                note += f" / {m['product_id']}"
            source_note = note

        quality[parameter] = {
            "status": m.get("status", "missing"),
            "freshness": m.get("freshness") or {"state": "unknown"},
            "source_note": source_note,
        }

    # An agent that failed entirely contributes a synthetic entry, so the gap
    # is visible in the same structure rather than being silently absent.
    for a in agents_missing:
        key = f"{a['agent']}_agent"
        if key not in quality:
            quality[key] = {
                "status": "missing",
                "freshness": {"state": "unknown"},
                "source_note": f"agent failed: {a.get('error_category') or a.get('status')}",
            }

    return quality
