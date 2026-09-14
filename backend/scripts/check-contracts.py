#!/usr/bin/env python3
"""
Minimal contract conformance check.

Validates the exact payload shapes this backend PRODUCES and ACCEPTS against
the locked contracts, focusing on the two rules that actually break
integration:

  1. required   - a missing required field fails at the AI Service
  2. additionalProperties: false - a stray extra field fails the whole request

This is not a full JSON Schema implementation. It is a targeted check for the
class of bug that caused this reconciliation in the first place: field names
invented from the architecture doc rather than read from the contracts.
"""

import json
import os
import sys

CONTRACTS = os.path.join(os.path.dirname(__file__), "..", "..", "contracts")
CONTRACTS = os.path.normpath(CONTRACTS)


def load(rel):
    with open(os.path.join(CONTRACTS, rel), encoding="utf-8") as f:
        return json.load(f)


def check(rel, payload, label):
    """Check a payload against a contract's required/additionalProperties/enum,
    recursing into nested objects. This is what the original version of this
    script did NOT do - it only checked the top level, which is exactly how a
    real bug (flat location instead of place_or_coordinate, lowercase risk
    levels, an invented alert_types enum) got past it and was only caught by
    live testing against the actual server."""
    schema = load(rel)
    problems = []
    base_dir = os.path.dirname(rel)
    # (root document, base_dir) - needed because a fragment-only $ref
    # ("#/definitions/x") must resolve against the CURRENT FILE's root, not
    # against whatever sub-schema we most recently descended into.
    _check_node(schema, payload, "", problems, base_dir, schema)
    status = "PASS" if not problems else "FAIL"
    print(f"  [{status}] {label}")
    for p in problems:
        print(f"          {p}")
    return not problems


def _resolve(schema, base_dir, root):
    """Follow a single $ref. Returns (resolved_schema, new_base_dir, new_root).
    A $ref with a path switches both the base directory AND the root document
    that subsequent fragment-only refs resolve against."""
    if "$ref" not in schema:
        return schema, base_dir, root
    ref = schema["$ref"]
    path, _, fragment = ref.partition("#")
    if path:
        full_path = os.path.normpath(os.path.join(base_dir, path))
        new_root = load(full_path)
        new_base = os.path.dirname(full_path)
    else:
        new_root = root
        new_base = base_dir
    target = new_root
    if fragment:
        for part in fragment.strip("/").split("/"):
            target = target[part]
    return target, new_base, new_root


def _check_node(schema, value, path, problems, base_dir, root):
    schema, base_dir, root = _resolve(schema, base_dir, root)

    if value is None:
        return  # null is valid unless the type list forbids it; not checked here

    if "enum" in schema and value not in schema["enum"]:
        problems.append(f"'{path or '(root)'}' = {value!r} not in enum {schema['enum']}")
        return

    schema_type = schema.get("type")
    is_object_schema = schema_type == "object" or "properties" in schema

    if is_object_schema and isinstance(value, dict):
        required = schema.get("required", [])
        props = schema.get("properties", {})

        for field in required:
            if field not in value:
                problems.append(f"MISSING required field '{path}/{field}'")

        if schema.get("additionalProperties") is False:
            for field in value:
                if field not in props:
                    problems.append(f"EXTRA field '{path}/{field}' not permitted")

        for field, field_schema in props.items():
            if field in value:
                _check_node(field_schema, value[field], f"{path}/{field}", problems, base_dir, root)

    elif schema_type == "array" and isinstance(value, list) and "items" in schema:
        for i, item in enumerate(value):
            _check_node(schema["items"], item, f"{path}[{i}]", problems, base_dir, root)


# ---------------------------------------------------------------------------
# Payloads this backend SENDS or RETURNS.
# Keep these in sync with the code - they are the executable record of what the
# backend actually emits.
# ---------------------------------------------------------------------------
results = []

print("\n=== Outbound: Backend -> AI Service ===\n")

