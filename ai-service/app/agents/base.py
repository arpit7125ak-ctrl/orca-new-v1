"""
app/agents/base.py

Sections 22-33 - the generic agent runner.

DESIGN: there is deliberately ONE runner rather than seven hand-written agent
classes. Section 24's "specialized agent principle" is about each agent owning
its own DATA DOMAIN, not about each needing bespoke orchestration code. Every
agent does the same three things - fetch, normalise, report - and differs only
in which adapter function it calls. Adding an eighth agent (Section 23) means
adding one adapter function and one registry entry, no new plumbing.

CONTRACT SHAPE (contracts/AgentResult.json):
    required: analysis_id, agent_name, status
    optional: started_at, completed_at, duration_ms, retry_count, error,
              normalized, raw

`normalized` has exactly two permitted keys (additionalProperties: false):
    by_point : { point_id -> { parameter -> Measurement } }
    regional : { parameter -> Measurement } | null

by_point is for agents fetched per point (weather, ocean, gis). `regional` is
for agents fetched ONCE for the whole area and then localized - tide, cyclone,
pfz, ecosystem (Section 96). Putting point_ids directly under `normalized`
fails validation; they must be nested under by_point.

The field is `normalized`, NOT `normalized_output`.

SECTION 41 - PARTIAL FAILURE: one agent failing never aborts the pipeline. It
reports status=failed with an error_category and the run continues with
whatever evidence exists. The Risk Agent then decides whether it can still
produce a safe verdict (Section 50).
"""

import asyncio
import time as _time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.adapters import mock as mock_adapter
from app.config.settings import settings
from app.observability.logger import log

