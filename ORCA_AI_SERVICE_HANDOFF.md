# ORCA — AI Service ↔ Backend Handoff

**Team Nautilus · SIH 26176**
**Purpose:** everything the AI Service needs to build against, verified working through live testing on the Backend side. Follow this exactly and integration will work first try.

---

## 1. The three endpoints, at a glance

| # | Who calls whom | Method + Path | Auth |
|---|---|---|---|
| 1 | Backend → AI Service | `POST /v1/analysis/execute` | AI Service must accept the Backend's token |
| 2 | AI Service → Backend | `POST http://<backend-host>:4100/internal/v1/progress` | AI Service sends a token |
| 3 | AI Service → Backend | `POST http://<backend-host>:4100/internal/v1/result` | AI Service sends a token |

**The internal port is 4100, not 4000.** The public API (4000) is Frontend-facing only. Never call 4000 from the AI Service, and never let the Frontend call 4100.

---

## 2. Authentication (both directions)

Every request in both directions carries a header:

```
x-internal-token: <JWT>
```

The JWT is HS256, signed with a shared secret (`INTERNAL_SECRET` in both services' `.env`), 120 seconds TTL in production (the Backend mints tokens per-call with a fresh one each time — don't cache one for longer than a single request).

**Backend → AI Service** token claims:
```json
{ "iss": "orca-backend", "aud": "orca-ai-service" }
```

**AI Service → Backend** token claims (what your service must mint):
```json
{ "iss": "orca-ai-service", "aud": "orca-backend" }
```

Get `INTERNAL_SECRET` from whoever manages `.env` — it must be the exact same string on both sides. A missing or invalid token gets a clean `401 Unauthorized`, verified in testing.

---

## 3. Step 1 — Backend hands off an analysis to you

### Request you receive

`POST /v1/analysis/execute`

**You must respond with `202 Accepted` immediately** — before doing any real work. The Backend does not wait for your response beyond the HTTP round-trip; it treats 202 as "accepted, now running" and moves on. If you're still bootstrapping, `202` first, work second.

**Idempotency requirement:** if the Backend retries the same `analysis_id` (e.g. after a network blip), you must not start a second execution. Detect the duplicate and return `200 OK` instead of `202` to signal "already running/completed, no-op."

### Request body — `AnalysisExecutionRequest`

```jsonc
{
  "analysis_id": "req_20260914_0600_a1b2c3",   // required. Format: req_{YYYYMMDD}_{HHMM}_{hash6}
  "conversation_id": "conv_74435e65fa66",       // nullable
  "parent_analysis_id": null,                   // nullable
  "alert_subscription_id": null,                // nullable — present if this came from the scheduler
  "request": { /* AnalysisRequest — see below */ }
}
```

**`analysis_id` format is locked:** `req_{YYYYMMDD}_{HHMM}_{hash6}`. The date/time is the moment the Backend *received* the request, in UTC — NOT the target analysis window. Don't try to parse meaning out of it beyond "this is the opaque unique key you must echo back on every callback."

### The nested `request` object — `AnalysisRequest`

This is the raw, pre-interpretation user input. Field names that are easy to get wrong (all confirmed live):

```jsonc
{
  "query": "Is it safe to venture out tomorrow morning?",  // string|null
  "coordinate": { "lat": 13.0827, "lon": 80.5 },            // NESTED object, not flat lat/lon
  "place_name": null,
  "date": "2026-09-14",                                      // bare ISO date, if given explicitly
  "time_range": { "start": "06:00", "end": "10:00" },        // NESTED, field names start/end — NOT start_time/end_time
  "activity": "fishing",
  "vessel_type": "motorized_country_craft",
  "origin": null,       // place_or_coordinate, present for route requests
  "destination": null,  // place_or_coordinate, present for route requests
  "language_override": "en",                                 // NOT "language"
  "conversation_id": null,
  "parent_analysis_id": null
}
```

**`place_or_coordinate` shape** (used for `origin`, `destination`, and alert subscription `location`):
```json
{ "place_name": "Chennai Port", "coordinate": { "lat": 13.10, "lon": 80.30 } }
```
Either field alone is valid; both together is fine too.

