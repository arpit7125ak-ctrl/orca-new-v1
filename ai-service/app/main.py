"""
app/main.py

FastAPI entry point for the ORCA AI Service.

    uvicorn app.main:app --port 8000 --reload

THE ONE ENDPOINT THE BACKEND CALLS:
    POST /v1/analysis/execute

Per contracts/api/AnalysisExecutionRequest.json and confirmed by live testing
against the Backend, this endpoint must:

  1. Return 202 Accepted IMMEDIATELY - before doing any real work. The Backend
     treats 202 as "accepted, now running" and moves on. The actual analysis
     runs as a detached background task and reports back via the Backend's
     internal callbacks.

  2. Be IDEMPOTENT - a retry with an analysis_id already in flight must return
     200 (not 202) and must NOT start a second execution. The Backend retries
     on network blips, and a double-run would produce duplicate progress
     messages and two conflicting results.

WHY NOT VALIDATE THE PAYLOAD BEFORE RETURNING 202: the Backend has already
validated it against the same contract before sending. Re-validating here and
rejecting would break the 202-immediately requirement for no benefit. We do
validate, but after accepting, so a shape problem surfaces in logs rather than
as a handoff failure.
"""

import asyncio
from contextlib import asynccontextmanager
from typing import Any, Dict

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.clients import backend_client, gemini_client
from app.config.settings import settings
from app.contracts import validator
from app.observability.logger import log
from app.pipeline import executor
from app.planner import router
from app.risk import trends


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Startup and shutdown.

    Contracts are loaded once here rather than per-request - they never change
    at runtime, and a missing contracts/ directory should be visible at boot.
    """
    count = validator.load_contracts()

    log.info("=" * 62)
    log.info("ORCA AI Service starting")
    log.info("  env            : %s", settings.ENV)
    log.info("  contracts      : %d loaded", count)
    log.info("  adapter mode   : %s", settings.ADAPTER_MODE)
    log.info("  backend        : %s", settings.BACKEND_INTERNAL_URL)
    log.info(
        "  gemini         : %s",
        f"{settings.GEMINI_MODEL}" if gemini_client.is_configured()
        else "MOCK / not configured - deterministic fallbacks will be used",
    )
    log.info("=" * 62)

    if not gemini_client.is_configured():
        # Not fatal. The pipeline degrades to deterministic output and marks
        # llm_interpretation_unavailable rather than inventing narratives.
        log.warning(
            "Gemini is not configured. The pipeline still runs, but risk "
            "explanations and advisory text will be deterministic fallbacks."
        )

    health = await backend_client.health_check()
    if health["reachable"]:
        log.info("Backend internal API reachable at %s", settings.BACKEND_INTERNAL_URL)
    else:
        # Also not fatal at boot - the Backend may simply start after us.
        log.warning(
            "Backend internal API NOT reachable at %s (%s). "
            "Callbacks will fail until it is up.",
            settings.BACKEND_INTERNAL_URL, health.get("error"),
        )

    yield
    log.info("ORCA AI Service shutting down")


app = FastAPI(
    title="ORCA AI Service",
    description="Agentic marine intelligence pipeline for SIH 26176 (Team Nautilus)",
    version="1.0.0",
    lifespan=lifespan,
)


@app.get("/health")
async def health() -> Dict[str, Any]:
    """Liveness. Always 200 if the process can answer at all."""
    return {
        "status": "ok",
        "service": "orca-ai-service",
        "env": settings.ENV,
        "contracts_loaded": validator.loaded_count(),
        "gemini_configured": gemini_client.is_configured(),
        "adapter_mode": settings.ADAPTER_MODE,
    }


@app.get("/health/ready")
async def ready() -> JSONResponse:
    """Readiness. Answers "can this service actually do useful work?"

    Contracts are the only hard requirement - without them we cannot validate
    anything we send. A missing Gemini key or an unreachable Backend are
    reported but do not fail readiness, because the pipeline still degrades
    honestly in both cases.
    """
    backend = await backend_client.health_check()
    contracts_ok = validator.is_loaded()

    return JSONResponse(
        status_code=200 if contracts_ok else 503,
        content={
            "status": "ready" if contracts_ok else "not_ready",
            "checks": {
                "contracts": {"loaded": contracts_ok, "count": validator.loaded_count()},
                "backend_internal": backend,
                "gemini": {"configured": gemini_client.is_configured(), "model": settings.GEMINI_MODEL},
            },
        },
    )


@app.post("/v1/analysis/execute")
async def execute_analysis(request: Request) -> JSONResponse:
    """Accept an analysis from the Backend and run it in the background.

    Returns 202 immediately (or 200 if this analysis_id is already running).
    """
    try:
        body = await request.json()
    except Exception:  # noqa: BLE001
        return JSONResponse(
            status_code=400,
            content={"accepted": False, "error": "Request body is not valid JSON"},
        )

    analysis_id = body.get("analysis_id")
    if not analysis_id:
        return JSONResponse(
            status_code=400,
            content={"accepted": False, "error": "analysis_id is required"},
        )

    # Idempotency: a duplicate handoff returns 200 and starts nothing.
    if executor.is_in_flight(analysis_id):
        log.info("[execute] %s already running - idempotent no-op", analysis_id)
        return JSONResponse(
            status_code=200,
            content={"accepted": True, "already_running": True, "analysis_id": analysis_id},
        )

    # Validated AFTER accepting, so a shape problem shows up in our logs rather
    # than breaking the Backend's handoff.
    validator.assert_valid(
        "api/AnalysisExecutionRequest.json", body, context="inbound handoff"
    )

    analysis_request = body.get("request") or {}

    log.info(
        "[execute] accepted %s (query=%r, activity=%s)",
        analysis_id,
        (analysis_request.get("query") or "")[:60],
        analysis_request.get("activity"),
    )

    # Detached background task. Nothing awaits it - the 202 goes out now.
    asyncio.create_task(
        executor.execute(
            analysis_id=analysis_id,
            request=analysis_request,
            conversation_id=body.get("conversation_id"),
            parent_analysis_id=body.get("parent_analysis_id"),
            alert_subscription_id=body.get("alert_subscription_id"),
        )
    )

    return JSONResponse(
        status_code=202,
        content={"accepted": True, "analysis_id": analysis_id},
    )


@app.post("/v1/route/analyze")
@app.post("/api/v1/route/analyze")
async def analyze_route(request: Request) -> JSONResponse:
    """Deterministic Route Analysis endpoint conforming to RouteResult.json."""
    body = await request.json()
    route_id = body.get("route_id") or f"route_{int(asyncio.get_event_loop().time())}"
    result = router.evaluate_route(
        route_id=route_id,
        analysis_id=body.get("analysis_id"),
        origin=body.get("origin", {}),
        destination=body.get("destination", {}),
        vessel_type=body.get("vessel_type", "motorized_country_craft"),
        departure_time=body.get("departure_time"),
    )
    return JSONResponse(status_code=200, content=result)


@app.post("/v1/trends/analyze")
@app.post("/api/v1/trends/analyze")
async def analyze_trends(request: Request) -> JSONResponse:
    """Deterministic Historical Trend endpoint conforming to TrendResult.json."""
    body = await request.json()
    trend_id = body.get("trend_id") or f"trend_{int(asyncio.get_event_loop().time())}"
    result = trends.evaluate_trends(
        trend_id=trend_id,
        analysis_id=body.get("analysis_id"),
        location=body.get("location", {}),
        parameter=body.get("parameter", "sst"),
    )
    return JSONResponse(status_code=200, content=result)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=settings.AI_SERVICE_PORT,
        reload=settings.ENV == "development",
    )
