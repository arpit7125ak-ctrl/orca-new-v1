#!/usr/bin/env python3
"""
scripts/verify_contracts.py

Runs the AI Service's payload-producing logic OFFLINE and validates every
output against the real contract files.

WHY THIS EXISTS: the Backend testing session proved that static syntax checks
miss the bugs that actually matter - wrong field names, wrong enum casing,
nested shapes that look plausible but are not what the contract says. This
script catches that class of bug before the service ever talks to the Backend.

Run with:  python scripts/verify_contracts.py
No network, no Gemini, no MongoDB required.
"""

import asyncio
import json
import os
import sys

# Make `app` importable when run from the repo root or from scripts/.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Force mock mode BEFORE importing settings - no Gemini calls, no key needed.
os.environ.setdefault("USE_MOCK_LLM", "true")
os.environ.setdefault("INTERNAL_SECRET", "verification-only-not-a-real-secret")

from app.contracts import validator  # noqa: E402
from app.planner import planner as planner_mod  # noqa: E402
from app.agents import base as agents_base  # noqa: E402
from app.risk import risk_agent  # noqa: E402
from app.decision import decision_agent  # noqa: E402

PASS = "\033[92mPASS\033[0m"
FAIL = "\033[91mFAIL\033[0m"

results = []


def check(contract_key: str, payload, label: str) -> bool:
    ok, errors = validator.validate(contract_key, payload)
    print(f"  [{PASS if ok else FAIL}] {label}")
    for e in errors[:12]:
        print(f"         - {e}")
    if len(errors) > 12:
        print(f"         ... and {len(errors) - 12} more")
    results.append((label, ok))
    return ok