**What the Backend does NOT resolve for you:** whether a place is marine or land, whether a region is supported, offshore snapping, or what "tomorrow morning" means in `query`. All of that is entirely your job as the Planner. The Backend only does structural validation.

---

## 4. Step 2 — You report progress, repeatedly

`POST http://<backend>:4100/internal/v1/progress`

Call this **once per agent/stage**, as each one starts and finishes. This is also how the Backend learns about your plan, your sampled points, and every agent's measurements — **not** the final result call. Get this part right and everything downstream works.

### Request body — `ProgressMessage`

```jsonc
{
  "analysis_id": "req_20260914_0600_a1b2c3",  // required
  "agent": "weather",                          // required. NOT "stage". e.g. "planner","weather","ocean","tide","risk","decision"
  "status": "completed",                       // required. enum: queued|running|completed|partial|failed|skipped
  "status_code": 200,                          // required. integer
  "timestamp": "2026-09-14T00:15:20Z",         // required. ISO date-time
  "selection_reason": null,                     // string|null — for planner messages announcing a selection/skip
  "data_ref": null,                             // string|null — pointer to stored data, e.g. "agent_results/ocean"
  "data": { /* see below */ },                  // object|null — inline payload for small data
  "error": null,                                // ErrorInfo|null — see §6
  "metadata": null                              // object|null, free-form
}
```

Use `data` for inline payloads that are small; use `data_ref` (a pointer string) for anything large. The Backend absorbs whichever one you send.

### 4.1 — Reporting the plan (agent: `"planner"`)

Send this once, right after planning completes, with `agent: "planner"` and the full `ExecutionPlan` in `data`:

```jsonc
{
  "analysis_id": "req_20260914_0600_a1b2c3",
  "agent": "planner",
  "status": "completed",
  "status_code": 200,
  "timestamp": "2026-09-14T00:15:10Z",
  "data": {
    "analysis_id": "req_20260914_0600_a1b2c3",       // required
    "response_language": "en",                        // required
    "primary_intent": "point_safety",                  // required
    "location": {                                       // required — shared/Location.json
      "original": { "name": "Off Chennai", "lat": 13.0827, "lon": 80.5 },
      "validated": { "lat": 13.0827, "lon": 80.5, "snapped": false, "snap_distance_km": null, "snap_reference": null }
    },
    "time_window": {                                     // required — see §5 for the format
      "local": "2026-09-14T06:00:00+05:30/2026-09-14T10:00:00+05:30",
      "utc": "2026-09-14T00:30:00Z/2026-09-14T04:30:00Z",
      "original_expression": "tomorrow morning",
      "matched_bucket": "morning"
    },
    "sampling": { "mode": "local_grid" },                // required. mode enum: single_point|local_grid|regional_scan|route_corridor|historical
    "selected_agents": [                                   // required
      { "agent": "weather", "reason": "mandatory for any safety verdict", "mandatory_by_policy": true }
    ],
    "stages": ["risk", "decision"],                        // required. enum values ONLY: risk|decision|route|trend|report — NOT agent names
    "points": [                                             // sampled points, see PointObservation below
      { "point_id": "P1", "lat": 13.0827, "lon": 80.5, "point_status": "analysed", "land_sea": "sea" }
    ]
  }
}
```

**Watch out for `stages`** — its enum is the small set of *final* stages (`risk|decision|route|trend|report`), not a list of agent names. Don't put `"weather"` or `"planner"` in there.

**`PointObservation` required fields:** `point_id`, `lat`, `lon`, `point_status`, `land_sea`. A land point inside a valid sampling grid is `point_status: "not_applicable"` — that's correct, not an error, and the Backend expects it (never drop the point from the array).

### 4.2 — Reporting an agent's data (e.g. weather, ocean, tide)

