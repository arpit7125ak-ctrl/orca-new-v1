"""
app/pipeline/executor.py

Section 5 - the Complete Analysis Flow. This is the orchestrator that runs an
analysis end to end and reports every stage back to the Backend.

THE SEQUENCE:
    1. Planner                          -> POST /internal/v1/progress (agent="planner")
    2. Selected agents, in parallel     -> POST /internal/v1/progress (one per agent)
    3. Risk Agent (if intent needs it)  -> POST /internal/v1/progress (agent="risk")
    4. Decision Agent                   -> POST /internal/v1/result

WHERE RESULTS TRAVEL - the thing that is easy to get wrong:
Agent data, the execution plan, and risk assessments all reach the Backend via
/internal/v1/progress, inside ProgressMessage.data. The final /internal/v1/result
call carries ONLY the final artefact (decision / route_result / trend_result /
report_content / quick_information_result). Sending agent results in the result
call does nothing - the Backend does not read them there.

SECTION 41 - PARTIAL FAILURE: an agent failing never aborts the run. The
pipeline continues with whatever evidence exists, and the final status is
`partial` rather than `completed` so the Frontend can say "some data
unavailable" instead of presenting an incomplete answer as complete.
"""

import asyncio
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.agents import base as agents_base
from app.clients import backend_client
from app.decision import decision_agent
from app.observability.logger import for_analysis
from app.planner import planner as planner_mod
from app.risk import risk_agent

# Tracks analyses currently running, so a duplicate handoff is a no-op rather
# than a second execution (Section 103 idempotency requirement).
_IN_FLIGHT: Dict[str, str] = {}


