"""
app/contracts/validator.py

Loads the SAME 44 contract files the Backend loads, and validates payloads
against them before they go out. Two services, one source of truth.

WHY VALIDATE ON THIS SIDE TOO, when the Backend already validates on receipt:
catching a malformed payload here gives a clear error at the point it was
built, with the local stack trace. Catching it only on the Backend gives you a
400 from another process with no context. Defence in depth, and much faster to
debug.

THE LEADING-SLASH DETAIL (learned the hard way on the Backend side):
Some contract files reference siblings via relative $refs like
"shared/ErrorInfo.json" or "../shared/ErrorInfo.json". A JSON Schema resolver
resolves those against the REFERENCING schema's own $id. If schemas are
registered under bare relative paths, a "../" ref resolves to a path WITH a
leading slash while the schema is registered WITHOUT one - they never match and
resolution fails at validation time, not load time.

Registering every schema under a key that starts with "/" makes both sides of
that comparison consistent. The Backend's validateContract.js does exactly the
same thing for exactly the same reason.
"""

import json
import os
from typing import Any, Dict, List, Optional, Tuple

from jsonschema import Draft7Validator, RefResolver

from app.config.settings import settings
from app.observability.logger import log

_SCHEMA_STORE: Dict[str, Dict[str, Any]] = {}
_VALIDATORS: Dict[str, Draft7Validator] = {}
_loaded = False


def _collect_json_files(root: str) -> List[str]:
    found = []
    for dirpath, _dirnames, filenames in os.walk(root):
        for fn in filenames:
            if fn.endswith(".json"):
                found.append(os.path.join(dirpath, fn))
    return found


def load_contracts() -> int:
    """Load every contract into the shared store. Returns the count loaded."""
    global _loaded

    if not os.path.isdir(settings.CONTRACTS_DIR):
        log.warning(
            "[contracts] %s not found - contract validation DISABLED",
            settings.CONTRACTS_DIR,
        )
        return 0

    for path in _collect_json_files(settings.CONTRACTS_DIR):
        rel = os.path.relpath(path, settings.CONTRACTS_DIR).replace(os.sep, "/")
        key = "/" + rel  # leading slash - see module docstring
        try:
            with open(path, "r", encoding="utf-8") as fh:
                schema = json.load(fh)
            # Override the declared $id with the real path, so relative $refs
            # resolve purely from directory structure rather than trusting
            # whatever $id each file happens to declare (some are inconsistent).
            schema["$id"] = key
            _SCHEMA_STORE[key] = schema
        except Exception as exc:  # noqa: BLE001
            log.error("[contracts] failed to load %s: %s", rel, exc)

    _loaded = len(_SCHEMA_STORE) > 0
    log.info("[contracts] loaded %d contracts from %s", len(_SCHEMA_STORE), settings.CONTRACTS_DIR)
    return len(_SCHEMA_STORE)


def _get_validator(contract_key: str) -> Optional[Draft7Validator]:
    key = contract_key if contract_key.startswith("/") else "/" + contract_key

    if key in _VALIDATORS:
        return _VALIDATORS[key]

    schema = _SCHEMA_STORE.get(key)
    if schema is None:
        return None

    # The store doubles as the resolver's cache, so cross-file $refs resolve
    # without touching the filesystem again.
    resolver = RefResolver(base_uri=key, referrer=schema, store=_SCHEMA_STORE)
    validator = Draft7Validator(schema, resolver=resolver)
    _VALIDATORS[key] = validator
    return validator


def validate(contract_key: str, payload: Any) -> Tuple[bool, List[str]]:
    """Validate a payload. Returns (is_valid, [human-readable errors]).

    Never raises on a validation failure - callers decide whether a violation
    is fatal. Unknown contract keys are reported rather than silently passing,
    because a typo'd key that silently "passes" is worse than a loud failure.
    """
    if not _loaded:
        return True, []

    validator = _get_validator(contract_key)
    if validator is None:
        log.warning("[contracts] unknown contract key '%s' - validation skipped", contract_key)
        return True, []

    errors = []
    for err in sorted(validator.iter_errors(payload), key=lambda e: list(e.path)):
        where = "/".join(str(p) for p in err.path) or "(root)"
        errors.append(f"{where}: {err.message}")

    return (len(errors) == 0), errors


def assert_valid(contract_key: str, payload: Any, *, context: str = "") -> bool:
    """Validate and log loudly on failure. Returns validity.

    Used on outbound payloads: we log the violation with full detail but still
    send, because a real result the Backend can partially use beats dropping it
    over our own schema disagreement. The Backend validates again on receipt
    and is the final authority.
    """
    ok, errors = validate(contract_key, payload)
    if not ok:
        log.error(
            "[contracts] OUTGOING payload violates %s%s:\n%s",
            contract_key,
            f" ({context})" if context else "",
            "\n".join(f"    - {e}" for e in errors),
        )
    return ok


def is_loaded() -> bool:
    return _loaded


def loaded_count() -> int:
    return len(_SCHEMA_STORE)