```jsonc
{
  "analysis_id": "req_20260914_0600_a1b2c3",
  "agent": "weather",
  "status": "completed",
  "status_code": 200,
  "timestamp": "2026-09-14T00:15:20Z",
  "data": {
    "analysis_id": "req_20260914_0600_a1b2c3",
    "agent_name": "weather",
    "status": "completed",
    "normalized": {
      "P1": {
        "measurements": {
          "wind_speed_ms": {
            "value": 7.8, "unit": "m/s", "source": "IMD",
            "product_id": "IMD-FC-v1",
            "retrieved_at": "2026-09-13T02:00:00Z",
            "valid_time": "2026-09-14T01:00:00Z",
            "observation_type": "forecast",
            "status": "available",
            "freshness": { "state": "fresh" },
            "confidence": 0.8
          }
        }
      }
    }
  }
}
```

**`normalized` is a MAP keyed by `point_id`**, each holding a `measurements` MAP keyed by canonical parameter name (`wind_speed_ms`, `wave_height_m`, etc. — see `shared-config/canonical-units.json` for the exact keys and required units).

**`Measurement` required fields:** `value`, `status`, `freshness`, `source`. `status` is from `DataFieldStatus`: `available | partial | missing | not_mapped | derived`.

**Never-fabricate rule, strictly enforced on the Backend side:**
- `value` must be `null` whenever `status` is `"missing"`.
- `source` and `retrieved_at` must be `null` when `status` is `"missing"` or `"not_mapped"` — there is no source for data that was never retrieved. Do not put a placeholder string here.
- `missing` = the source was queried and returned nothing. `not_mapped` = your adapter has no mapping for this field yet. These are different and both matter — don't collapse one into the other.
- Every value must already be in the canonical unit (e.g. `wind_speed_ms` must always be m/s, `wave_height_m` always metres). If your adapter received a different unit, convert it *before* sending — the Backend does not convert units, it treats a mismatch as a bug.

If an agent covers only some of the sampled points (e.g. GIS skipping land points), just omit the uncovered `point_id` keys from `normalized` — don't invent an entry for them.

### 4.3 — Reporting an agent failure

```jsonc
{
  "analysis_id": "req_20260914_0600_a1b2c3",
  "agent": "tide",
  "status": "failed",
  "status_code": 504,
  "timestamp": "2026-09-14T00:15:25Z",
  "error": { "error_category": "upstream_unavailable", "message": "INCOIS tide endpoint timeout" }
}
```

A failed agent does not end the analysis — the pipeline continues with whatever evidence it has, and the Backend records the failure with its category. See §6 for `error_category` values.

### 4.4 — Reporting risk assessment (agent: `"risk"`)

```jsonc
{
  "analysis_id": "req_20260914_0600_a1b2c3",
  "agent": "risk",
  "status": "completed",
  "status_code": 200,
  "timestamp": "2026-09-14T00:15:40Z",
  "data": {
    "analysis_id": "req_20260914_0600_a1b2c3",
    "results": [
      {
        "point_id": "P1",                    // required
        "baseline_score": 42,                 // required. integer
        "llm_adjustment": 3,
        "adjustment_reason": "Short steep swell period raises small-craft risk.",
        "official_warnings": [],
        "hard_rules_applied": [],
        "constraint_floor": null,
        "final_score": 45,                    // required
        "risk_level": "CAUTION",              // required. UPPERCASE: SAFE|CAUTION|UNSAFE|DANGEROUS
        "risk_factors": [],
        "reasoning": "Moderate winds, no official warning in force.",   // required
        "key_findings": ["Wind 7.8 m/s", "Tide data unavailable"],
        "hourly_scores": [                    // required. array, note field is "time" not "hour"
          { "time": "2026-09-14T01:00:00Z", "score": 42 }
        ],
        "confidence": 0.7,                    // required
        "llm_interpretation_unavailable": false
      }
    ]
  }
}
```

**`risk_level` is UPPERCASE, everywhere in this system, no exceptions.** `SAFE|CAUTION|UNSAFE|DANGEROUS`. This applies to every risk-level field in every payload — `RiskAssessment.risk_level`, `Decision.point_scores[].risk_level`, `Decision.best_time_windows[].level`, alert subscription `minimum_level`, alert event `level`.