# analysis.service.js buildContractRequest() + executionRequest
results.append(check(
    "api/AnalysisExecutionRequest.json",
    {
        "analysis_id": "req_20260913_0215_a1b2c3",
        "conversation_id": None,
        "parent_analysis_id": None,
        "alert_subscription_id": None,
        "request": {},
    },
    "AnalysisExecutionRequest (analysis.service.js)",
))

results.append(check(
    "AnalysisRequest.json",
    {
        "query": "Is it safe to venture out tomorrow morning?",
        "coordinate": {"lat": 13.0827, "lon": 80.5},
        "place_name": None,
        "date": "2026-09-14",
        "time_range": {"start": "06:00", "end": "10:00"},
        "activity": "fishing",
        "vessel_type": "motorized_country_craft",
        "origin": None,
        "destination": None,
        "language_override": "en",
        "conversation_id": None,
        "parent_analysis_id": None,
    },
    "AnalysisRequest (buildContractRequest)",
))

print("\n=== Outbound: Backend -> Frontend (responses) ===\n")

# analysis.controller.js createAnalysis
results.append(check(
    "api/AnalysisCreatedResponse.json",
    {
        "analysis_id": "req_20260913_0215_a1b2c3",
        # status has a SINGLE-VALUE enum: ["queued"]. Caught by strengthening
        # this checker to actually walk nested enums - the controller was
        # returning the post-dispatch state ("running") before this was fixed.
        "status": "queued",
        "status_url": "/api/v1/analysis/req_20260913_0215_a1b2c3/status",
    },
    "AnalysisCreatedResponse (analysis.controller.js)",
))

# statusBuilder.js - minimal form
results.append(check(
    "api/AnalysisStatusResponse.json",
    {"analysis_id": "req_20260913_0215_a1b2c3", "status": "running", "agent_statuses": {}},
    "AnalysisStatusResponse minimal (statusBuilder.js)",
))

# statusBuilder.js - full form
results.append(check(
    "api/AnalysisStatusResponse.json",
    {
        "analysis_id": "req_20260913_0215_a1b2c3",
        "status": "running",
        "agent_statuses": {"weather": "completed"},
        "error": {"error_category": "timeout", "message": "slow"},
        "plan_summary": {"primary_intent": "point_safety"},
        "skipped_agents": [{"agent": "pfz", "reason": "safety intent only"}],
    },
    "AnalysisStatusResponse full (statusBuilder.js)",
))

# resultBuilder.js
results.append(check(
    "api/AnalysisResultResponse.json",
    {
        "analysis_id": "req_20260913_0215_a1b2c3",
        "status": "completed",
        # plan must be a FULL ExecutionPlan when present - contracts/
        # ExecutionPlan.json has type:object (no null) and 8 required fields.
        # resultBuilder.js currently sends plan:null when the AI Service never
        # started (dispatch failure) - a genuine never-fabricate case with no
        # honest full plan to report. That is a real tension with this
        # contract requiring plan on EVERY status including queued/running/
        # failed, not just completed. Flagged for the team to decide: either
        # the contract should allow plan:null for pre-planning states, or the
        # AI Service must synchronously emit a minimal plan even on failure.
        "plan": {
            "analysis_id": "req_20260913_0215_a1b2c3", "response_language": "en",
            "primary_intent": "point_safety",
            "location": {
                "original": {"lat": 13.08, "lon": 80.5},
                "validated": {"lat": 13.08, "lon": 80.5, "snapped": False},
            },
            "time_window": {
                "local": "2026-09-14T06:00:00+05:30/2026-09-14T10:00:00+05:30",
                "utc": "2026-09-14T00:30:00Z/2026-09-14T04:30:00Z",
            },
            "sampling": {"mode": "local_grid"},
            "selected_agents": [{"agent": "weather", "reason": "mandatory"}],
            # NOTE: this enum is the set of FINAL stages the plan may route to
            # (risk/decision/route/trend/report), not agent names - the
            # backend never hardcodes this list, it passes through whatever
            # the AI Service reports verbatim.
            "stages": ["risk", "decision"],
        },
        "points": [],
        "decision": {},
        "data_quality": {},
        "execution_trace": [],
        "created_at": "2026-09-13T02:15:00Z",
        "completed_at": "2026-09-13T02:16:00Z",
    },
    "AnalysisResultResponse (resultBuilder.js)",
))

