"""
app/observability/logger.py

Structured logging with the same redaction discipline as the Backend
(Section 107): never log API keys, tokens, or secrets, even accidentally.
"""

import logging
import sys
from typing import Any

from app.config.settings import settings

# Keys whose values are scrubbed before anything reaches the log stream.
_REDACT_KEYS = {
    "gemini_api_key", "api_key", "apikey", "internal_secret", "secret",
    "token", "x-internal-token", "authorization", "password", "jwt",
}


def redact(payload: Any) -> Any:
    """Recursively replace secret values with a marker.

    Applied to anything we log that could plausibly contain credentials - most
    importantly outbound request bodies and headers.
    """
    if isinstance(payload, dict):
        return {
            k: ("[REDACTED]" if k.lower() in _REDACT_KEYS else redact(v))
            for k, v in payload.items()
        }
    if isinstance(payload, list):
        return [redact(v) for v in payload]
    return payload


def _build_logger() -> logging.Logger:
    logger = logging.getLogger("orca-ai")
    logger.setLevel(getattr(logging, settings.LOG_LEVEL, logging.INFO))

    # Avoid duplicate handlers when uvicorn reloads the module.
    if logger.handlers:
        return logger

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(
        logging.Formatter(
            "[%(asctime)s] %(levelname)-5s %(message)s",
            datefmt="%H:%M:%S",
        )
    )
    logger.addHandler(handler)
    logger.propagate = False
    return logger


log = _build_logger()


def for_analysis(analysis_id: str):
    """Return a small adapter that prefixes every line with the analysis_id.

    Section 107 requires analysis_id on every log line so one request is
    traceable end-to-end across both services.
    """

    class _Bound:
        def _fmt(self, msg: str) -> str:
            return f"[{analysis_id}] {msg}"

        def debug(self, msg: str, *a, **kw):
            log.debug(self._fmt(msg), *a, **kw)

        def info(self, msg: str, *a, **kw):
            log.info(self._fmt(msg), *a, **kw)

        def warning(self, msg: str, *a, **kw):
            log.warning(self._fmt(msg), *a, **kw)

        def error(self, msg: str, *a, **kw):
            log.error(self._fmt(msg), *a, **kw)

    return _Bound()