**Baseline score rule:** `baseline_score` should be the *worst* (maximum) hourly score across computable hours, not an average. One dangerous hour matters more than nine calm ones.

**`hourly_scores` items use `time`, not `hour`.** Easy typo, causes a hard validation failure.

---

## 5. `TimeWindow` — the one shape that looks nothing like you'd expect

`time_window` (inside the plan, and anywhere else it appears) is **not** a nested object with separate date/start/end fields. It's an **ISO 8601 interval string**: two datetimes joined by a slash.

```json
{
  "local": "2026-09-14T06:00:00+05:30/2026-09-14T10:00:00+05:30",
  "utc":   "2026-09-14T00:30:00Z/2026-09-14T04:30:00Z",
  "original_expression": "tomorrow morning",
  "matched_bucket": "morning"
}
```

Build the string as `<start-iso>/<end-iso>` — no brackets, no separate keys. `local` carries the offset (`+05:30`); `utc` is always `Z`. `original_expression` and `matched_bucket` are optional but useful for explainability — fill them when you can.

Do not confuse this with the *raw* `time_range` field on the inbound `AnalysisRequest` (`{ "start": "06:00", "end": "10:00" }`) — that's the user's pre-interpretation input, a completely different shape. `TimeWindow` is *your* resolved output.

---

## 6. Errors — `ErrorInfo`, used everywhere

```json
{ "error_category": "upstream_unavailable", "message": "INCOIS tide endpoint timeout", "http_status": null, "retry_count": null }
```

