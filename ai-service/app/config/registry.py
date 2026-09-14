"""
app/config/registry.py

Loads shared-config/ - the SAME files the Backend loads (Sections 7.6-7.8,
24.2). Both services must agree on what "fishing" or "ta" or "m/s" means;
neither owns the list.

Loaded once at import. A malformed config file kills the process here rather
than producing subtly wrong behaviour later.
"""

import json
import os
import sys
from typing import Any, Dict, List, Optional

from app.config.settings import settings


def _load(filename: str) -> Dict[str, Any]:
    path = os.path.join(settings.SHARED_CONFIG_DIR, filename)
    try:
        with open(path, "r", encoding="utf-8") as fh:
            return json.load(fh)
    except Exception as exc:  # noqa: BLE001 - we want the real reason printed
        print(f"[registry] FATAL: could not load {path}: {exc}", file=sys.stderr)
        sys.exit(1)


_activities = _load("activities.json")["activities"]
_vessel_types = _load("vessel-types.json")["vessel_types"]
_languages = _load("languages.json")["languages"]
_canonical_units = _load("canonical-units.json")["units"]

ACTIVITY_IDS = {a["id"] for a in _activities}
VESSEL_TYPE_IDS = {v["id"] for v in _vessel_types}
LANGUAGE_CODES = {l["code"] for l in _languages}

_VESSEL_BY_ID = {v["id"]: v for v in _vessel_types}


def is_valid_activity(value: Optional[str]) -> bool:
    return value in ACTIVITY_IDS


def is_valid_vessel_type(value: Optional[str]) -> bool:
    return value in VESSEL_TYPE_IDS


def is_valid_language(value: Optional[str]) -> bool:
    return value in LANGUAGE_CODES


def canonical_unit(parameter: str) -> Optional[str]:
    """Return the required unit for a canonical parameter name, or None.

    None means "unknown parameter" and callers must treat that as a problem -
    never as "any unit is acceptable" (Section 24.2).
    """
    return _canonical_units.get(parameter)


def most_conservative_vessel_type() -> str:
    """Section 7.7: when vessel_type is absent for a safety request, the
    Planner substitutes the MOST conservative profile and states the assumption.
    conservatism_rank 1 = most fragile craft."""
    return min(_vessel_types, key=lambda v: v["conservatism_rank"])["id"]


def vessel_conservatism_rank(vessel_type: Optional[str]) -> int:
    """Higher rank = sturdier vessel. Unknown/missing returns the most
    conservative rank so a bad value never makes conditions look safer."""
    v = _VESSEL_BY_ID.get(vessel_type or "")
    return v["conservatism_rank"] if v else 1


ACTIVITIES: List[Dict[str, Any]] = _activities
VESSEL_TYPES: List[Dict[str, Any]] = _vessel_types
LANGUAGES: List[Dict[str, Any]] = _languages
CANONICAL_UNITS: Dict[str, str] = _canonical_units