# geofence.controller.js
results.append(check(
    "api/GeofenceCheckResponse.json",
    {
        "state": "approaching",
        "layer_name": "India-Sri Lanka maritime boundary",
        "constraint_type": "prohibited",
        "distance_km": 3.2,
        "bearing_deg": 135.0,
        "warning_text": "Warning: You are approaching...",
        "deduplicated": False,
    },
    "GeofenceCheckResponse (geofence.controller.js)",
))

# chat.controller.js
results.append(check(
    "api/ChatMessageResponse.json",
    {
        "conversation_id": "conv_abc123",
        "response_text": "Analysing your request...",
        "response_language": "en",
        "answered_from": "new_analysis",
        "triggered_analysis_id": "req_20260913_0215_a1b2c3",
        "dashboard_url": "/api/v1/analysis/req_20260913_0215_a1b2c3",
    },
    "ChatMessageResponse (chat.controller.js)",
))

results.append(check(
    "api/ConversationResponse.json",
    {"conversation_id": "conv_abc123", "current_context": None, "messages": []},
    "ConversationResponse (chat.controller.js)",
))

# voice.controller.js
results.append(check(
    "api/VoiceQueryResponse.json",
    {
        "transcript": "naalai kadalukku selvadhu paadhukaappaanadhaa?",
        "detected_language": "ta",
        "response_text": "Analysing your request...",
        "response_language": "ta",
        "conversation_id": "conv_abc123",
        "triggered_analysis_id": "req_20260913_0215_a1b2c3",
    },
    "VoiceQueryResponse (voice.controller.js)",
))

# subscriptions.controller.js present() - AFTER the reconciliation fix
results.append(check(
    "api/AlertSubscriptionResponse.json",
    {
        "subscription_id": "sub_abc123",
        "subscriber_id": "demo-subscriber-001",
        "location": {"place_name": "Off Chennai", "coordinate": {"lat": 13.08, "lon": 80.5}},
        "alert_types": ["cyclone", "high_wave"],
        "minimum_level": "UNSAFE",
        "channel": "web_push",
        "created_at": "2026-09-13T02:15:00Z",
        "activity": "fishing",
        "vessel_type": "motorized_country_craft",
        "language_override": "ta",
        "quiet_hours": {"start": "22:00", "end": "05:00"},
        "updated_at": "2026-09-13T02:15:00Z",
    },
    "AlertSubscriptionResponse (subscriptions.controller.js)",
))


# map.controller.js
results.append(check(
    "api/MapLayersResponse.json",
    {"layers": []},
    "MapLayersResponse (map.controller.js)",
))

print("\n=== Inbound: AI Service -> Backend (what we must accept) ===\n")

results.append(check(
    "ProgressMessage.json",
    {
        "analysis_id": "req_20260913_0215_a1b2c3",
        "agent": "planner",
        "status": "completed",
        "status_code": 200,
        "timestamp": "2026-09-13T02:15:30Z",
        "selection_reason": "plan built",
        "data": {},
    },
    "ProgressMessage (applyProgress reads these)",
))

results.append(check(
    "api/InternalResultPayload.json",
    {
        "analysis_id": "req_20260913_0215_a1b2c3",
        "final_stage": "decision",
        "status": "completed",
        "decision": {},
    },
    "InternalResultPayload (applyResult reads these)",
))

print("\n=== Stored documents ===\n")

results.append(check(
    "db/GeofenceEventDocument.json",
    {
        "device_id": "demo-device-001",
        "lat": 9.5,
        "lon": 79.5,
        "state": "inside",
        "layer_name": "IMBL",
        "constraint_type": "prohibited",
        "distance_km": 0,
        "bearing_deg": None,
        "deduplicated": False,
        "created_at": "2026-09-13T02:15:00Z",
    },
    "GeofenceEventDocument (geofence.service.js)",
))

print()
passed = sum(1 for r in results if r)
total = len(results)
print(f"{passed}/{total} payload shapes conform.\n")
sys.exit(0 if passed == total else 1)