Required: `error_category`, `message`. The full enum (this is the complete, locked list — don't invent new categories):

| Category | Use it when |
|---|---|
| `invalid_location` | A coordinate is out of range (this one's mostly the Backend's job) |
| `unsupported_region` | The location is real but outside your data coverage |
| `unresolvable_place` | A place name couldn't be geocoded at all |
| `unsupported_time` | The requested window is outside your forecast horizon |
| `planner_failure` | Your planning stage itself broke |
| `risk_failure` | Your risk-scoring stage broke |
| `validation_failure` | Malformed input reached you somehow |
| `upstream_unavailable` | A data source (INCOIS, IMD, etc.) is down or timed out |
| `timeout` | You exceeded your own time budget on a stage |
| `internal_error` | Anything else unexpected |

---

## 7. Step 3 — You send the final result, exactly once

`POST http://<backend>:4100/internal/v1/result`

This is the **last** call for an analysis. It carries **only the final artefact** — never agent results, never risk assessments, never the execution trace. Those all went through `/progress` already (§4). Sending them again here does nothing; the endpoint doesn't read them.

### Request body — `InternalResultPayload`

```jsonc
{
  "analysis_id": "req_20260914_0600_a1b2c3",   // required
  "final_stage": "decision",                     // required. enum: decision|route|trend|report|quick_information
  "status": "completed",                         // required. enum: completed|partial|failed — NOTE: narrower than the full lifecycle; never send queued/running here
  "error": null,                                  // ErrorInfo|null
  "decision": { /* ... */ },                      // exactly ONE of these five matching final_stage
  "route_result": null,
  "trend_result": null,
  "report_content": null,
  "quick_information_result": null
}
```

**Exactly one** of `decision` / `route_result` / `trend_result` / `report_content` / `quick_information_result` must be non-null, and it must match `final_stage`. All the others stay `null`.

**Idempotency:** if the Backend already marked this `analysis_id` terminal (`completed`/`partial`/`failed`), a repeated call is silently ignored. Safe to retry on your side if you're unsure whether the first call landed.

**`status: "partial"`** is the honest answer when some evidence is missing (e.g. an agent failed) but you can still produce a real recommendation. Don't upgrade it to `"completed"` just because you produced *something* — the Backend surfaces `partial` as HTTP `206` to the Frontend specifically so it can show "some data unavailable."

### The `Decision` object, in full (final_stage = `"decision"`)

```jsonc
{
  "analysis_id": "req_20260914_0600_a1b2c3",       // required
  "response_language": "en",                        // required
  "generated_at": "2026-09-14T00:16:00Z",
  "recommendation_type": "go_with_caution",           // required. enum: go|go_with_caution|go_in_safer_window|not_recommended|do_not_venture
  "one_line_recommendation": "Conditions are marginal - stay close to shore and return before noon.",  // required
  "detailed_recommendation": "Winds are moderate...", // required
  "key_findings": {                                    // STRUCTURED OBJECT, not a string array
    "safest_allowed_point": "P1",
    "highest_risk_point": "P2",
    "major_hazard": "Rising wind offshore",
    "official_warning_status": null,
    "gis_restriction": null,
    "pfz_opportunity": null,
    "best_time": null,
    "main_uncertainty": "Tide data unavailable",
    "additional_findings": ["Wind 7.8 m/s near shore"]
  },
  "preferred_point": "P1",                             // a point_id STRING, not the point object
  "preferred_point_reason": "Lowest risk, closest to shore.",
  "worst_point": "P2",                                 // also a point_id STRING
  "worst_point_causes": ["wind_speed_ms"],
  "excluded_points": [                                  // points ruled out by a hard constraint
    { "point_id": "P3", "reason": "not_applicable" }    // reason enum: not_applicable|gis_prohibited|dangerous
  ],
  "best_time_windows": [
    { "start": "2026-09-14T01:00:00Z", "end": "2026-09-14T03:00:00Z", "max_score": 45, "level": "CAUTION", "applies_to_point": "P1" }
  ],
  "point_scores": [ /* array of full RiskAssessment objects, see §4.4 — copied verbatim, never re-derived */ ]
}
```

**The two things that trip people up here:**
1. `key_findings` is a **structured object** with named fields, not `["string", "string"]`. Get this wrong and you'll get a Mongoose cast error on the Backend side.
2. `preferred_point` / `worst_point` are **point_id strings**, not the full point object. If you want to show *why*, that's what `preferred_point_reason` / `worst_point_causes` are for.

`recommendation_type` enum is `go|go_with_caution|go_in_safer_window|not_recommended|do_not_venture` — not `proceed`/`avoid`/anything else you might guess.

`point_scores` should be the exact same `RiskAssessment` objects you already sent via `/progress` — copy them in, don't recompute or reshape them.

### `RouteResult` (final_stage = `"route"`) — the short version

Required: `route_id`, `status`, `origin`, `destination`, `vessel_type`. `status` enum: `queued|running|completed|no_safe_route|failed` — note `no_safe_route`, not `partial`. `blocking_reasons` is an array of **plain strings** (free text describing why no path exists), not structured objects. `origin`/`destination` here should be a resolved `Location` object (with `original`/`validated`), not the raw request shape.

Ask if you need the full RouteResult/TrendResult/ReportContent shapes spelled out — happy to expand any of these the same way as Decision above.

---

## 8. Quick reference — naming traps that will break integration

| Wrong (easy mistake) | Right |
|---|---|
| flat `lat`/`lon` on a request | nested `coordinate: { lat, lon }` |
| `start_time`/`end_time` | `time_range: { start, end }` (raw) or `TimeWindow` interval string (resolved) |
| `language` | `language_override` |
| `stage` on a progress message | `agent` |
| lowercase risk levels (`caution`, `unsafe`) | UPPERCASE (`CAUTION`, `UNSAFE`) |
| `key_findings` as a string array | structured object with named fields |
| `preferred_point` as an object | a point_id string |
| `hour` in hourly_scores | `time` |
| sending agent results in the final `/result` call | agent results only go through `/progress` |
| `minimum_level: "unsafe"` | `minimum_level: "UNSAFE"` |

---

## 9. How to test this without waiting on either side

The Backend repo includes `stub-ai-service.js` — a 20-line stand-in that accepts the handoff and does nothing else. Run it while building your real service to confirm your `/progress` and `/result` calls land correctly, without needing the real pipeline finished on either end.

Conversely, once your service returns real `202`s on `/v1/analysis/execute`, you can drive the Backend's `/analysis` endpoint from Postman and watch your service receive real traffic — that's the fastest way to catch a shape mismatch early.