def is_in_flight(analysis_id: str) -> bool:
    return analysis_id in _IN_FLIGHT


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _progress(
    *,
    analysis_id: str,
    agent: str,
    status: str,
    status_code: int,
    selection_reason: Optional[str] = None,
    data: Optional[Dict[str, Any]] = None,
    error: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Build a contract-shaped ProgressMessage.

    Required by contract: analysis_id, agent, status, status_code, timestamp.
    Note the field is `agent`, NOT `stage`.
    """
    message: Dict[str, Any] = {
        "analysis_id": analysis_id,
        "agent": agent,
        "status": status,
        "status_code": status_code,
        "timestamp": _now_iso(),
    }
    if selection_reason:
        message["selection_reason"] = selection_reason
    if data is not None:
        message["data"] = data
    if error is not None:
        message["error"] = error
    return message


async def execute(
    *,
    analysis_id: str,
    request: Dict[str, Any],
    conversation_id: Optional[str] = None,
    parent_analysis_id: Optional[str] = None,
    alert_subscription_id: Optional[str] = None,
) -> None:
    """Run one analysis to completion.

    Runs as a detached background task - the HTTP handler has already returned
    202 by the time this starts. Never raises: any unexpected failure is
    converted into a `failed` result so the user always gets an answer rather
    than an analysis stuck at `running` forever.
    """
    log = for_analysis(analysis_id)
    _IN_FLIGHT[analysis_id] = "running"

    try:
        await _run(analysis_id=analysis_id, request=request, log=log)
    except Exception as exc:  # noqa: BLE001
        log.error("pipeline crashed: %s", exc)
        await backend_client.post_result({
            "analysis_id": analysis_id,
            "final_stage": "decision",
            "status": "failed",
            "error": {
                "error_category": "internal_error",
                "message": f"Analysis pipeline failed: {exc}",
            },
        })
    finally:
        _IN_FLIGHT.pop(analysis_id, None)


async def _run(*, analysis_id: str, request: Dict[str, Any], log) -> None:
    # ------------------------------------------------------------------
    # STAGE 1 - Planner
    # ------------------------------------------------------------------
    await backend_client.post_progress(_progress(
        analysis_id=analysis_id, agent="planner", status="running", status_code=102,
    ))

    plan_outcome = await planner_mod.build_plan(analysis_id=analysis_id, request=request)

    if not plan_outcome["ok"]:
        # A location that cannot be resolved is a hard stop. We report the real
        # reason rather than analysing a guessed place (Section 13).
        error = plan_outcome["error"]
        log.warning("planning failed: %s", error["message"])

        await backend_client.post_progress(_progress(
            analysis_id=analysis_id, agent="planner", status="failed",
            status_code=422, error=error,
        ))
        await backend_client.post_result({
            "analysis_id": analysis_id,
            "final_stage": "decision",
            "status": "failed",
            "error": error,
        })
        return

    plan = plan_outcome["plan"]
    points = plan_outcome["points"]
    intent = plan["primary_intent"]
    time_window_utc = plan["time_window"]["utc"]
    response_language = plan["response_language"]

    log.info(
        "plan ready: intent=%s, %d agents, %d points, llm=%s",
        intent, len(plan["selected_agents"]), len(points), plan_outcome["llm_used"],
    )

    # The plan AND the sampled points both travel in ProgressMessage.data -
    # this is how the Backend learns about them.
    await backend_client.post_progress(_progress(
        analysis_id=analysis_id, agent="planner", status="completed", status_code=200,
        selection_reason=f"intent={intent}",
        data={**plan, "points": points},
    ))

    # ------------------------------------------------------------------
    # STAGE 2 - Data agents, in parallel
    # ------------------------------------------------------------------
    agent_names = [a["agent"] for a in plan["selected_agents"]]

    # Report skipped agents too. Section 107: a skipped agent with no reason is
    # an unexplained gap in the evidence chain.
    for skipped in plan.get("skipped_agents", []):
        await backend_client.post_progress(_progress(
            analysis_id=analysis_id, agent=skipped["agent"], status="skipped",
            status_code=204, selection_reason=skipped.get("reason"),
        ))

    async def _report_agent(result: Dict[str, Any]) -> None:
        """Push each agent's result the moment it finishes."""
        await backend_client.post_progress(_progress(
            analysis_id=analysis_id,
            agent=result["agent_name"],
            status=result["status"],
            status_code=200 if result["status"] in ("completed", "partial") else 502,
            data=result if result.get("normalized") else None,
            error=result.get("error"),
        ))

    agent_results = await agents_base.run_agents_parallel(
        agent_names=agent_names,
        analysis_id=analysis_id,
        points=points,
        time_window_utc=time_window_utc,
        on_result=_report_agent,
    )

    failed_agents = [r for r in agent_results if r["status"] == "failed"]
    if failed_agents:
        log.warning("%d agent(s) failed: %s",
                    len(failed_agents), ", ".join(r["agent_name"] for r in failed_agents))

    merged = agents_base.merge_by_point(points, agent_results)

    # ------------------------------------------------------------------
    # Intents that stop here
    # ------------------------------------------------------------------
    if intent in ("quick_information", "conversational_followup"):
        await _finish_quick_information(
            analysis_id=analysis_id, merged=merged, points=points,
            response_language=response_language, failed_agents=failed_agents, log=log,
        )
        return

    # ------------------------------------------------------------------
    # STAGE 3 - Risk
    # ------------------------------------------------------------------
    await backend_client.post_progress(_progress(
        analysis_id=analysis_id, agent="risk", status="running", status_code=102,
    ))

    agents_missing = [
        {"agent": r["agent_name"],
         "status": r["status"],
         "error_category": (r.get("error") or {}).get("error_category")}
        for r in failed_agents
    ]

    assessments: List[Dict[str, Any]] = []

    for point in points:
        # not_applicable points are never scored (Section 15) - they stay in
        # the points array but receive no risk assessment.
        if point.get("point_status") == "not_applicable":
            continue

        entry = merged.get(point["point_id"], {})
        assessment = await risk_agent.assess_point(
            point_id=point["point_id"],
            measurements=entry.get("measurements", {}),
            hourly_measurements=None,
            agents_missing=agents_missing,
            vessel_type=plan.get("vessel_type"),
            activity=plan.get("activity"),
            response_language=response_language,
        )
        if assessment:
            assessments.append(assessment)

    if not assessments:
        # Nothing could be scored at all. Honest failure beats an invented
        # verdict (Section 50).
        log.warning("no point could be scored - reporting failure")
        error = {
            "error_category": "risk_failure",
            "message": "No sampled point had enough usable data to assess safety.",
        }
        await backend_client.post_progress(_progress(
            analysis_id=analysis_id, agent="risk", status="failed",
            status_code=500, error=error,
        ))
        await backend_client.post_result({
            "analysis_id": analysis_id, "final_stage": "decision",
            "status": "failed", "error": error,
        })
        return

    await backend_client.post_progress(_progress(
        analysis_id=analysis_id, agent="risk", status="completed", status_code=200,
        data={"analysis_id": analysis_id, "results": assessments},
    ))

    log.info("risk complete: %d point(s) assessed", len(assessments))

    # ------------------------------------------------------------------
    # STAGE 4 - Decision
    # ------------------------------------------------------------------
    await backend_client.post_progress(_progress(
        analysis_id=analysis_id, agent="decision", status="running", status_code=102,
    ))

    decision = await decision_agent.build_decision(
        analysis_id=analysis_id,
        assessments=assessments,
        merged_points=merged,
        points=points,
        response_language=response_language,
        activity=plan.get("activity"),
        vessel_type=plan.get("vessel_type"),
        agents_missing=agents_missing,
    )

    await backend_client.post_progress(_progress(
        analysis_id=analysis_id, agent="decision", status="completed", status_code=200,
    ))

    # `partial` when evidence was incomplete - never silently upgraded to
    # `completed` just because we produced something.
    final_status = "partial" if failed_agents else "completed"

    await backend_client.post_result({
        "analysis_id": analysis_id,
        "final_stage": "decision",
        "status": final_status,
        "decision": decision,
    })

    log.info("analysis %s: %s", final_status, decision["recommendation_type"])


async def _finish_quick_information(
    *, analysis_id: str, merged, points, response_language, failed_agents, log
) -> None:
    """Quick information: no risk scoring, just the retrieved data packaged up.

    contracts/api/InternalResultPayload.json requires final_stage to match the
    populated artefact, so this path uses quick_information_result.
    """
    fields: List[Dict[str, Any]] = []

    primary = points[0]["point_id"] if points else None
    measurements = (merged.get(primary, {}) or {}).get("measurements", {}) if primary else {}

    for parameter, m in sorted(measurements.items()):
        if not isinstance(m, dict):
            continue
        fields.append({
            "parameter": parameter,
            "value": m.get("value"),
            "unit": m.get("unit"),
            "status": m.get("status"),
            "source": m.get("source"),
        })

    available = [f for f in fields if f["status"] in ("available", "derived")]

    if available:
        summary = "; ".join(
            f"{f['parameter'].replace('_', ' ')}: {f['value']} {f['unit'] or ''}".strip()
            for f in available[:4]
        )
        answer = f"Current conditions - {summary}."
    else:
        # No usable data is a real answer, not an empty one.
        answer = "No usable data was available for this location and time."

    await backend_client.post_result({
        "analysis_id": analysis_id,
        "final_stage": "quick_information",
        "status": "partial" if failed_agents else "completed",
        "quick_information_result": {
            "point": points[0] if points else None,
            "measurements": measurements,
            "answer_text": answer,
        },
    })

    log.info("quick_information complete: %d field(s)", len(fields))