async def main() -> int:
    loaded = validator.load_contracts()
    print(f"\nLoaded {loaded} contracts\n")
    if loaded == 0:
        print("No contracts found - cannot verify. Is contracts/ a sibling of ai-service/?")
        return 1

    analysis_id = "req_20260914_0600_abc123"

    # ================================================================
    print("=== 1. Planner -> ExecutionPlan ===\n")

    request = {
        "query": "Is it safe to venture out tomorrow morning for fishing?",
        "coordinate": {"lat": 13.0827, "lon": 80.5},
        "date": "2026-09-14",
        "time_range": {"start": "06:00", "end": "10:00"},
        "activity": "fishing",
        "vessel_type": "motorized_country_craft",
        "language_override": "en",
    }

    outcome = await planner_mod.build_plan(analysis_id=analysis_id, request=request)
    if not outcome["ok"]:
        print(f"  Planner returned an error: {outcome['error']}")
        return 1

    plan = outcome["plan"]
    points = outcome["points"]

    check("ExecutionPlan.json", plan, "ExecutionPlan (planner output)")
    check("shared/Location.json", plan["location"], "Location (nested in plan)")
    check("shared/TimeWindow.json", plan["time_window"], "TimeWindow (nested in plan)")

    print(f"\n  intent      : {plan['primary_intent']}")
    print(f"  agents      : {[a['agent'] for a in plan['selected_agents']]}")
    print(f"  points      : {len(points)} ({sum(1 for p in points if p['point_status'] == 'applicable')} applicable)")
    print(f"  time_window : {plan['time_window']['utc']}")

    print("\n  Per-point shape:")
    for p in points[:2]:
        check("PointObservation.json", p, f"PointObservation {p['point_id']}")

    # ================================================================
    print("\n=== 2. Agents -> AgentResult ===\n")

    agent_names = [a["agent"] for a in plan["selected_agents"]]
    agent_results = await agents_base.run_agents_parallel(
        agent_names=agent_names,
        analysis_id=analysis_id,
        points=points,
        time_window_utc=plan["time_window"]["utc"],
    )

    for r in agent_results:
        check("AgentResult.json", r, f"AgentResult ({r['agent_name']}, {r['status']})")

    # Measurement shape - the most error-prone structure in the system.
    print("\n  Measurement shapes:")
    sample_agent = next(
        (r for r in agent_results if (r.get("normalized") or {}).get("by_point")), None
    )
    if sample_agent:
        # normalized.by_point maps point_id -> { parameter -> Measurement }
        first_point = next(iter(sample_agent["normalized"]["by_point"].values()))
        for param, m in list(first_point.items())[:3]:
            check("Measurement.json", m, f"Measurement ({param}, status={m['status']})")

    # ================================================================
    print("\n=== 3. Risk -> RiskAssessment ===\n")

    merged = agents_base.merge_by_point(points, agent_results)
    failed = [r for r in agent_results if r["status"] == "failed"]
    agents_missing = [
        {"agent": r["agent_name"], "status": r["status"],
         "error_category": (r.get("error") or {}).get("error_category")}
        for r in failed
    ]

    assessments = []
    for p in points:
        if p["point_status"] == "not_applicable":
            continue
        a = await risk_agent.assess_point(
            point_id=p["point_id"],
            measurements=merged[p["point_id"]]["measurements"],
            hourly_measurements=None,
            agents_missing=agents_missing,
            vessel_type=plan["vessel_type"],
            activity=plan["activity"],
            response_language="en",
        )
        if a:
            assessments.append(a)

    for a in assessments[:3]:
        check("RiskAssessment.json", a, f"RiskAssessment ({a['point_id']}, {a['risk_level']})")

    print(f"\n  assessed {len(assessments)} point(s)")
    if assessments:
        s = assessments[0]
        print(f"  sample: baseline={s['baseline_score']} -> final={s['final_score']} ({s['risk_level']})")
        print(f"          floor={s['constraint_floor']}, llm_adjustment={s['llm_adjustment']}")
        print(f"          llm_interpretation_unavailable={s['llm_interpretation_unavailable']}")

    # ================================================================
    print("\n=== 4. Decision -> Decision ===\n")

    decision = await decision_agent.build_decision(
        analysis_id=analysis_id,
        assessments=assessments,
        merged_points=merged,
        points=points,
        response_language="en",
        activity=plan["activity"],
        vessel_type=plan["vessel_type"],
        agents_missing=agents_missing,
    )

    check("Decision.json", decision, "Decision (final artefact)")

    print(f"\n  recommendation : {decision['recommendation_type']}")
    print(f"  preferred      : {decision['preferred_point']}")
    print(f"  excluded       : {len(decision['excluded_points'])}")
    print(f"  one-liner      : {decision['one_line_recommendation'][:70]}...")

    # ================================================================
    print("\n=== 5. Outbound payloads to the Backend ===\n")

    # The exact ProgressMessage shapes the executor sends.
    check("ProgressMessage.json", {
        "analysis_id": analysis_id, "agent": "planner", "status": "completed",
        "status_code": 200, "timestamp": "2026-09-14T00:15:10Z",
        "selection_reason": "intent=point_safety",
        "data": {**plan, "points": points},
    }, "ProgressMessage (planner + plan + points)")

    check("ProgressMessage.json", {
        "analysis_id": analysis_id, "agent": "weather", "status": "completed",
        "status_code": 200, "timestamp": "2026-09-14T00:15:20Z",
        "data": agent_results[0],
    }, "ProgressMessage (agent result)")

    check("ProgressMessage.json", {
        "analysis_id": analysis_id, "agent": "tide", "status": "failed",
        "status_code": 504, "timestamp": "2026-09-14T00:15:25Z",
        "error": {"error_category": "upstream_unavailable", "message": "timeout"},
    }, "ProgressMessage (agent failure)")

    check("ProgressMessage.json", {
        "analysis_id": analysis_id, "agent": "risk", "status": "completed",
        "status_code": 200, "timestamp": "2026-09-14T00:15:40Z",
        "data": {"analysis_id": analysis_id, "results": assessments},
    }, "ProgressMessage (risk assessments)")

    check("api/InternalResultPayload.json", {
        "analysis_id": analysis_id,
        "final_stage": "decision",
        "status": "partial" if failed else "completed",
        "decision": decision,
    }, "InternalResultPayload (final result)")

    # ================================================================
    print("\n=== 6. Never-fabricate invariants ===\n")

    ok_invariants = True

    # Every unavailable measurement must have null value AND null source.
    violations = []
    for r in agent_results:
        for pid, measurements in ((r.get("normalized") or {}).get("by_point") or {}).items():
            for param, m in measurements.items():
                if m["status"] in ("missing", "not_mapped"):
                    if m["value"] is not None:
                        violations.append(f"{param}@{pid}: status={m['status']} but value={m['value']!r}")
                    if m["source"] is not None:
                        violations.append(f"{param}@{pid}: status={m['status']} but source={m['source']!r}")

    print(f"  [{PASS if not violations else FAIL}] unavailable measurements have null value AND null source")
    for v in violations[:5]:
        print(f"         - {v}")
    ok_invariants &= not violations
    results.append(("never-fabricate: null value/source", not violations))

    # The LLM must never have pushed a score below its constraint floor.
    floor_violations = [
        f"{a['point_id']}: final={a['final_score']} < floor={a['constraint_floor']}"
        for a in assessments
        if a["constraint_floor"] is not None and a["final_score"] < a["constraint_floor"]
    ]
    print(f"  [{PASS if not floor_violations else FAIL}] no final score below its constraint floor")
    for v in floor_violations:
        print(f"         - {v}")
    ok_invariants &= not floor_violations
    results.append(("never-fabricate: floor respected", not floor_violations))

    # Risk levels must be UPPERCASE everywhere.
    case_violations = [
        f"{a['point_id']}: risk_level={a['risk_level']!r}"
        for a in assessments
        if a["risk_level"] not in ("SAFE", "CAUTION", "UNSAFE", "DANGEROUS")
    ]
    print(f"  [{PASS if not case_violations else FAIL}] risk levels are UPPERCASE")
    for v in case_violations:
        print(f"         - {v}")
    results.append(("uppercase risk levels", not case_violations))

    # A prohibited point must never be the preferred point.
    prohibited_ids = {e["point_id"] for e in decision["excluded_points"] if e["reason"] == "gis_prohibited"}
    preferred_ok = decision["preferred_point"] not in prohibited_ids
    print(f"  [{PASS if preferred_ok else FAIL}] preferred point is never a prohibited point")
    results.append(("prohibited never recommended", preferred_ok))

    # ================================================================
    passed = sum(1 for _, ok in results if ok)
    total = len(results)
    print(f"\n{'=' * 62}")
    print(f"  {passed}/{total} checks passed")
    print(f"{'=' * 62}\n")

    if passed < total:
        print("Failed checks:")
        for label, ok in results:
            if not ok:
                print(f"  - {label}")
        print()

    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