# Section 22 - the agent registry. Adding an agent means adding a row here and
# an adapter function, nothing else.
AGENT_REGISTRY: Dict[str, Dict[str, Any]] = {
    "weather":   {"domain": "Weather parameters and warnings",       "mandatory_for_safety": True},
    "ocean":     {"domain": "Waves, swell, currents, SST, salinity", "mandatory_for_safety": True},
    "tide":      {"domain": "Tide levels and tidal currents",        "mandatory_for_safety": False},
    "cyclone":   {"domain": "Cyclones and official marine warnings", "mandatory_for_safety": True},
    "ecosystem": {"domain": "Chlorophyll, oxygen, nutrients",        "mandatory_for_safety": False},
    "pfz":       {"domain": "Potential Fishing Zone evidence",       "mandatory_for_safety": False},
    "gis":       {"domain": "Boundaries, MPAs, depth, ports",        "mandatory_for_safety": True},
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


async def run_agent(
    *,
    agent_name: str,
    analysis_id: str,
    points: List[Dict[str, Any]],
    time_window_utc: str,
) -> Dict[str, Any]:
    """Run one agent across all sampled points.

    Returns a contract-shaped AgentResult. Never raises - a failure is returned
    as a result with status="failed", because an exception escaping here would
    take down the whole parallel gather and lose the other agents' work too.
    """
    started_at = _now_iso()
    t0 = _time.perf_counter()

    fetcher = mock_adapter.FETCHERS.get(agent_name)
    if fetcher is None:
        return _failed_result(
            agent_name, analysis_id, started_at, t0,
            "internal_error", f"No adapter registered for agent '{agent_name}'",
        )

    try:
        by_point: Dict[str, Any] = {}

        for point in points:
            # Section 15: a not_applicable point (land inside the grid) is not
            # queried at all. It stays in the points array so the gap is
            # visible, but spending an upstream call on it would be waste.
            if point.get("point_status") == "not_applicable":
                continue

            measurements = await asyncio.to_thread(
                fetcher, point["lat"], point["lon"], time_window_utc
            )
            # Measurements sit directly under the point_id - there is no
            # intermediate "measurements" wrapper in the contract.
            by_point[point["point_id"]] = measurements

        duration_ms = int((_time.perf_counter() - t0) * 1000)

        # If every measurement came back unusable, the agent technically ran
        # but produced nothing usable - report `partial`, not `completed`, so
        # downstream stages know the difference.
        status = "completed" if _has_any_usable(by_point) else "partial"

        log.debug("[agent:%s] %s in %dms (%d points)",
                  agent_name, status, duration_ms, len(by_point))

        return {
            "analysis_id": analysis_id,
            "agent_name": agent_name,
            "status": status,
            "started_at": started_at,
            "completed_at": _now_iso(),
            "duration_ms": duration_ms,
            "retry_count": 0,
            "error": None,
            "normalized": {"by_point": by_point, "regional": None},
        }

    except asyncio.TimeoutError:
        return _failed_result(
            agent_name, analysis_id, started_at, t0,
            "timeout", f"{agent_name} exceeded its {settings.AGENT_TIMEOUT_SECONDS}s budget",
        )
    except Exception as exc:  # noqa: BLE001
        log.error("[agent:%s] failed: %s", agent_name, exc)
        return _failed_result(
            agent_name, analysis_id, started_at, t0,
            "upstream_unavailable", str(exc),
        )


def _has_any_usable(by_point: Dict[str, Any]) -> bool:
    """True if at least one measurement anywhere has usable data.

    'derived' counts as usable - it was computed, not absent.
    """
    for measurements in by_point.values():
        for m in measurements.values():
            if isinstance(m, dict) and m.get("status") in ("available", "derived", "partial"):
                return True
    return False


def _failed_result(
    agent_name: str, analysis_id: str, started_at: str, t0: float,
    error_category: str, message: str,
) -> Dict[str, Any]:
    return {
        "analysis_id": analysis_id,
        "agent_name": agent_name,
        "status": "failed",
        "started_at": started_at,
        "completed_at": _now_iso(),
        "duration_ms": int((_time.perf_counter() - t0) * 1000),
        "retry_count": 0,
        # contracts/shared/ErrorInfo.json shape.
        "error": {"error_category": error_category, "message": message},
        "normalized": None,
    }


async def run_agents_parallel(
    *,
    agent_names: List[str],
    analysis_id: str,
    points: List[Dict[str, Any]],
    time_window_utc: str,
    on_result=None,
) -> List[Dict[str, Any]]:
    """Section 33 - run independent agents concurrently.

    Each agent gets its own timeout (Section 34). `on_result` is awaited per
    agent as it finishes, so progress reaches the Backend as soon as each agent
    completes rather than only after the slowest one.
    """

    async def _one(name: str) -> Dict[str, Any]:
        try:
            result = await asyncio.wait_for(
                run_agent(
                    agent_name=name,
                    analysis_id=analysis_id,
                    points=points,
                    time_window_utc=time_window_utc,
                ),
                timeout=settings.AGENT_TIMEOUT_SECONDS,
            )
        except asyncio.TimeoutError:
            result = _failed_result(
                name, analysis_id, _now_iso(), _time.perf_counter(),
                "timeout", f"{name} exceeded its {settings.AGENT_TIMEOUT_SECONDS}s budget",
            )

        if on_result:
            await on_result(result)
        return result

    log.info("[agents] running %d in parallel: %s", len(agent_names), ", ".join(agent_names))
    return await asyncio.gather(*[_one(n) for n in agent_names])


def merge_by_point(
    points: List[Dict[str, Any]], agent_results: List[Dict[str, Any]]
) -> Dict[str, Dict[str, Any]]:
    """Collapse every agent's output into one measurement map per point.

    The Risk Agent needs "everything known about P4", not seven separate lists.

    Parameter collisions (two agents reporting sst_c) keep the USABLE value
    rather than letting arrival order decide - otherwise a later agent's
    `missing` would overwrite an earlier agent's real reading.
    """
    merged: Dict[str, Dict[str, Any]] = {
        p["point_id"]: {"point": p, "measurements": {}, "agents_missing": []}
        for p in points
    }

    for result in agent_results:
        agent_name = result["agent_name"]
        normalized = result.get("normalized") or {}
        by_point = normalized.get("by_point") or {}
        regional = normalized.get("regional") or {}

        if result["status"] == "failed" or not (by_point or regional):
            # Record the gap against every point. Silence is not the same as
            # "fine" - Section 50 needs to know what evidence is absent.
            for entry in merged.values():
                entry["agents_missing"].append({
                    "agent": agent_name,
                    "status": result["status"],
                    "error_category": (result.get("error") or {}).get("error_category"),
                })
            continue

        for point_id, measurements in by_point.items():
            if point_id not in merged:
                continue
            _merge_into(merged[point_id]["measurements"], measurements)

        # Regional data (tide, cyclone, pfz, ecosystem - Section 96) is fetched
        # once and applies to EVERY point, so it is copied onto all of them.
        if regional:
            for entry in merged.values():
                _merge_into(entry["measurements"], regional)

    return merged


def _merge_into(target: Dict[str, Any], incoming: Dict[str, Any]) -> None:
    """Merge measurements, preferring a usable value over an unusable one.

    Without this, a later agent's `missing` reading would overwrite an earlier
    agent's real one purely because of arrival order.
    """
    for param, measurement in incoming.items():
        if not isinstance(measurement, dict):
            continue
        existing = target.get(param)
        if existing and existing.get("status") in ("available", "derived"):
            if measurement.get("status") not in ("available", "derived"):
                continue
        target[param] = measurement
