"""
app/clients/backend_client.py

The ONLY place this service talks back to the Backend.

Two endpoints, both on the Backend's INTERNAL server (port 4100):
  POST /internal/v1/progress   - called many times, once per agent/stage
  POST /internal/v1/result     - called exactly once, carries the final artefact

Both require a short-lived HS256 JWT in the `x-internal-token` header, signed
with the shared INTERNAL_SECRET. Claims are iss=orca-ai-service,
aud=orca-backend - the exact reverse of the token the Backend sends us.

DESIGN NOTE - progress failures are non-fatal:
If a progress POST fails, the analysis keeps running. Progress is telemetry for
the Frontend's live view; losing one message degrades the UX but must never
abort real work that is already in flight. The final result POST is different -
that one is retried, because losing it means the user never gets an answer.
"""

import asyncio
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

import httpx
import jwt

from app.config.settings import settings
from app.contracts import validator
from app.observability.logger import log, redact

_TOKEN_HEADER = "x-internal-token"


def _mint_token(analysis_id: Optional[str] = None) -> str:
    """Mint a fresh short-lived token.

    A NEW token per call, deliberately - they expire in 120s and a retry after
    backoff would otherwise carry an already-dead one.
    """
    now = datetime.now(timezone.utc)
    claims: Dict[str, Any] = {
        "iss": settings.TOKEN_ISSUER,
        "aud": settings.TOKEN_AUDIENCE,
        "iat": now,
        "exp": now + timedelta(seconds=settings.INTERNAL_TOKEN_TTL_SECONDS),
    }
    if analysis_id:
        claims["analysis_id"] = analysis_id

    return jwt.encode(claims, settings.INTERNAL_SECRET, algorithm="HS256")


def _headers(analysis_id: Optional[str] = None) -> Dict[str, str]:
    return {
        "Content-Type": "application/json",
        _TOKEN_HEADER: _mint_token(analysis_id),
    }


async def post_progress(message: Dict[str, Any]) -> bool:
    """POST a ProgressMessage. Returns True on success.

    Never raises - see the module docstring on why progress failures must not
    abort a running analysis.
    """
    analysis_id = message.get("analysis_id", "")
    agent = message.get("agent", "?")

    # Validate before sending so a shape bug surfaces here, with local context,
    # rather than as an opaque 400 from another process.
    validator.assert_valid("ProgressMessage.json", message, context=f"agent={agent}")

    url = f"{settings.BACKEND_INTERNAL_URL}/internal/v1/progress"

    try:
        async with httpx.AsyncClient(timeout=settings.BACKEND_POST_TIMEOUT_SECONDS) as client:
            resp = await client.post(url, json=message, headers=_headers(analysis_id))

        if resp.status_code == 200:
            log.debug("[backend] progress accepted (agent=%s)", agent)
            return True

        log.warning(
            "[backend] progress rejected: HTTP %s (agent=%s) body=%s",
            resp.status_code, agent, resp.text[:400],
        )
        return False

    except Exception as exc:  # noqa: BLE001
        log.warning("[backend] progress POST failed (agent=%s): %s", agent, exc)
        return False


async def post_result(payload: Dict[str, Any], *, max_retries: int = 3) -> bool:
    """POST the final InternalResultPayload, with retries.

    Retried because losing this means the user never receives an answer at all -
    unlike a dropped progress message, which only costs a UI update.

    The Backend is idempotent on this endpoint: if the analysis is already
    terminal, a repeated POST is ignored rather than corrupting stored data. So
    retrying is always safe.
    """
    analysis_id = payload.get("analysis_id", "")

    validator.assert_valid(
        "api/InternalResultPayload.json", payload,
        context=f"final_stage={payload.get('final_stage')}",
    )

    url = f"{settings.BACKEND_INTERNAL_URL}/internal/v1/result"

    for attempt in range(max_retries):
        try:
            async with httpx.AsyncClient(timeout=settings.BACKEND_POST_TIMEOUT_SECONDS) as client:
                resp = await client.post(url, json=payload, headers=_headers(analysis_id))

            if resp.status_code == 200:
                log.info("[backend] final result accepted (status=%s)", payload.get("status"))
                return True

            # A 4xx means OUR payload is wrong. Retrying an identical bad
            # request fails identically, so stop and surface it.
            if 400 <= resp.status_code < 500:
                log.error(
                    "[backend] final result REJECTED as malformed: HTTP %s body=%s",
                    resp.status_code, resp.text[:800],
                )
                return False

            log.warning("[backend] final result got HTTP %s, retrying", resp.status_code)

        except Exception as exc:  # noqa: BLE001
            log.warning("[backend] result POST attempt %d failed: %s", attempt + 1, exc)

        if attempt < max_retries - 1:
            await asyncio.sleep(0.5 * (2 ** attempt))  # 0.5s, 1s, 2s

    log.error("[backend] final result could not be delivered after %d attempts", max_retries)
    return False


async def health_check() -> Dict[str, Any]:
    """Is the Backend's internal API reachable? Never raises."""
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(f"{settings.BACKEND_INTERNAL_URL}/health")
        return {"reachable": True, "status": resp.status_code}
    except Exception as exc:  # noqa: BLE001
        return {"reachable": False, "error": str(exc)}
