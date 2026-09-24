
"""
app/clients/gemini_client.py

The only place this service calls Gemini.

Model: configurable via GEMINI_MODEL.

LangChain is used as the integration layer for Gemini.
The surrounding ORCA logic, LLMResult format, JSON handling,
error handling, and caller interface are intentionally unchanged.

NEVER-FABRICATE, applied to the LLM layer:
Every call returns a `LLMResult` carrying an explicit `available` flag.
When Gemini is unreachable, returns malformed JSON, or is not configured,
callers get available=False and must degrade honestly.
"""

import json
import re
from dataclasses import dataclass, field
from typing import Any, Dict, Optional

from app.config.settings import settings
from app.observability.logger import log

# The LangChain Gemini client is imported lazily so the service can still
# boot in mock mode on a machine where langchain-google-genai is not installed.
_client = None
_import_error: Optional[str] = None


def _get_client():
    global _client, _import_error

    if _client is not None:
        return _client
    

    if _import_error is not None:
        return None

    try:
        from langchain_google_genai import ChatGoogleGenerativeAI

        _client = ChatGoogleGenerativeAI(
            model=settings.GEMINI_MODEL,
            google_api_key=settings.GEMINI_API_KEY,
            max_retries=0,
        )

        log.info(
            "[gemini] LangChain client ready (model=%s)",
            settings.GEMINI_MODEL,
        )

        return _client

    except Exception as exc:  # noqa: BLE001
        _import_error = str(exc)
        log.error("[gemini] client unavailable: %s", exc)
        return None


@dataclass
class LLMResult:
    """Result of an LLM call.

    `available` is the important field. False means the model did not give us
    usable output, for ANY reason - not configured, network failure,
    malformed JSON, refused. Callers must branch on it rather than assuming
    `data` is populated.
    """

    available: bool
    data: Optional[Dict[str, Any]] = None
    raw_text: Optional[str] = None
    reason: Optional[str] = None
    model: str = field(default_factory=lambda: settings.GEMINI_MODEL)


async def generate_json(
    *,
    system_prompt: str,
    user_prompt: str,
    response_schema: Optional[Dict[str, Any]] = None,
    purpose: str = "generic",
) -> LLMResult:
    """Ask Gemini for a JSON object.

    Args:
        system_prompt: role/rules. Kept separate from user content so that user
            text is never able to overwrite the rules.
        user_prompt: the actual task content.
        response_schema: optional JSON Schema constraining the output.
        purpose: label for logs, e.g. "planner" / "risk" / "decision".

    Returns:
        LLMResult. Check `.available` before touching `.data`.
    """

    if settings.USE_MOCK_LLM:
        return LLMResult(
            available=False,
            reason="mock_llm_enabled",
            model="mock",
        )

    if not settings.GEMINI_API_KEY:
        return LLMResult(
            available=False,
            reason="gemini_api_key_not_configured",
        )

    client = _get_client()

    if client is None:
        return LLMResult(
            available=False,
            reason=f"gemini_client_unavailable: {_import_error}",
        )

    try:
        import asyncio

        # Keep system and user prompts separate.
        #
        # LangChain accepts messages through invoke().
        #
        # We intentionally do NOT change the prompt content or JSON format.
        def _call():
            from langchain_core.messages import HumanMessage, SystemMessage

            messages = [
                SystemMessage(content=system_prompt),
                HumanMessage(content=user_prompt),
            ]

            return client.invoke(messages)

        try:
            response = await asyncio.wait_for(asyncio.to_thread(_call), timeout=600.0)
        except asyncio.TimeoutError:
            log.warning(
                "[gemini] call timed out after 600s (10 min) (purpose=%s) - using deterministic fallback",
                purpose,
            )
            return LLMResult(
                available=False,
                reason="gemini_call_timed_out",
            )

        # LangChain structured output can return a Python dictionary directly.
        if isinstance(response, dict):
            data = response

            if not isinstance(data, dict):
                return LLMResult(
                    available=False,
                    reason="response_was_not_an_object",
                )

            raw_text = json.dumps(data)

            log.debug(
                "[gemini] ok (purpose=%s, %d keys)",
                purpose,
                len(data),
            )

            return LLMResult(
                available=True,
                data=data,
                raw_text=raw_text,
            )

        # Normal LangChain response is an AIMessage.
        text = (getattr(response, "content", None) or "").strip()

        # Some LangChain integrations can return content as a list.
        if isinstance(text, list):
            text = "".join(
                item.get("text", "")
                if isinstance(item, dict)
                else str(item)
                for item in text
            ).strip()

        if not text:
            log.warning(
                "[gemini] empty response (purpose=%s)",
                purpose,
            )

            return LLMResult(
                available=False,
                reason="empty_response",
            )

        # Robust JSON extraction from LLM response
        clean_text = text
        if "```" in clean_text:
            match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", clean_text)
            if match:
                clean_text = match.group(1).strip()
            else:
                parts = clean_text.split("```")
                if len(parts) >= 2:
                    clean_text = parts[1]
                    if clean_text.startswith("json"):
                        clean_text = clean_text[4:]
                    clean_text = clean_text.strip()

        # Extract outer JSON object if model included conversational preamble/suffix
        first_brace = clean_text.find("{")
        last_brace = clean_text.rfind("}")
        if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
            clean_text = clean_text[first_brace : last_brace + 1]

        # Strip trailing commas before closing braces/brackets (common LLM generation issue)
        clean_text = re.sub(r",\s*([\]}])", r"\1", clean_text)

        try:
            data = json.loads(clean_text)
        except json.JSONDecodeError:
            try:
                data = json.loads(clean_text, strict=False)
            except json.JSONDecodeError as exc:
                log.warning(
                    "[gemini] non-JSON response (purpose=%s): %s",
                    purpose,
                    exc,
                )
                return LLMResult(
                    available=False,
                    raw_text=text[:1000],
                    reason=f"invalid_json: {exc}",
                )

        if not isinstance(data, dict):
            return LLMResult(
                available=False,
                raw_text=text[:1000],
                reason="response_was_not_an_object",
            )

        log.debug(
            "[gemini] ok (purpose=%s, %d keys)",
            purpose,
            len(data),
        )

        return LLMResult(
            available=True,
            data=data,
            raw_text=text,
        )

    except Exception as exc:  # noqa: BLE001
        log.error(
            "[gemini] call failed (purpose=%s): %s",
            purpose,
            exc,
        )

        return LLMResult(
            available=False,
            reason=f"call_failed: {exc}",
        )


def is_configured() -> bool:
    return bool(settings.GEMINI_API_KEY) and not settings.USE_MOCK_LLM

