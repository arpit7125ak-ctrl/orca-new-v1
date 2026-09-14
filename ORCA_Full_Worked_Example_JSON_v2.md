# ORCA — Full Worked Example (Current Schema Set, All 9 Points, Every Stage)
 
Companion to the 44-file `contracts/` set built across this conversation. That set defines the shapes; this file traces **one real request, start to finish**, with every JSON body filled in and independently validated against its actual schema file before being placed here — nothing shown here is hand-waved.
 
**Format note:** this mirrors the structure of your earlier `ORCA_Full_Worked_Example_JSON.md` (stage-by-stage, one full agent call then a merged array, `[...as above...]` collapsing for repeated large blocks, a corrections section at the end) at your request. The field names, enums, and object shapes are **not** carried over from that file — they come from the current architecture doc and the schemas built in this conversation. Where the two genuinely disagree, it's called out explicitly rather than silently resolved.
 
**Scenario:** Fisherman near Mumbai, activity `fishing`, place name "Mumbai" (not a coordinate — demonstrates geocoding + offshore snapping), query "Is it safe to fish tomorrow morning near Mumbai?", vessel type not specified (demonstrates the conservative-default-assumption rule). Request received 2026-09-12T09:15:00Z; target window is tomorrow morning IST.
 
Note on agent envelopes: `weather`/`ocean`/`gis` are each invoked once per point (9 calls) or once regionally (tide-style shared fetch). Showing 9 near-identical envelopes per agent would just repeat boilerplate, so each agent section shows the full wrapped shape for one field, then the complete merged 9-point array as it lands in `AgentResult.normalized.by_point`.
 
---
 
## STAGE 1 — Frontend → Backend
 
**`POST /api/v1/analysis` request body — validates against `contracts/AnalysisRequest.json`:**
```json
{
  "query": "Is it safe to fish tomorrow morning near Mumbai?",
  "coordinate": null,
  "place_name": "Mumbai",
  "date": null,
  "time_range": null,
  "activity": "fishing",
  "vessel_type": null,
  "origin": null,
  "destination": null,
  "language_override": null,
  "conversation_id": null,
  "parent_analysis_id": null
}
```
The user gave a place name and free text, not a coordinate or structured date/time — this is the path that exercises geocoding, offshore snapping, and natural-language time parsing downstream.
 
**Backend generates `analysis_id` and forwards the structurally-validated request unchanged — Backend never reshapes it, only checks §7's structural rules.**
 
**202 Accepted response to Frontend — validates against `contracts/api/AnalysisCreatedResponse.json`:**
```json
{
  "analysis_id": "req_20260912_0915_f4e9d1",
  "status": "queued",
  "status_url": "/api/v1/analysis/req_20260912_0915_f4e9d1/status"
}
```
 
---
 
## STAGE 2 — Backend → AI Service
 
**Backend-assigned analysis_id used from here on: `req_20260912_0915_f4e9d1`**
*(Format note, now RESOLVED: uses your locked `req_{YYYYMMDD}_{HHMM}_{hash}` convention, not the doc's own `an_7f3c...` example. The date/time embedded is the request's UTC receipt time (2026-09-12 09:15), not the target analysis window (tomorrow 06:00) — the target window can't be used because it's often unresolved at ID-generation time: this request said "tomorrow morning" in free text, which the Planner doesn't parse until after the Backend has already had to assign an id. An earlier draft of this file used target-window time; that was wrong for exactly this reason and has been corrected.)*
 
**Body handed to the AI Service — validates against `contracts/api/AnalysisExecutionRequest.json`:**
```json
{
  "analysis_id": "req_20260912_0915_f4e9d1",
  "conversation_id": null,
  "parent_analysis_id": null,
  "alert_subscription_id": null,
  "request": {
    "query": "Is it safe to fish tomorrow morning near Mumbai?",
    "coordinate": null,
    "place_name": "Mumbai",
    "date": null,
    "time_range": null,
    "activity": "fishing",
    "vessel_type": null,
    "origin": null,
    "destination": null,
    "language_override": null,
    "conversation_id": null,
    "parent_analysis_id": null
  }
}
```
 
**`analyses` collection document created immediately, status `queued` — validates against `contracts/db/AnalysesDocument.json`:**
```json
{
  "analysis_id": "req_20260912_0915_f4e9d1",
  "conversation_id": null,
  "parent_analysis_id": null,
  "alert_subscription_id": null,
  "request": {
    "query": "Is it safe to fish tomorrow morning near Mumbai?",
    "coordinate": null,
    "place_name": "Mumbai",
    "date": null,
    "time_range": null,
    "activity": "fishing",
    "vessel_type": null,
    "origin": null,
    "destination": null,
    "language_override": null,
    "conversation_id": null,
    "parent_analysis_id": null
  },
  "plan": null,
  "status": "queued",
  "error": null,
  "points": [],
  "created_at": "2026-09-12T09:15:00Z",
  "completed_at": null
}
```
 
---
 
## STAGE 2.5 — Live Status Polling (while Stage 3 runs)
 
Frontend polls `GET /api/v1/analysis/:analysis_id/status` every 1-2s. Note the **two deliberately different status enums** in play — `status` (analysis-level, 5 values, no `skipped`) vs `agent_statuses[].status` (per-agent, 6 values, includes `skipped`). Collapsing these into one enum was an actual bug caught while building the contract set — kept separate here on purpose.
 
**AI Service → Backend internal push after each node completes — validates against `contracts/ProgressMessage.json`:**
```json
{
  "analysis_id": "req_20260912_0915_f4e9d1",
  "agent": "planner",
  "status": "completed",
  "status_code": 200,
  "timestamp": "2026-09-12T09:15:02Z",
  "selection_reason": null,
  "data_ref": null,
  "data": null,
  "error": null,
  "metadata": null
}
```
```json
{
  "analysis_id": "req_20260912_0915_f4e9d1",
  "agent": "weather",
  "status": "completed",
  "status_code": 200,
  "timestamp": "2026-09-12T09:15:06Z",
  "selection_reason": null,
  "data_ref": "agent_results/req_20260912_0915_f4e9d1/weather",
  "data": null,
  "error": null,
  "metadata": null
}
```
```json
{
  "analysis_id": "req_20260912_0915_f4e9d1",
  "agent": "ocean",
  "status": "partial",
  "status_code": 206,
  "timestamp": "2026-09-12T09:15:09Z",
  "selection_reason": null,
  "data_ref": "agent_results/req_20260912_0915_f4e9d1/ocean",
  "data": null,
  "error": {
    "error_category": "upstream_unavailable",
    "message": "INCOIS OSF wave/SST/salinity/current not mapped for this coordinate; tide retrieved.",
    "http_status": null,
    "retry_count": 1
  },
  "metadata": null
}
```
Backend writes each of these straight onto the `analyses` document's in-progress state — no reshaping.
 
**`GET /api/v1/analysis/req_20260912_0915_f4e9d1/status` — t=0, just queued — validates against `contracts/api/AnalysisStatusResponse.json`:**
```json
{
  "analysis_id": "req_20260912_0915_f4e9d1",
  "status": "queued",
  "error": null,
  "plan_summary": null,
  "agent_statuses": [
    {
      "agent": "planner",
      "status": "queued",
      "selection_reason": null
    },
    {
      "agent": "weather",
      "status": "queued",
      "selection_reason": null
    },
    {
      "agent": "ocean",
      "status": "queued",
      "selection_reason": null
    },
    {
      "agent": "gis",
      "status": "queued",
      "selection_reason": null
    },
    {
      "agent": "risk",
      "status": "queued",
      "selection_reason": null
    },
    {
      "agent": "decision",
      "status": "queued",
      "selection_reason": null
    }
  ],
  "skipped_agents": []
}
```
 
**Same endpoint, mid-run — planner and weather done, ocean partial, gis running, risk/decision still queued:**
```json
{
  "analysis_id": "req_20260912_0915_f4e9d1",
  "status": "running",
  "error": null,
  "plan_summary": {
    "primary_intent": "point_safety",
    "response_language": "en",
    "location_summary": "Offshore point near Mumbai (snapped 6.8km from the queried coastal location)",
    "time_window_summary": "Tomorrow morning, 06:00-11:00 IST"
  },
  "agent_statuses": [
    {
      "agent": "planner",
      "status": "completed",
      "selection_reason": null
    },
    {
      "agent": "weather",
      "status": "completed",
      "selection_reason": "Mandatory for any safety request."
    },
    {
      "agent": "ocean",
      "status": "partial",
      "selection_reason": "Mandatory for any safety request."
    },
    {
      "agent": "gis",
      "status": "running",
      "selection_reason": "Mandatory geofence/MPA/restricted-zone check for a safety request."
    },
    {
      "agent": "risk",
      "status": "queued",
      "selection_reason": null
    },
    {
      "agent": "decision",
      "status": "queued",
      "selection_reason": null
    }
  ],
  "skipped_agents": [
    {
      "agent": "tide",
      "reason": "Fishing at these points doesn't depend on tide height; not required for a general safety check.",
      "mandatory_by_policy": false
    },
    {
      "agent": "ecosystem",
      "reason": "Query intent is safety, not fishing-zone or ecosystem discovery.",
      "mandatory_by_policy": false
    },
    {
      "agent": "cyclone",
      "reason": "No active cyclone advisory for this region/season at request time.",
      "mandatory_by_policy": false
    },
    {
      "agent": "pfz",
      "reason": "Query intent is safety, not potential-fishing-zone discovery.",
      "mandatory_by_policy": false
    }
  ]
}
```
Frontend stops polling `/status` once `status` reaches `completed` and switches to `GET /api/v1/analysis/:id` (Stage 4/5) exactly once.
 
---
 
## STAGE 3 — AI Service Internal Pipeline
 
### 3.1 Planner — full output, all 9 points
 
**Validates against `contracts/ExecutionPlan.json`:**
```json
{
  "analysis_id": "req_20260912_0915_f4e9d1",
  "response_language": "en",
  "language_detection": {
    "detected_language": "en",
    "script": "Latin",
    "is_romanized": false,
    "is_code_mixed": false,
    "detection_confidence": 0.98,
    "override_language": null
  },
  "primary_intent": "point_safety",
  "secondary_intents": [],
  "location": {
    "original": {
      "name": "Mumbai",
      "lat": 18.922,
      "lon": 72.8347
    },
    "validated": {
      "lat": 19.05,
      "lon": 72.87,
      "snapped": true,
      "snap_distance_km": 6.8,
      "snap_reference": "offshore, west of Mumbai coastline"
    }
  },
  "time_window": {
    "local": "2026-09-13T06:00:00+05:30/2026-09-13T11:00:00+05:30",
    "utc": "2026-09-13T00:30:00Z/2026-09-13T05:30:00Z",
    "original_expression": "tomorrow morning",
    "matched_bucket": "morning"
  },
  "activity": "fishing",
  "vessel_type": "motorized_country_craft",
  "vessel_assumed": true,
  "sampling": {
    "mode": "local_grid",
    "radius_km": 5,
    "spacing_km": null,
    "shape": "circular",
    "points": 9
  },
  "selected_agents": [
    {
      "agent": "weather",
      "reason": "Mandatory for any safety request.",
      "mandatory_by_policy": true
    },
    {
      "agent": "ocean",
      "reason": "Mandatory for any safety request.",
      "mandatory_by_policy": true
    },
    {
      "agent": "gis",
      "reason": "Mandatory geofence/MPA/restricted-zone check for a safety request.",
      "mandatory_by_policy": true
    }
  ],
  "skipped_agents": [
    {
      "agent": "tide",
      "reason": "Fishing at these points doesn't depend on tide height; not required for a general safety check.",
      "mandatory_by_policy": false
    },
    {
      "agent": "ecosystem",
      "reason": "Query intent is safety, not fishing-zone or ecosystem discovery.",
      "mandatory_by_policy": false
    },
    {
      "agent": "cyclone",
      "reason": "No active cyclone advisory for this region/season at request time.",
      "mandatory_by_policy": false
    },
    {
      "agent": "pfz",
      "reason": "Query intent is safety, not potential-fishing-zone discovery.",
      "mandatory_by_policy": false
    }
  ],
  "data_plan": [
    {
      "parameter": "wind_speed_kn",
      "agent": "weather",
      "preferred_source": "Open-Meteo Marine",
      "fallback_sources": [
        "IMD"
      ],
      "spatial_resolution": "point",
      "temporal_resolution": "hourly",
      "freshness_requirement": "< 3h",
      "historical_availability": true
    },
    {
      "parameter": "wave_height_m",
      "agent": "ocean",
      "preferred_source": "INCOIS OSF",
      "fallback_sources": [
        "Copernicus Marine"
      ],
      "spatial_resolution": "point",
      "temporal_resolution": "hourly",
      "freshness_requirement": "< 6h",
      "historical_availability": true
    }
  ],
  "stages": [
    "risk",
    "decision"
  ]
}
```
Two things worth pointing at: `vessel_assumed: true` — no vessel type was given, so the Planner applied the most conservative configured profile (§7.7), and that assumption is carried through to the Decision text at the end. And `location.validated.snapped: true` — "Mumbai" resolved to a land point, so ORCA moved the analysis offshore and recorded both coordinates, never silently substituting one for the other.
 
### 3.2 Weather Agent
 
**Points layout, all 9 — validates against `contracts/PointObservation.json` per point:**
```json
[
  {
    "point_id": "P0",
    "lat": 19.05,
    "lon": 72.87,
    "bearing_deg": null,
    "distance_km": 0,
    "point_status": "applicable",
    "land_sea": "sea"
  },
  {
    "point_id": "P1",
    "lat": 19.095,
    "lon": 72.87,
    "bearing_deg": 0,
    "distance_km": 5,
    "point_status": "applicable",
    "land_sea": "sea"
  },
  {
    "point_id": "P2",
    "lat": 19.082,
    "lon": 72.904,
    "bearing_deg": 45,
    "distance_km": 5,
    "point_status": "applicable",
    "land_sea": "sea"
  },
  {
    "point_id": "P3",
    "lat": 19.05,
    "lon": 72.918,
    "bearing_deg": 90,
    "distance_km": 5,
    "point_status": "applicable",
    "land_sea": "sea"
  },
  {
    "point_id": "P4",
    "lat": 19.018,
    "lon": 72.904,
    "bearing_deg": 135,
    "distance_km": 5,
    "point_status": "applicable",
    "land_sea": "sea"
  },
  {
    "point_id": "P5",
    "lat": 19.005,
    "lon": 72.87,
    "bearing_deg": 180,
    "distance_km": 5,
    "point_status": "applicable",
    "land_sea": "sea"
  },
  {
    "point_id": "P6",
    "lat": 19.018,
    "lon": 72.836,
    "bearing_deg": 225,
    "distance_km": 5,
    "point_status": "applicable",
    "land_sea": "sea"
  },
  {
    "point_id": "P7",
    "lat": 19.05,
    "lon": 72.822,
    "bearing_deg": 270,
    "distance_km": 5,
    "point_status": "applicable",
    "land_sea": "sea"
  },
  {
    "point_id": "P8",
    "lat": 19.082,
    "lon": 72.836,
    "bearing_deg": 315,
    "distance_km": 5,
    "point_status": "applicable",
    "land_sea": "sea"
  }
]
```
 
**One full field, fully wrapped — `wind_speed_kn` at P1 — validates against `contracts/Measurement.json`:**
```json
{
  "parameter": null,
  "value": 18.5,
  "unit": "kn",
  "source": "Open-Meteo Marine",
  "product_id": null,
  "retrieved_at": "2026-09-12T09:15:04Z",
  "valid_time": "2026-09-13T03:00:00Z",
  "observation_type": "forecast",
  "status": "available",
  "freshness": {
    "state": "fresh",
    "age_hours": 0.1,
    "max_age_hours": 3
  },
  "confidence": null,
  "official_source": null
}
```
 
**Merged state after all 9 calls — validates against `contracts/AgentResult.json`:**
```json
{
  "analysis_id": "req_20260912_0915_f4e9d1",
  "agent_name": "weather",
  "status": "completed",
  "started_at": "2026-09-12T09:15:02Z",
  "completed_at": "2026-09-12T09:15:06Z",
  "duration_ms": 4000,
  "retry_count": 0,
  "error": null,
  "normalized": {
    "by_point": {
      "P0": {
        "wind_speed_kn": {
          "parameter": null,
          "value": 16.0,
          "unit": "kn",
          "source": "Open-Meteo Marine",
          "product_id": null,
          "retrieved_at": "2026-09-12T09:15:04Z",
          "valid_time": "2026-09-13T03:00:00Z",
          "observation_type": "forecast",
          "status": "available",
          "freshness": {
            "state": "fresh",
            "age_hours": 0.1,
            "max_age_hours": 3
          },
          "confidence": null,
          "official_source": null
        },
        "visibility_km": {
          "parameter": null,
          "value": 10,
          "unit": "km",
          "source": "Open-Meteo Marine",
          "product_id": null,
          "retrieved_at": "2026-09-12T09:15:04Z",
          "valid_time": "2026-09-13T03:00:00Z",
          "observation_type": "forecast",
          "status": "available",
          "freshness": {
            "state": "fresh",
            "age_hours": 0.1,
            "max_age_hours": 3
          },
          "confidence": null,
          "official_source": null
        }
      },
      "P1": {
        "wind_speed_kn": {
          "parameter": null,
          "value": 18.5,
          "unit": "kn",
          "source": "Open-Meteo Marine",
          "product_id": null,
          "retrieved_at": "2026-09-12T09:15:04Z",
          "valid_time": "2026-09-13T03:00:00Z",
          "observation_type": "forecast",
          "status": "available",
          "freshness": {
            "state": "fresh",
            "age_hours": 0.1,
            "max_age_hours": 3
          },
          "confidence": null,
          "official_source": null
        },
        "visibility_km": {
          "parameter": null,
          "value": 10,
          "unit": "km",
          "source": "Open-Meteo Marine",
          "product_id": null,
          "retrieved_at": "2026-09-12T09:15:04Z",
          "valid_time": "2026-09-13T03:00:00Z",
          "observation_type": "forecast",
          "status": "available",
          "freshness": {
            "state": "fresh",
            "age_hours": 0.1,
            "max_age_hours": 3
          },
          "confidence": null,
          "official_source": null
        }
      },
      "P2": {
        "wind_speed_kn": {
          "parameter": null,
          "value": 9.5,
          "unit": "kn",
          "source": "Open-Meteo Marine",
          "product_id": null,
          "retrieved_at": "2026-09-12T09:15:04Z",
          "valid_time": "2026-09-13T03:00:00Z",
          "observation_type": "forecast",
          "status": "available",
          "freshness": {
            "state": "fresh",
            "age_hours": 0.1,
            "max_age_hours": 3
          },
          "confidence": null,
          "official_source": null
        },
        "visibility_km": {
          "parameter": null,
          "value": 10,
          "unit": "km",
          "source": "Open-Meteo Marine",
          "product_id": null,
          "retrieved_at": "2026-09-12T09:15:04Z",
          "valid_time": "2026-09-13T03:00:00Z",
          "observation_type": "forecast",
          "status": "available",
          "freshness": {
            "state": "fresh",
            "age_hours": 0.1,
            "max_age_hours": 3
          },
          "confidence": null,
          "official_source": null
        }
      },
      "P3": {
        "wind_speed_kn": {
          "parameter": null,
          "value": 26.0,
          "unit": "kn",
          "source": "Open-Meteo Marine",
          "product_id": null,
          "retrieved_at": "2026-09-12T09:15:04Z",
          "valid_time": "2026-09-13T03:00:00Z",
          "observation_type": "forecast",
          "status": "available",
          "freshness": {
            "state": "fresh",
            "age_hours": 0.1,
            "max_age_hours": 3
          },
          "confidence": null,
          "official_source": null
        },
        "visibility_km": {
          "parameter": null,
          "value": 6,
          "unit": "km",
          "source": "Open-Meteo Marine",
          "product_id": null,
          "retrieved_at": "2026-09-12T09:15:04Z",
          "valid_time": "2026-09-13T03:00:00Z",
          "observation_type": "forecast",
          "status": "available",
          "freshness": {
            "state": "fresh",
            "age_hours": 0.1,
            "max_age_hours": 3
          },
          "confidence": null,
          "official_source": null
        }
      },
      "P4": {
        "wind_speed_kn": {
          "parameter": null,
          "value": 20.0,
          "unit": "kn",
          "source": "Open-Meteo Marine",
          "product_id": null,
          "retrieved_at": "2026-09-12T09:15:04Z",
          "valid_time": "2026-09-13T03:00:00Z",
          "observation_type": "forecast",
          "status": "available",
          "freshness": {
            "state": "fresh",
            "age_hours": 0.1,
            "max_age_hours": 3
          },
          "confidence": null,
          "official_source": null
        },
        "visibility_km": {
          "parameter": null,
          "value": 10,
          "unit": "km",
          "source": "Open-Meteo Marine",
          "product_id": null,
          "retrieved_at": "2026-09-12T09:15:04Z",
          "valid_time": "2026-09-13T03:00:00Z",
          "observation_type": "forecast",
          "status": "available",
          "freshness": {
            "state": "fresh",
            "age_hours": 0.1,
            "max_age_hours": 3
          },
          "confidence": null,
          "official_source": null
        }
      },
      "P5": {
        "wind_speed_kn": {
          "parameter": null,
          "value": 10.5,
          "unit": "kn",
          "source": "Open-Meteo Marine",
          "product_id": null,
          "retrieved_at": "2026-09-12T09:15:04Z",
          "valid_time": "2026-09-13T03:00:00Z",
          "observation_type": "forecast",
          "status": "available",
          "freshness": {
            "state": "fresh",
            "age_hours": 0.1,
            "max_age_hours": 3
          },
          "confidence": null,
          "official_source": null
        },
        "visibility_km": {
          "parameter": null,
          "value": 10,
          "unit": "km",
          "source": "Open-Meteo Marine",
          "product_id": null,
          "retrieved_at": "2026-09-12T09:15:04Z",
          "valid_time": "2026-09-13T03:00:00Z",
          "observation_type": "forecast",
          "status": "available",
          "freshness": {
            "state": "fresh",
            "age_hours": 0.1,
            "max_age_hours": 3
          },
          "confidence": null,
          "official_source": null
        }
      },
      "P6": {
        "wind_speed_kn": {
          "parameter": null,
          "value": 15.0,
          "unit": "kn",
          "source": "Open-Meteo Marine",
          "product_id": null,
          "retrieved_at": "2026-09-12T09:15:04Z",
          "valid_time": "2026-09-13T03:00:00Z",
          "observation_type": "forecast",
          "status": "available",
          "freshness": {
            "state": "fresh",
            "age_hours": 0.1,
            "max_age_hours": 3
          },
          "confidence": null,
          "official_source": null
        },
        "visibility_km": {
          "parameter": null,
          "value": 10,
          "unit": "km",
          "source": "Open-Meteo Marine",
          "product_id": null,
          "retrieved_at": "2026-09-12T09:15:04Z",
          "valid_time": "2026-09-13T03:00:00Z",
          "observation_type": "forecast",
          "status": "available",
          "freshness": {
            "state": "fresh",
            "age_hours": 0.1,
            "max_age_hours": 3
          },
          "confidence": null,
          "official_source": null
        }
      },
      "P7": {
        "wind_speed_kn": {
          "parameter": null,
          "value": 10.0,
          "unit": "kn",
          "source": "Open-Meteo Marine",
          "product_id": null,
          "retrieved_at": "2026-09-12T09:15:04Z",
          "valid_time": "2026-09-13T03:00:00Z",
          "observation_type": "forecast",
          "status": "available",
          "freshness": {
            "state": "fresh",
            "age_hours": 0.1,
            "max_age_hours": 3
          },
          "confidence": null,
          "official_source": null
        },
        "visibility_km": {
          "parameter": null,
          "value": 10,
          "unit": "km",
          "source": "Open-Meteo Marine",
          "product_id": null,
          "retrieved_at": "2026-09-12T09:15:04Z",
          "valid_time": "2026-09-13T03:00:00Z",
          "observation_type": "forecast",
          "status": "available",
          "freshness": {
            "state": "fresh",
            "age_hours": 0.1,
            "max_age_hours": 3
          },
          "confidence": null,
          "official_source": null
        }
      },
      "P8": {
        "wind_speed_kn": {
          "parameter": null,
          "value": 17.5,
          "unit": "kn",
          "source": "Open-Meteo Marine",
          "product_id": null,
          "retrieved_at": "2026-09-12T09:15:04Z",
          "valid_time": "2026-09-13T03:00:00Z",
          "observation_type": "forecast",
          "status": "available",
          "freshness": {
            "state": "fresh",
            "age_hours": 0.1,
            "max_age_hours": 3
          },
          "confidence": null,
          "official_source": null
        },
        "visibility_km": {
          "parameter": null,
          "value": 10,
          "unit": "km",
          "source": "Open-Meteo Marine",
          "product_id": null,
          "retrieved_at": "2026-09-12T09:15:04Z",
          "valid_time": "2026-09-13T03:00:00Z",
          "observation_type": "forecast",
          "status": "available",
          "freshness": {
            "state": "fresh",
            "age_hours": 0.1,
            "max_age_hours": 3
          },
          "confidence": null,
          "official_source": null
        }
      }
    },
    "regional": null
  },
  "raw": null
}
```
Unit note: wind is in **knots** (`kn`), matching `shared/VesselProfile.json`'s threshold field name (`wind_kn`) — not m/s. This alignment is not enforced by any schema; it only holds here because the example was built that way on purpose. See the anomaly list at the end.
 
### 3.3 Ocean Agent — partial, wave/SST not mapped everywhere, tide fetched once regionally
 
**Validates against `contracts/AgentResult.json`:**
```json
{
  "analysis_id": "req_20260912_0915_f4e9d1",
  "agent_name": "ocean",
  "status": "partial",
  "started_at": "2026-09-12T09:15:06Z",
  "completed_at": "2026-09-12T09:15:09Z",
  "duration_ms": 3000,
  "retry_count": 1,
  "error": null,
  "normalized": {
    "by_point": {
      "P0": {
        "wave_height_m": {
          "parameter": null,
          "value": null,
          "unit": "m",
          "source": null,
          "product_id": null,
          "retrieved_at": null,
          "valid_time": "2026-09-13T00:30:00Z",
          "observation_type": "forecast",
          "status": "not_mapped",
          "freshness": {
            "state": "unknown",
            "age_hours": null,
            "max_age_hours": null
          },
          "confidence": null,
          "official_source": null
        },
        "sea_surface_temperature_c": {
          "parameter": null,
          "value": null,
          "unit": "degC",
          "source": null,
          "product_id": null,
          "retrieved_at": null,
          "valid_time": "2026-09-13T00:30:00Z",
          "observation_type": "forecast",
          "status": "not_mapped",
          "freshness": {
            "state": "unknown",
            "age_hours": null,
            "max_age_hours": null
          },
          "confidence": null,
          "official_source": null
        }
      },
      "P1": {
        "wave_height_m": {
          "parameter": null,
          "value": null,
          "unit": "m",
          "source": null,
          "product_id": null,
          "retrieved_at": null,
          "valid_time": "2026-09-13T00:30:00Z",
          "observation_type": "forecast",
          "status": "not_mapped",
          "freshness": {
            "state": "unknown",
            "age_hours": null,
            "max_age_hours": null
          },
          "confidence": null,
          "official_source": null
        },
        "sea_surface_temperature_c": {
          "parameter": null,
          "value": null,
          "unit": "degC",
          "source": null,
          "product_id": null,
          "retrieved_at": null,
          "valid_time": "2026-09-13T00:30:00Z",
          "observation_type": "forecast",
          "status": "not_mapped",
          "freshness": {
            "state": "unknown",
            "age_hours": null,
            "max_age_hours": null
          },
          "confidence": null,
          "official_source": null
        }
      },
      "P2": {
        "wave_height_m": {
          "parameter": null,
          "value": null,
          "unit": "m",
          "source": null,
          "product_id": null,
          "retrieved_at": null,
          "valid_time": "2026-09-13T00:30:00Z",
          "observation_type": "forecast",
          "status": "not_mapped",
          "freshness": {
            "state": "unknown",
            "age_hours": null,
            "max_age_hours": null
          },
          "confidence": null,
          "official_source": null
        },
        "sea_surface_temperature_c": {
          "parameter": null,
          "value": null,
          "unit": "degC",
          "source": null,
          "product_id": null,
          "retrieved_at": null,
          "valid_time": "2026-09-13T00:30:00Z",
          "observation_type": "forecast",
          "status": "not_mapped",
          "freshness": {
            "state": "unknown",
            "age_hours": null,
            "max_age_hours": null
          },
          "confidence": null,
          "official_source": null
        }
      },
      "P3": {
        "wave_height_m": {
          "parameter": null,
          "value": null,
          "unit": "m",
          "source": null,
          "product_id": null,
          "retrieved_at": null,
          "valid_time": "2026-09-13T00:30:00Z",
          "observation_type": "forecast",
          "status": "not_mapped",
          "freshness": {
            "state": "unknown",
            "age_hours": null,
            "max_age_hours": null
          },
          "confidence": null,
          "official_source": null
        },
        "sea_surface_temperature_c": {
          "parameter": null,
          "value": null,
          "unit": "degC",
          "source": null,
          "product_id": null,
          "retrieved_at": null,
          "valid_time": "2026-09-13T00:30:00Z",
          "observation_type": "forecast",
          "status": "not_mapped",
          "freshness": {
            "state": "unknown",
            "age_hours": null,
            "max_age_hours": null
          },
          "confidence": null,
          "official_source": null
        }
      },
      "P4": {
        "wave_height_m": {
          "parameter": null,
          "value": null,
          "unit": "m",
          "source": null,
          "product_id": null,
          "retrieved_at": null,
          "valid_time": "2026-09-13T00:30:00Z",
          "observation_type": "forecast",
          "status": "not_mapped",
          "freshness": {
            "state": "unknown",
            "age_hours": null,
            "max_age_hours": null
          },
          "confidence": null,
          "official_source": null
        },
        "sea_surface_temperature_c": {
          "parameter": null,
          "value": null,
          "unit": "degC",
          "source": null,
          "product_id": null,
          "retrieved_at": null,
          "valid_time": "2026-09-13T00:30:00Z",
          "observation_type": "forecast",
          "status": "not_mapped",
          "freshness": {
            "state": "unknown",
            "age_hours": null,
            "max_age_hours": null
          },
          "confidence": null,
          "official_source": null
        }
      },
      "P5": {
        "wave_height_m": {
          "parameter": null,
          "value": null,
          "unit": "m",
          "source": null,
          "product_id": null,
          "retrieved_at": null,
          "valid_time": "2026-09-13T00:30:00Z",
          "observation_type": "forecast",
          "status": "not_mapped",
          "freshness": {
            "state": "unknown",
            "age_hours": null,
            "max_age_hours": null
          },
          "confidence": null,
          "official_source": null
        },
        "sea_surface_temperature_c": {
          "parameter": null,
          "value": null,
          "unit": "degC",
          "source": null,
          "product_id": null,
          "retrieved_at": null,
          "valid_time": "2026-09-13T00:30:00Z",
          "observation_type": "forecast",
          "status": "not_mapped",
          "freshness": {
            "state": "unknown",
            "age_hours": null,
            "max_age_hours": null
          },
          "confidence": null,
          "official_source": null
        }
      },
      "P6": {
        "wave_height_m": {
          "parameter": null,
          "value": null,
          "unit": "m",
          "source": null,
          "product_id": null,
          "retrieved_at": null,
          "valid_time": "2026-09-13T00:30:00Z",
          "observation_type": "forecast",
          "status": "not_mapped",
          "freshness": {
            "state": "unknown",
            "age_hours": null,
            "max_age_hours": null
          },
          "confidence": null,
          "official_source": null
        },
        "sea_surface_temperature_c": {
          "parameter": null,
          "value": null,
          "unit": "degC",
          "source": null,
          "product_id": null,
          "retrieved_at": null,
          "valid_time": "2026-09-13T00:30:00Z",
          "observation_type": "forecast",
          "status": "not_mapped",
          "freshness": {
            "state": "unknown",
            "age_hours": null,
            "max_age_hours": null
          },
          "confidence": null,
          "official_source": null
        }
      },
      "P7": {
        "wave_height_m": {
          "parameter": null,
          "value": null,
          "unit": "m",
          "source": null,
          "product_id": null,
          "retrieved_at": null,
          "valid_time": "2026-09-13T00:30:00Z",
          "observation_type": "forecast",
          "status": "not_mapped",
          "freshness": {
            "state": "unknown",
            "age_hours": null,
            "max_age_hours": null
          },
          "confidence": null,
          "official_source": null
        },
        "sea_surface_temperature_c": {
          "parameter": null,
          "value": null,
          "unit": "degC",
          "source": null,
          "product_id": null,
          "retrieved_at": null,
          "valid_time": "2026-09-13T00:30:00Z",
          "observation_type": "forecast",
          "status": "not_mapped",
          "freshness": {
            "state": "unknown",
            "age_hours": null,
            "max_age_hours": null
          },
          "confidence": null,
          "official_source": null
        }
      },
      "P8": {
        "wave_height_m": {
          "parameter": null,
          "value": null,
          "unit": "m",
          "source": null,
          "product_id": null,
          "retrieved_at": null,
          "valid_time": "2026-09-13T00:30:00Z",
          "observation_type": "forecast",
          "status": "not_mapped",
          "freshness": {
            "state": "unknown",
            "age_hours": null,
            "max_age_hours": null
          },
          "confidence": null,
          "official_source": null
        },
        "sea_surface_temperature_c": {
          "parameter": null,
          "value": null,
          "unit": "degC",
          "source": null,
          "product_id": null,
          "retrieved_at": null,
          "valid_time": "2026-09-13T00:30:00Z",
          "observation_type": "forecast",
          "status": "not_mapped",
          "freshness": {
            "state": "unknown",
            "age_hours": null,
            "max_age_hours": null
          },
          "confidence": null,
          "official_source": null
        }
      }
    },
    "regional": {
      "tide_level_m": {
        "parameter": null,
        "value": 1.3,
        "unit": "m",
        "source": "INCOIS PAT",
        "product_id": null,
        "retrieved_at": "2026-09-12T09:15:04Z",
        "valid_time": "2026-09-13T03:00:00Z",
        "observation_type": "forecast",
        "status": "available",
        "freshness": {
          "state": "near_real_time",
          "age_hours": 2.3,
          "max_age_hours": 6
        },
        "confidence": null,
        "official_source": null
      }
    }
  },
  "raw": null
}
```
This is the case that caught the real bug fixed while building this file: every `not_mapped` field here has `source: null` and `retrieved_at: null`. Before the fix, `Measurement.json` required both as non-null strings — the schema couldn't represent its own most important case. See the anomaly list.
 
### 3.4 GIS Agent — no restriction found at any point
 
**Validates against `contracts/AgentResult.json`:**
```json
{
  "analysis_id": "req_20260912_0915_f4e9d1",
  "agent_name": "gis",
  "status": "completed",
  "started_at": "2026-09-12T09:15:06Z",
  "completed_at": "2026-09-12T09:15:08Z",
  "duration_ms": 2000,
  "retry_count": 0,
  "error": null,
  "normalized": {
    "by_point": {
      "P0": {
        "in_restricted_zone": {
          "parameter": null,
          "value": false,
          "unit": null,
          "source": "Bhuvan/Bhoonidhi",
          "product_id": null,
          "retrieved_at": "2026-09-12T09:15:04Z",
          "valid_time": "2026-09-13T00:30:00Z",
          "observation_type": "forecast",
          "status": "available",
          "freshness": {
            "state": "cached",
            "age_hours": 720,
            "max_age_hours": 8760
          },
          "confidence": null,
          "official_source": null
        }
      },
      "P1": {
        "in_restricted_zone": {
          "parameter": null,
          "value": false,
          "unit": null,
          "source": "Bhuvan/Bhoonidhi",
          "product_id": null,
          "retrieved_at": "2026-09-12T09:15:04Z",
          "valid_time": "2026-09-13T00:30:00Z",
          "observation_type": "forecast",
          "status": "available",
          "freshness": {
            "state": "cached",
            "age_hours": 720,
            "max_age_hours": 8760
          },
          "confidence": null,
          "official_source": null
        }
      },
      "P2": {
        "in_restricted_zone": {
          "parameter": null,
          "value": false,
          "unit": null,
          "source": "Bhuvan/Bhoonidhi",
          "product_id": null,
          "retrieved_at": "2026-09-12T09:15:04Z",
          "valid_time": "2026-09-13T00:30:00Z",
          "observation_type": "forecast",
          "status": "available",
          "freshness": {
            "state": "cached",
            "age_hours": 720,
            "max_age_hours": 8760
          },
          "confidence": null,
          "official_source": null
        }
      },
      "P3": {
        "in_restricted_zone": {
          "parameter": null,
          "value": false,
          "unit": null,
          "source": "Bhuvan/Bhoonidhi",
          "product_id": null,
          "retrieved_at": "2026-09-12T09:15:04Z",
          "valid_time": "2026-09-13T00:30:00Z",
          "observation_type": "forecast",
          "status": "available",
          "freshness": {
            "state": "cached",
            "age_hours": 720,
            "max_age_hours": 8760
          },
          "confidence": null,
          "official_source": null
        }
      },
      "P4": {
        "in_restricted_zone": {
          "parameter": null,
          "value": false,
          "unit": null,
          "source": "Bhuvan/Bhoonidhi",
          "product_id": null,
          "retrieved_at": "2026-09-12T09:15:04Z",
          "valid_time": "2026-09-13T00:30:00Z",
          "observation_type": "forecast",
          "status": "available",
          "freshness": {
            "state": "cached",
            "age_hours": 720,
            "max_age_hours": 8760
          },
          "confidence": null,
          "official_source": null
        }
      },
      "P5": {
        "in_restricted_zone": {
          "parameter": null,
          "value": false,
          "unit": null,
          "source": "Bhuvan/Bhoonidhi",
          "product_id": null,
          "retrieved_at": "2026-09-12T09:15:04Z",
          "valid_time": "2026-09-13T00:30:00Z",
          "observation_type": "forecast",
          "status": "available",
          "freshness": {
            "state": "cached",
            "age_hours": 720,
            "max_age_hours": 8760
          },
          "confidence": null,
          "official_source": null
        }
      },
      "P6": {
        "in_restricted_zone": {
          "parameter": null,
          "value": false,
          "unit": null,
          "source": "Bhuvan/Bhoonidhi",
          "product_id": null,
          "retrieved_at": "2026-09-12T09:15:04Z",
          "valid_time": "2026-09-13T00:30:00Z",
          "observation_type": "forecast",
          "status": "available",
          "freshness": {
            "state": "cached",
            "age_hours": 720,
            "max_age_hours": 8760
          },
          "confidence": null,
          "official_source": null
        }
      },
      "P7": {
        "in_restricted_zone": {
          "parameter": null,
          "value": false,
          "unit": null,
          "source": "Bhuvan/Bhoonidhi",
          "product_id": null,
          "retrieved_at": "2026-09-12T09:15:04Z",
          "valid_time": "2026-09-13T00:30:00Z",
          "observation_type": "forecast",
          "status": "available",
          "freshness": {
            "state": "cached",
            "age_hours": 720,
            "max_age_hours": 8760
          },
          "confidence": null,
          "official_source": null
        }
      },
      "P8": {
        "in_restricted_zone": {
          "parameter": null,
          "value": false,
          "unit": null,
          "source": "Bhuvan/Bhoonidhi",
          "product_id": null,
          "retrieved_at": "2026-09-12T09:15:04Z",
          "valid_time": "2026-09-13T00:30:00Z",
          "observation_type": "forecast",
          "status": "available",
          "freshness": {
            "state": "cached",
            "age_hours": 720,
            "max_age_hours": 8760
          },
          "confidence": null,
          "official_source": null
        }
      }
    },
    "regional": null
  },
  "raw": null
}
```
 
### 3.5 Risk Agent — full output, all 9 points
 
**Validates against `contracts/RiskAssessment.json`, one object per point:**
```json
[
  {
    "point_id": "P0",
    "baseline_score": 42,
    "llm_adjustment": 2,
    "adjustment_reason": "Hourly wind trend rises slightly toward the end of the window per weather.wind_speed_kn.",
    "official_warnings": [],
    "hard_rules_applied": [],
    "constraint_floor": null,
    "final_score": 44,
    "risk_level": "CAUTION",
    "risk_factors": [
      "wind_speed"
    ],
    "reasoning": "Wind at the requested point is in the CAUTION band and rises slightly through the morning; no official warnings or hard rules apply.",
    "key_findings": [
      "Wind stays in the CAUTION band throughout the window"
    ],
    "hourly_scores": [
      {
        "time": "2026-09-13T00:30:00Z",
        "score": 40
      },
      {
        "time": "2026-09-13T01:30:00Z",
        "score": 41
      },
      {
        "time": "2026-09-13T02:30:00Z",
        "score": 42
      },
      {
        "time": "2026-09-13T03:30:00Z",
        "score": 43
      },
      {
        "time": "2026-09-13T04:30:00Z",
        "score": 44
      },
      {
        "time": "2026-09-13T05:30:00Z",
        "score": 44
      }
    ],
    "confidence": 0.75,
    "data_quality": {
      "weather": {
        "status": "available",
        "freshness": {
          "state": "fresh",
          "age_hours": 0.1,
          "max_age_hours": 3
        },
        "source_note": "Open-Meteo Marine, live"
      },
      "ocean": {
        "status": "partial",
        "freshness": {
          "state": "near_real_time",
          "age_hours": 2.3,
          "max_age_hours": 6
        },
        "source_note": "INCOIS tide only; wave/SST/salinity/current not_mapped"
      },
      "gis": {
        "status": "available",
        "freshness": {
          "state": "cached",
          "age_hours": 720,
          "max_age_hours": 8760
        },
        "source_note": "Bhuvan/Bhoonidhi MPA and EEZ layers"
      }
    },
    "llm_interpretation_unavailable": false
  },
  {
    "point_id": "P1",
    "baseline_score": 48,
    "llm_adjustment": 0,
    "adjustment_reason": null,
    "official_warnings": [],
    "hard_rules_applied": [],
    "constraint_floor": null,
    "final_score": 48,
    "risk_level": "CAUTION",
    "risk_factors": [
      "wind_speed"
    ],
    "reasoning": "Wind is moderately elevated to the north; no adjustment needed beyond the deterministic baseline.",
    "key_findings": [
      "Steady CAUTION-band wind through the window"
    ],
    "hourly_scores": [
      {
        "time": "2026-09-13T00:30:00Z",
        "score": 46
      },
      {
        "time": "2026-09-13T01:30:00Z",
        "score": 47
      },
      {
        "time": "2026-09-13T02:30:00Z",
        "score": 48
      },
      {
        "time": "2026-09-13T03:30:00Z",
        "score": 48
      },
      {
        "time": "2026-09-13T04:30:00Z",
        "score": 49
      },
      {
        "time": "2026-09-13T05:30:00Z",
        "score": 48
      }
    ],
    "confidence": 0.74,
    "data_quality": {
      "weather": {
        "status": "available",
        "freshness": {
          "state": "fresh",
          "age_hours": 0.1,
          "max_age_hours": 3
        },
        "source_note": "Open-Meteo Marine, live"
      },
      "ocean": {
        "status": "partial",
        "freshness": {
          "state": "near_real_time",
          "age_hours": 2.3,
          "max_age_hours": 6
        },
        "source_note": "INCOIS tide only; wave/SST/salinity/current not_mapped"
      },
      "gis": {
        "status": "available",
        "freshness": {
          "state": "cached",
          "age_hours": 720,
          "max_age_hours": 8760
        },
        "source_note": "Bhuvan/Bhoonidhi MPA and EEZ layers"
      }
    },
    "llm_interpretation_unavailable": false
  },
  {
    "point_id": "P2",
    "baseline_score": 25,
    "llm_adjustment": -3,
    "adjustment_reason": "Hourly wind trend shows continued easing through the window per weather.wind_speed_kn.",
    "official_warnings": [],
    "hard_rules_applied": [],
    "constraint_floor": null,
    "final_score": 22,
    "risk_level": "SAFE",
    "risk_factors": [],
    "reasoning": "Wind is well below the caution threshold to the northeast and is easing further through the morning.",
    "key_findings": [
      "Calm and easing throughout the requested window"
    ],
    "hourly_scores": [
      {
        "time": "2026-09-13T00:30:00Z",
        "score": 28
      },
      {
        "time": "2026-09-13T01:30:00Z",
        "score": 26
      },
      {
        "time": "2026-09-13T02:30:00Z",
        "score": 24
      },
      {
        "time": "2026-09-13T03:30:00Z",
        "score": 22
      },
      {
        "time": "2026-09-13T04:30:00Z",
        "score": 20
      },
      {
        "time": "2026-09-13T05:30:00Z",
        "score": 18
      }
    ],
    "confidence": 0.82,
    "data_quality": {
      "weather": {
        "status": "available",
        "freshness": {
          "state": "fresh",
          "age_hours": 0.1,
          "max_age_hours": 3
        },
        "source_note": "Open-Meteo Marine, live"
      },
      "ocean": {
        "status": "partial",
        "freshness": {
          "state": "near_real_time",
          "age_hours": 2.3,
          "max_age_hours": 6
        },
        "source_note": "INCOIS tide only; wave/SST/salinity/current not_mapped"
      },
      "gis": {
        "status": "available",
        "freshness": {
          "state": "cached",
          "age_hours": 720,
          "max_age_hours": 8760
        },
        "source_note": "Bhuvan/Bhoonidhi MPA and EEZ layers"
      }
    },
    "llm_interpretation_unavailable": false
  },
  {
    "point_id": "P3",
    "baseline_score": 70,
    "llm_adjustment": 5,
    "adjustment_reason": "Latest hourly weather trend shows visibility continuing to drop through the window per weather.visibility_km.",
    "official_warnings": [],
    "hard_rules_applied": [
      {
        "rule_id": "HR-03_WIND_ABOVE_VESSEL_DANGEROUS_LIMIT",
        "description": "wind_speed_kn exceeds the DANGEROUS threshold configured for motorized_country_craft",
        "floor_score": 85
      }
    ],
    "constraint_floor": 85,
    "final_score": 85,
    "risk_level": "DANGEROUS",
    "risk_factors": [
      "wind_speed",
      "visibility"
    ],
    "reasoning": "Wind at this point exceeds the vessel's absolute DANGEROUS limit, which floors the score regardless of the LLM's more moderate reading; visibility is also dropping through the window.",
    "key_findings": [
      "Wind exceeds the vessel's hard safety limit, forcing DANGEROUS",
      "Visibility trending downward through the morning"
    ],
    "hourly_scores": [
      {
        "time": "2026-09-13T00:30:00Z",
        "score": 62
      },
      {
        "time": "2026-09-13T01:30:00Z",
        "score": 65
      },
      {
        "time": "2026-09-13T02:30:00Z",
        "score": 68
      },
      {
        "time": "2026-09-13T03:30:00Z",
        "score": 72
      },
      {
        "time": "2026-09-13T04:30:00Z",
        "score": 78
      },
      {
        "time": "2026-09-13T05:30:00Z",
        "score": 82
      }
    ],
    "confidence": 0.63,
    "data_quality": {
      "weather": {
        "status": "available",
        "freshness": {
          "state": "fresh",
          "age_hours": 0.1,
          "max_age_hours": 3
        },
        "source_note": "Open-Meteo Marine, live"
      },
      "ocean": {
        "status": "partial",
        "freshness": {
          "state": "near_real_time",
          "age_hours": 2.3,
          "max_age_hours": 6
        },
        "source_note": "INCOIS tide only; wave/SST/salinity/current not_mapped"
      },
      "gis": {
        "status": "available",
        "freshness": {
          "state": "cached",
          "age_hours": 720,
          "max_age_hours": 8760
        },
        "source_note": "Bhuvan/Bhoonidhi MPA and EEZ layers"
      }
    },
    "llm_interpretation_unavailable": false
  },
  {
    "point_id": "P4",
    "baseline_score": 55,
    "llm_adjustment": 3,
    "adjustment_reason": "Wave period shortening slightly per ocean-adjacent weather signals.",
    "official_warnings": [],
    "hard_rules_applied": [],
    "constraint_floor": null,
    "final_score": 58,
    "risk_level": "CAUTION",
    "risk_factors": [
      "wind_speed"
    ],
    "reasoning": "Elevated wind to the southeast keeps this point in the CAUTION band.",
    "key_findings": [
      "CAUTION-band wind, stable through the window"
    ],
    "hourly_scores": [
      {
        "time": "2026-09-13T00:30:00Z",
        "score": 54
      },
      {
        "time": "2026-09-13T01:30:00Z",
        "score": 55
      },
      {
        "time": "2026-09-13T02:30:00Z",
        "score": 56
      },
      {
        "time": "2026-09-13T03:30:00Z",
        "score": 58
      },
      {
        "time": "2026-09-13T04:30:00Z",
        "score": 59
      },
      {
        "time": "2026-09-13T05:30:00Z",
        "score": 58
      }
    ],
    "confidence": 0.7,
    "data_quality": {
      "weather": {
        "status": "available",
        "freshness": {
          "state": "fresh",
          "age_hours": 0.1,
          "max_age_hours": 3
        },
        "source_note": "Open-Meteo Marine, live"
      },
      "ocean": {
        "status": "partial",
        "freshness": {
          "state": "near_real_time",
          "age_hours": 2.3,
          "max_age_hours": 6
        },
        "source_note": "INCOIS tide only; wave/SST/salinity/current not_mapped"
      },
      "gis": {
        "status": "available",
        "freshness": {
          "state": "cached",
          "age_hours": 720,
          "max_age_hours": 8760
        },
        "source_note": "Bhuvan/Bhoonidhi MPA and EEZ layers"
      }
    },
    "llm_interpretation_unavailable": false
  },
  {
    "point_id": "P5",
    "baseline_score": 30,
    "llm_adjustment": 0,
    "adjustment_reason": null,
    "official_warnings": [],
    "hard_rules_applied": [],
    "constraint_floor": null,
    "final_score": 30,
    "risk_level": "SAFE",
    "risk_factors": [],
    "reasoning": "Calm conditions to the south, within the SAFE band throughout.",
    "key_findings": [
      "Calm throughout the requested window"
    ],
    "hourly_scores": [
      {
        "time": "2026-09-13T00:30:00Z",
        "score": 31
      },
      {
        "time": "2026-09-13T01:30:00Z",
        "score": 30
      },
      {
        "time": "2026-09-13T02:30:00Z",
        "score": 30
      },
      {
        "time": "2026-09-13T03:30:00Z",
        "score": 29
      },
      {
        "time": "2026-09-13T04:30:00Z",
        "score": 30
      },
      {
        "time": "2026-09-13T05:30:00Z",
        "score": 30
      }
    ],
    "confidence": 0.79,
    "data_quality": {
      "weather": {
        "status": "available",
        "freshness": {
          "state": "fresh",
          "age_hours": 0.1,
          "max_age_hours": 3
        },
        "source_note": "Open-Meteo Marine, live"
      },
      "ocean": {
        "status": "partial",
        "freshness": {
          "state": "near_real_time",
          "age_hours": 2.3,
          "max_age_hours": 6
        },
        "source_note": "INCOIS tide only; wave/SST/salinity/current not_mapped"
      },
      "gis": {
        "status": "available",
        "freshness": {
          "state": "cached",
          "age_hours": 720,
          "max_age_hours": 8760
        },
        "source_note": "Bhuvan/Bhoonidhi MPA and EEZ layers"
      }
    },
    "llm_interpretation_unavailable": false
  },
  {
    "point_id": "P6",
    "baseline_score": 40,
    "llm_adjustment": -2,
    "adjustment_reason": "Swell signal easing per hourly weather trend.",
    "official_warnings": [],
    "hard_rules_applied": [],
    "constraint_floor": null,
    "final_score": 38,
    "risk_level": "CAUTION",
    "risk_factors": [
      "wind_speed"
    ],
    "reasoning": "Mild CAUTION-band wind to the southwest, easing slightly through the window.",
    "key_findings": [
      "Borderline CAUTION, easing slightly"
    ],
    "hourly_scores": [
      {
        "time": "2026-09-13T00:30:00Z",
        "score": 41
      },
      {
        "time": "2026-09-13T01:30:00Z",
        "score": 40
      },
      {
        "time": "2026-09-13T02:30:00Z",
        "score": 39
      },
      {
        "time": "2026-09-13T03:30:00Z",
        "score": 38
      },
      {
        "time": "2026-09-13T04:30:00Z",
        "score": 37
      },
      {
        "time": "2026-09-13T05:30:00Z",
        "score": 37
      }
    ],
    "confidence": 0.73,
    "data_quality": {
      "weather": {
        "status": "available",
        "freshness": {
          "state": "fresh",
          "age_hours": 0.1,
          "max_age_hours": 3
        },
        "source_note": "Open-Meteo Marine, live"
      },
      "ocean": {
        "status": "partial",
        "freshness": {
          "state": "near_real_time",
          "age_hours": 2.3,
          "max_age_hours": 6
        },
        "source_note": "INCOIS tide only; wave/SST/salinity/current not_mapped"
      },
      "gis": {
        "status": "available",
        "freshness": {
          "state": "cached",
          "age_hours": 720,
          "max_age_hours": 8760
        },
        "source_note": "Bhuvan/Bhoonidhi MPA and EEZ layers"
      }
    },
    "llm_interpretation_unavailable": false
  },
  {
    "point_id": "P7",
    "baseline_score": 28,
    "llm_adjustment": 0,
    "adjustment_reason": null,
    "official_warnings": [],
    "hard_rules_applied": [],
    "constraint_floor": null,
    "final_score": 28,
    "risk_level": "SAFE",
    "risk_factors": [],
    "reasoning": "Calm conditions to the west, within the SAFE band throughout.",
    "key_findings": [
      "Calm throughout the requested window"
    ],
    "hourly_scores": [
      {
        "time": "2026-09-13T00:30:00Z",
        "score": 29
      },
      {
        "time": "2026-09-13T01:30:00Z",
        "score": 28
      },
      {
        "time": "2026-09-13T02:30:00Z",
        "score": 28
      },
      {
        "time": "2026-09-13T03:30:00Z",
        "score": 27
      },
      {
        "time": "2026-09-13T04:30:00Z",
        "score": 28
      },
      {
        "time": "2026-09-13T05:30:00Z",
        "score": 28
      }
    ],
    "confidence": 0.81,
    "data_quality": {
      "weather": {
        "status": "available",
        "freshness": {
          "state": "fresh",
          "age_hours": 0.1,
          "max_age_hours": 3
        },
        "source_note": "Open-Meteo Marine, live"
      },
      "ocean": {
        "status": "partial",
        "freshness": {
          "state": "near_real_time",
          "age_hours": 2.3,
          "max_age_hours": 6
        },
        "source_note": "INCOIS tide only; wave/SST/salinity/current not_mapped"
      },
      "gis": {
        "status": "available",
        "freshness": {
          "state": "cached",
          "age_hours": 720,
          "max_age_hours": 8760
        },
        "source_note": "Bhuvan/Bhoonidhi MPA and EEZ layers"
      }
    },
    "llm_interpretation_unavailable": false
  },
  {
    "point_id": "P8",
    "baseline_score": 45,
    "llm_adjustment": 1,
    "adjustment_reason": "Minor wind uptick observed late in the window per weather.wind_speed_kn.",
    "official_warnings": [],
    "hard_rules_applied": [],
    "constraint_floor": null,
    "final_score": 46,
    "risk_level": "CAUTION",
    "risk_factors": [
      "wind_speed"
    ],
    "reasoning": "CAUTION-band wind to the northwest, rising slightly late in the window.",
    "key_findings": [
      "CAUTION-band wind, mild late rise"
    ],
    "hourly_scores": [
      {
        "time": "2026-09-13T00:30:00Z",
        "score": 43
      },
      {
        "time": "2026-09-13T01:30:00Z",
        "score": 44
      },
      {
        "time": "2026-09-13T02:30:00Z",
        "score": 45
      },
      {
        "time": "2026-09-13T03:30:00Z",
        "score": 46
      },
      {
        "time": "2026-09-13T04:30:00Z",
        "score": 47
      },
      {
        "time": "2026-09-13T05:30:00Z",
        "score": 46
      }
    ],
    "confidence": 0.72,
    "data_quality": {
      "weather": {
        "status": "available",
        "freshness": {
          "state": "fresh",
          "age_hours": 0.1,
          "max_age_hours": 3
        },
        "source_note": "Open-Meteo Marine, live"
      },
      "ocean": {
        "status": "partial",
        "freshness": {
          "state": "near_real_time",
          "age_hours": 2.3,
          "max_age_hours": 6
        },
        "source_note": "INCOIS tide only; wave/SST/salinity/current not_mapped"
      },
      "gis": {
        "status": "available",
        "freshness": {
          "state": "cached",
          "age_hours": 720,
          "max_age_hours": 8760
        },
        "source_note": "Bhuvan/Bhoonidhi MPA and EEZ layers"
      }
    },
    "llm_interpretation_unavailable": false
  }
]
```
P3 is the point to look at closely: `baseline_score` + `llm_adjustment` = 75 (UNSAFE on its own), but a **hard rule** (`HR-03_WIND_ABOVE_VESSEL_DANGEROUS_LIMIT`) sets `constraint_floor: 85`, and `final_score = max(75, 85) = 85` → DANGEROUS. That's the hard-rule-floor mechanism your architecture requires: the LLM's more moderate read is overridden by the deterministic floor, not blended with it.
 
### 3.6 Decision Agent — full output
 
**Validates against `contracts/Decision.json`:**
```json
{
  "analysis_id": "req_20260912_0915_f4e9d1",
  "generated_at": "2026-09-12T09:15:12Z",
  "response_language": "en",
  "detailed_recommendation": "Your requested point (P0) is CAUTION \u2014 wind stays moderate through the morning, nothing that rules out fishing but worth care. Two nearby options change that picture: P2, 5km to the northeast, is SAFE and easing further through the window (wind dropping from 9.5 to under 7 kn) \u2014 that's the recommended spot. Do not head toward P3, 5km due east: wind there exceeds the vessel's absolute safety limit, which floors it at DANGEROUS regardless of any other reading, and visibility is dropping through the morning too. No official IMD or INCOIS warnings are active for this coastal segment. Vessel type wasn't specified, so ORCA assumed the most conservative configured profile (motorized_country_craft) \u2014 a faster or larger vessel may tolerate more than these thresholds allow.",
  "one_line_recommendation": "Go with caution near your point; head to P2 (NE) for genuinely safe conditions \u2014 avoid P3 (E), which is DANGEROUS.",
  "recommendation_type": "go_with_caution",
  "key_findings": {
    "safest_allowed_point": "P2 (bearing 45\u00b0/NE, 5km out) \u2014 SAFE at score 22, easing further through the morning",
    "highest_risk_point": "P3 (bearing 90\u00b0/E, 5km out) \u2014 DANGEROUS at score 85, hard-floored by a wind-limit rule",
    "major_hazard": "Wind at P3 exceeds the vessel's absolute safety limit",
    "official_warning_status": "No active IMD or INCOIS warnings for this coastal segment at request time",
    "gis_restriction": null,
    "pfz_opportunity": null,
    "best_time": "P2 is safe for the entire requested window and is easing further through the morning",
    "main_uncertainty": "Ocean data (wave height, SST, salinity, current) is not_mapped at every point; confidence is capped accordingly",
    "additional_findings": [
      "Vessel type was not specified, so ORCA assumed the most conservative configured profile (motorized_country_craft)"
    ]
  },
  "preferred_point": "P2",
  "preferred_point_reason": null,
  "worst_point": "P3",
  "worst_point_causes": [
    "Wind exceeds the vessel's DANGEROUS hard-rule limit",
    "Visibility trending downward through the window"
  ],
  "excluded_points": [
    {
      "point_id": "P3",
      "reason": "dangerous"
    }
  ],
  "best_time_windows": [
    {
      "start": "2026-09-13T00:30:00Z",
      "end": "2026-09-13T05:30:00Z",
      "max_score": 28,
      "level": "SAFE",
      "applies_to_point": "P2",
      "is_alternative_horizon": false
    }
  ],
  "point_scores": [
    {
      "point_id": "P0",
      "baseline_score": 42,
      "llm_adjustment": 2,
      "adjustment_reason": "Hourly wind trend rises slightly toward the end of the window per weather.wind_speed_kn.",
      "official_warnings": [],
      "hard_rules_applied": [],
      "constraint_floor": null,
      "final_score": 44,
      "risk_level": "CAUTION",
      "risk_factors": [
        "wind_speed"
      ],
      "reasoning": "Wind at the requested point is in the CAUTION band and rises slightly through the morning; no official warnings or hard rules apply.",
      "key_findings": [
        "Wind stays in the CAUTION band throughout the window"
      ],
      "hourly_scores": [
        {
          "time": "2026-09-13T00:30:00Z",
          "score": 40
        },
        {
          "time": "2026-09-13T01:30:00Z",
          "score": 41
        },
        {
          "time": "2026-09-13T02:30:00Z",
          "score": 42
        },
        {
          "time": "2026-09-13T03:30:00Z",
          "score": 43
        },
        {
          "time": "2026-09-13T04:30:00Z",
          "score": 44
        },
        {
          "time": "2026-09-13T05:30:00Z",
          "score": 44
        }
      ],
      "confidence": 0.75,
      "data_quality": {
        "weather": {
          "status": "available",
          "freshness": {
            "state": "fresh",
            "age_hours": 0.1,
            "max_age_hours": 3
          },
          "source_note": "Open-Meteo Marine, live"
        },
        "ocean": {
          "status": "partial",
          "freshness": {
            "state": "near_real_time",
            "age_hours": 2.3,
            "max_age_hours": 6
          },
          "source_note": "INCOIS tide only; wave/SST/salinity/current not_mapped"
        },
        "gis": {
          "status": "available",
          "freshness": {
            "state": "cached",
            "age_hours": 720,
            "max_age_hours": 8760
          },
          "source_note": "Bhuvan/Bhoonidhi MPA and EEZ layers"
        }
      },
      "llm_interpretation_unavailable": false
    },
    {
      "point_id": "P1",
      "baseline_score": 48,
      "llm_adjustment": 0,
      "adjustment_reason": null,
      "official_warnings": [],
      "hard_rules_applied": [],
      "constraint_floor": null,
      "final_score": 48,
      "risk_level": "CAUTION",
      "risk_factors": [
        "wind_speed"
      ],
      "reasoning": "Wind is moderately elevated to the north; no adjustment needed beyond the deterministic baseline.",
      "key_findings": [
        "Steady CAUTION-band wind through the window"
      ],
      "hourly_scores": [
        {
          "time": "2026-09-13T00:30:00Z",
          "score": 46
        },
        {
          "time": "2026-09-13T01:30:00Z",
          "score": 47
        },
        {
          "time": "2026-09-13T02:30:00Z",
          "score": 48
        },
        {
          "time": "2026-09-13T03:30:00Z",
          "score": 48
        },
        {
          "time": "2026-09-13T04:30:00Z",
          "score": 49
        },
        {
          "time": "2026-09-13T05:30:00Z",
          "score": 48
        }
      ],
      "confidence": 0.74,
      "data_quality": {
        "weather": {
          "status": "available",
          "freshness": {
            "state": "fresh",
            "age_hours": 0.1,
            "max_age_hours": 3
          },
          "source_note": "Open-Meteo Marine, live"
        },
        "ocean": {
          "status": "partial",
          "freshness": {
            "state": "near_real_time",
            "age_hours": 2.3,
            "max_age_hours": 6
          },
          "source_note": "INCOIS tide only; wave/SST/salinity/current not_mapped"
        },
        "gis": {
          "status": "available",
          "freshness": {
            "state": "cached",
            "age_hours": 720,
            "max_age_hours": 8760
          },
          "source_note": "Bhuvan/Bhoonidhi MPA and EEZ layers"
        }
      },
      "llm_interpretation_unavailable": false
    },
    {
      "point_id": "P2",
      "baseline_score": 25,
      "llm_adjustment": -3,
      "adjustment_reason": "Hourly wind trend shows continued easing through the window per weather.wind_speed_kn.",
      "official_warnings": [],
      "hard_rules_applied": [],
      "constraint_floor": null,
      "final_score": 22,
      "risk_level": "SAFE",
      "risk_factors": [],
      "reasoning": "Wind is well below the caution threshold to the northeast and is easing further through the morning.",
      "key_findings": [
        "Calm and easing throughout the requested window"
      ],
      "hourly_scores": [
        {
          "time": "2026-09-13T00:30:00Z",
          "score": 28
        },
        {
          "time": "2026-09-13T01:30:00Z",
          "score": 26
        },
        {
          "time": "2026-09-13T02:30:00Z",
          "score": 24
        },
        {
          "time": "2026-09-13T03:30:00Z",
          "score": 22
        },
        {
          "time": "2026-09-13T04:30:00Z",
          "score": 20
        },
        {
          "time": "2026-09-13T05:30:00Z",
          "score": 18
        }
      ],
      "confidence": 0.82,
      "data_quality": {
        "weather": {
          "status": "available",
          "freshness": {
            "state": "fresh",
            "age_hours": 0.1,
            "max_age_hours": 3
          },
          "source_note": "Open-Meteo Marine, live"
        },
        "ocean": {
          "status": "partial",
          "freshness": {
            "state": "near_real_time",
            "age_hours": 2.3,
            "max_age_hours": 6
          },
          "source_note": "INCOIS tide only; wave/SST/salinity/current not_mapped"
        },
        "gis": {
          "status": "available",
          "freshness": {
            "state": "cached",
            "age_hours": 720,
            "max_age_hours": 8760
          },
          "source_note": "Bhuvan/Bhoonidhi MPA and EEZ layers"
        }
      },
      "llm_interpretation_unavailable": false
    },
    {
      "point_id": "P3",
      "baseline_score": 70,
      "llm_adjustment": 5,
      "adjustment_reason": "Latest hourly weather trend shows visibility continuing to drop through the window per weather.visibility_km.",
      "official_warnings": [],
      "hard_rules_applied": [
        {
          "rule_id": "HR-03_WIND_ABOVE_VESSEL_DANGEROUS_LIMIT",
          "description": "wind_speed_kn exceeds the DANGEROUS threshold configured for motorized_country_craft",
          "floor_score": 85
        }
      ],
      "constraint_floor": 85,
      "final_score": 85,
      "risk_level": "DANGEROUS",
      "risk_factors": [
        "wind_speed",
        "visibility"
      ],
      "reasoning": "Wind at this point exceeds the vessel's absolute DANGEROUS limit, which floors the score regardless of the LLM's more moderate reading; visibility is also dropping through the window.",
      "key_findings": [
        "Wind exceeds the vessel's hard safety limit, forcing DANGEROUS",
        "Visibility trending downward through the morning"
      ],
      "hourly_scores": [
        {
          "time": "2026-09-13T00:30:00Z",
          "score": 62
        },
        {
          "time": "2026-09-13T01:30:00Z",
          "score": 65
        },
        {
          "time": "2026-09-13T02:30:00Z",
          "score": 68
        },
        {
          "time": "2026-09-13T03:30:00Z",
          "score": 72
        },
        {
          "time": "2026-09-13T04:30:00Z",
          "score": 78
        },
        {
          "time": "2026-09-13T05:30:00Z",
          "score": 82
        }
      ],
      "confidence": 0.63,
      "data_quality": {
        "weather": {
          "status": "available",
          "freshness": {
            "state": "fresh",
            "age_hours": 0.1,
            "max_age_hours": 3
          },
          "source_note": "Open-Meteo Marine, live"
        },
        "ocean": {
          "status": "partial",
          "freshness": {
            "state": "near_real_time",
            "age_hours": 2.3,
            "max_age_hours": 6
          },
          "source_note": "INCOIS tide only; wave/SST/salinity/current not_mapped"
        },
        "gis": {
          "status": "available",
          "freshness": {
            "state": "cached",
            "age_hours": 720,
            "max_age_hours": 8760
          },
          "source_note": "Bhuvan/Bhoonidhi MPA and EEZ layers"
        }
      },
      "llm_interpretation_unavailable": false
    },
    {
      "point_id": "P4",
      "baseline_score": 55,
      "llm_adjustment": 3,
      "adjustment_reason": "Wave period shortening slightly per ocean-adjacent weather signals.",
      "official_warnings": [],
      "hard_rules_applied": [],
      "constraint_floor": null,
      "final_score": 58,
      "risk_level": "CAUTION",
      "risk_factors": [
        "wind_speed"
      ],
      "reasoning": "Elevated wind to the southeast keeps this point in the CAUTION band.",
      "key_findings": [
        "CAUTION-band wind, stable through the window"
      ],
      "hourly_scores": [
        {
          "time": "2026-09-13T00:30:00Z",
          "score": 54
        },
        {
          "time": "2026-09-13T01:30:00Z",
          "score": 55
        },
        {
          "time": "2026-09-13T02:30:00Z",
          "score": 56
        },
        {
          "time": "2026-09-13T03:30:00Z",
          "score": 58
        },
        {
          "time": "2026-09-13T04:30:00Z",
          "score": 59
        },
        {
          "time": "2026-09-13T05:30:00Z",
          "score": 58
        }
      ],
      "confidence": 0.7,
      "data_quality": {
        "weather": {
          "status": "available",
          "freshness": {
            "state": "fresh",
            "age_hours": 0.1,
            "max_age_hours": 3
          },
          "source_note": "Open-Meteo Marine, live"
        },
        "ocean": {
          "status": "partial",
          "freshness": {
            "state": "near_real_time",
            "age_hours": 2.3,
            "max_age_hours": 6
          },
          "source_note": "INCOIS tide only; wave/SST/salinity/current not_mapped"
        },
        "gis": {
          "status": "available",
          "freshness": {
            "state": "cached",
            "age_hours": 720,
            "max_age_hours": 8760
          },
          "source_note": "Bhuvan/Bhoonidhi MPA and EEZ layers"
        }
      },
      "llm_interpretation_unavailable": false
    },
    {
      "point_id": "P5",
      "baseline_score": 30,
      "llm_adjustment": 0,
      "adjustment_reason": null,
      "official_warnings": [],
      "hard_rules_applied": [],
      "constraint_floor": null,
      "final_score": 30,
      "risk_level": "SAFE",
      "risk_factors": [],
      "reasoning": "Calm conditions to the south, within the SAFE band throughout.",
      "key_findings": [
        "Calm throughout the requested window"
      ],
      "hourly_scores": [
        {
          "time": "2026-09-13T00:30:00Z",
          "score": 31
        },
        {
          "time": "2026-09-13T01:30:00Z",
          "score": 30
        },
        {
          "time": "2026-09-13T02:30:00Z",
          "score": 30
        },
        {
          "time": "2026-09-13T03:30:00Z",
          "score": 29
        },
        {
          "time": "2026-09-13T04:30:00Z",
          "score": 30
        },
        {
          "time": "2026-09-13T05:30:00Z",
          "score": 30
        }
      ],
      "confidence": 0.79,
      "data_quality": {
        "weather": {
          "status": "available",
          "freshness": {
            "state": "fresh",
            "age_hours": 0.1,
            "max_age_hours": 3
          },
          "source_note": "Open-Meteo Marine, live"
        },
        "ocean": {
          "status": "partial",
          "freshness": {
            "state": "near_real_time",
            "age_hours": 2.3,
            "max_age_hours": 6
          },
          "source_note": "INCOIS tide only; wave/SST/salinity/current not_mapped"
        },
        "gis": {
          "status": "available",
          "freshness": {
            "state": "cached",
            "age_hours": 720,
            "max_age_hours": 8760
          },
          "source_note": "Bhuvan/Bhoonidhi MPA and EEZ layers"
        }
      },
      "llm_interpretation_unavailable": false
    },
    {
      "point_id": "P6",
      "baseline_score": 40,
      "llm_adjustment": -2,
      "adjustment_reason": "Swell signal easing per hourly weather trend.",
      "official_warnings": [],
      "hard_rules_applied": [],
      "constraint_floor": null,
      "final_score": 38,
      "risk_level": "CAUTION",
      "risk_factors": [
        "wind_speed"
      ],
      "reasoning": "Mild CAUTION-band wind to the southwest, easing slightly through the window.",
      "key_findings": [
        "Borderline CAUTION, easing slightly"
      ],
      "hourly_scores": [
        {
          "time": "2026-09-13T00:30:00Z",
          "score": 41
        },
        {
          "time": "2026-09-13T01:30:00Z",
          "score": 40
        },
        {
          "time": "2026-09-13T02:30:00Z",
          "score": 39
        },
        {
          "time": "2026-09-13T03:30:00Z",
          "score": 38
        },
        {
          "time": "2026-09-13T04:30:00Z",
          "score": 37
        },
        {
          "time": "2026-09-13T05:30:00Z",
          "score": 37
        }
      ],
      "confidence": 0.73,
      "data_quality": {
        "weather": {
          "status": "available",
          "freshness": {
            "state": "fresh",
            "age_hours": 0.1,
            "max_age_hours": 3
          },
          "source_note": "Open-Meteo Marine, live"
        },
        "ocean": {
          "status": "partial",
          "freshness": {
            "state": "near_real_time",
            "age_hours": 2.3,
            "max_age_hours": 6
          },
          "source_note": "INCOIS tide only; wave/SST/salinity/current not_mapped"
        },
        "gis": {
          "status": "available",
          "freshness": {
            "state": "cached",
            "age_hours": 720,
            "max_age_hours": 8760
          },
          "source_note": "Bhuvan/Bhoonidhi MPA and EEZ layers"
        }
      },
      "llm_interpretation_unavailable": false
    },
    {
      "point_id": "P7",
      "baseline_score": 28,
      "llm_adjustment": 0,
      "adjustment_reason": null,
      "official_warnings": [],
      "hard_rules_applied": [],
      "constraint_floor": null,
      "final_score": 28,
      "risk_level": "SAFE",
      "risk_factors": [],
      "reasoning": "Calm conditions to the west, within the SAFE band throughout.",
      "key_findings": [
        "Calm throughout the requested window"
      ],
      "hourly_scores": [
        {
          "time": "2026-09-13T00:30:00Z",
          "score": 29
        },
        {
          "time": "2026-09-13T01:30:00Z",
          "score": 28
        },
        {
          "time": "2026-09-13T02:30:00Z",
          "score": 28
        },
        {
          "time": "2026-09-13T03:30:00Z",
          "score": 27
        },
        {
          "time": "2026-09-13T04:30:00Z",
          "score": 28
        },
        {
          "time": "2026-09-13T05:30:00Z",
          "score": 28
        }
      ],
      "confidence": 0.81,
      "data_quality": {
        "weather": {
          "status": "available",
          "freshness": {
            "state": "fresh",
            "age_hours": 0.1,
            "max_age_hours": 3
          },
          "source_note": "Open-Meteo Marine, live"
        },
        "ocean": {
          "status": "partial",
          "freshness": {
            "state": "near_real_time",
            "age_hours": 2.3,
            "max_age_hours": 6
          },
          "source_note": "INCOIS tide only; wave/SST/salinity/current not_mapped"
        },
        "gis": {
          "status": "available",
          "freshness": {
            "state": "cached",
            "age_hours": 720,
            "max_age_hours": 8760
          },
          "source_note": "Bhuvan/Bhoonidhi MPA and EEZ layers"
        }
      },
      "llm_interpretation_unavailable": false
    },
    {
      "point_id": "P8",
      "baseline_score": 45,
      "llm_adjustment": 1,
      "adjustment_reason": "Minor wind uptick observed late in the window per weather.wind_speed_kn.",
      "official_warnings": [],
      "hard_rules_applied": [],
      "constraint_floor": null,
      "final_score": 46,
      "risk_level": "CAUTION",
      "risk_factors": [
        "wind_speed"
      ],
      "reasoning": "CAUTION-band wind to the northwest, rising slightly late in the window.",
      "key_findings": [
        "CAUTION-band wind, mild late rise"
      ],
      "hourly_scores": [
        {
          "time": "2026-09-13T00:30:00Z",
          "score": 43
        },
        {
          "time": "2026-09-13T01:30:00Z",
          "score": 44
        },
        {
          "time": "2026-09-13T02:30:00Z",
          "score": 45
        },
        {
          "time": "2026-09-13T03:30:00Z",
          "score": 46
        },
        {
          "time": "2026-09-13T04:30:00Z",
          "score": 47
        },
        {
          "time": "2026-09-13T05:30:00Z",
          "score": 46
        }
      ],
      "confidence": 0.72,
      "data_quality": {
        "weather": {
          "status": "available",
          "freshness": {
            "state": "fresh",
            "age_hours": 0.1,
            "max_age_hours": 3
          },
          "source_note": "Open-Meteo Marine, live"
        },
        "ocean": {
          "status": "partial",
          "freshness": {
            "state": "near_real_time",
            "age_hours": 2.3,
            "max_age_hours": 6
          },
          "source_note": "INCOIS tide only; wave/SST/salinity/current not_mapped"
        },
        "gis": {
          "status": "available",
          "freshness": {
            "state": "cached",
            "age_hours": 720,
            "max_age_hours": 8760
          },
          "source_note": "Bhuvan/Bhoonidhi MPA and EEZ layers"
        }
      },
      "llm_interpretation_unavailable": false
    }
  ]
}
```
`excluded_points` shows P3 excluded with reason `"dangerous"` — it still appears in `point_scores` (Decision never modifies Risk's numbers) but is removed from consideration as `preferred_point`. `preferred_point: "P2"` is the true lowest `final_score` (22) among the remaining candidates — matching the same "always the true minimum" correction your old reference file called out at the end of its own document.
 
---
 
## STAGE 4 — AI Service → Backend (final result)
 
**Validates against `contracts/api/InternalResultPayload.json`:**
```json
{
  "analysis_id": "req_20260912_0915_f4e9d1",
  "final_stage": "decision",
  "status": "completed",
  "error": null,
  "decision": "[...exactly the Decision object from Stage 3.6 above, unchanged...]",
  "route_result": null,
  "trend_result": null,
  "report_content": null,
  "quick_information_result": null
}
```
*(`decision` collapsed above purely for length — it's the identical, already-validated object from Stage 3.6.)*
 
---
 
## STAGE 4→5 — Backend persistence and Frontend delivery
 
**`analyses` document updated, status flipped to `completed` — validates against `contracts/db/AnalysesDocument.json`:**
```json
{
  "analysis_id": "req_20260912_0915_f4e9d1",
  "conversation_id": "conv_9f8e7d",
  "parent_analysis_id": null,
  "alert_subscription_id": null,
  "request": {
    "query": "Is it safe to fish tomorrow morning near Mumbai?",
    "coordinate": null,
    "place_name": "Mumbai",
    "date": null,
    "time_range": null,
    "activity": "fishing",
    "vessel_type": null,
    "origin": null,
    "destination": null,
    "language_override": null,
    "conversation_id": null,
    "parent_analysis_id": null
  },
  "plan": "[...exactly the ExecutionPlan from Stage 3.1 above...]",
  "status": "completed",
  "error": null,
  "points": "[...all 9 PointObservations from Stage 3.2 above...]",
  "created_at": "2026-09-12T09:15:00Z",
  "completed_at": "2026-09-12T09:15:12Z"
}
```
 
**`GET /api/v1/analysis/req_20260912_0915_f4e9d1` response to Frontend — validates against `contracts/api/AnalysisResultResponse.json`:**
```json
{
  "analysis_id": "req_20260912_0915_f4e9d1",
  "status": "completed",
  "error": null,
  "plan": "[...exactly the ExecutionPlan from Stage 3.1 above...]",
  "points": "[...all 9 PointObservations from Stage 3.2 above...]",
  "quick_information_result": null,
  "decision": "[...exactly the Decision object from Stage 3.6 above, including its full point_scores[] for all 9 points \u2014 nothing dropped or reshaped between Backend storage and the Frontend response...]",
  "route_result": null,
  "trend_result": null,
  "data_quality": {
    "weather": {
      "status": "available",
      "freshness": {
        "state": "fresh",
        "age_hours": 0.1,
        "max_age_hours": 3
      },
      "source_note": "Open-Meteo Marine, live"
    },
    "ocean": {
      "status": "partial",
      "freshness": {
        "state": "near_real_time",
        "age_hours": 2.3,
        "max_age_hours": 6
      },
      "source_note": "INCOIS tide only; wave/SST/salinity/current not_mapped"
    },
    "gis": {
      "status": "available",
      "freshness": {
        "state": "cached",
        "age_hours": 720,
        "max_age_hours": 8760
      },
      "source_note": "Bhuvan/Bhoonidhi MPA and EEZ layers"
    }
  },
  "execution_trace": [
    {
      "stage": "planner",
      "selected": true,
      "selection_reason": null,
      "status": "completed",
      "status_code": 200,
      "started_at": "2026-09-12T09:15:00Z",
      "completed_at": "2026-09-12T09:15:02Z",
      "duration_ms": 2000,
      "retry_count": 0,
      "error": null
    },
    {
      "stage": "weather",
      "selected": true,
      "selection_reason": "Mandatory for any safety request.",
      "status": "completed",
      "status_code": 200,
      "started_at": "2026-09-12T09:15:02Z",
      "completed_at": "2026-09-12T09:15:06Z",
      "duration_ms": 4000,
      "retry_count": 0,
      "error": null
    },
    {
      "stage": "ocean",
      "selected": true,
      "selection_reason": "Mandatory for any safety request.",
      "status": "partial",
      "status_code": 206,
      "started_at": "2026-09-12T09:15:06Z",
      "completed_at": "2026-09-12T09:15:09Z",
      "duration_ms": 3000,
      "retry_count": 1,
      "error": {
        "error_category": "upstream_unavailable",
        "message": "INCOIS OSF wave/SST/salinity/current not mapped for this coordinate.",
        "http_status": null,
        "retry_count": 1
      }
    },
    {
      "stage": "gis",
      "selected": true,
      "selection_reason": "Mandatory geofence/MPA/restricted-zone check.",
      "status": "completed",
      "status_code": 200,
      "started_at": "2026-09-12T09:15:06Z",
      "completed_at": "2026-09-12T09:15:08Z",
      "duration_ms": 2000,
      "retry_count": 0,
      "error": null
    },
    {
      "stage": "risk",
      "selected": true,
      "selection_reason": null,
      "status": "completed",
      "status_code": 200,
      "started_at": "2026-09-12T09:15:09Z",
      "completed_at": "2026-09-12T09:15:10Z",
      "duration_ms": 1000,
      "retry_count": 0,
      "error": null
    },
    {
      "stage": "decision",
      "selected": true,
      "selection_reason": null,
      "status": "completed",
      "status_code": 200,
      "started_at": "2026-09-12T09:15:10Z",
      "completed_at": "2026-09-12T09:15:12Z",
      "duration_ms": 2000,
      "retry_count": 0,
      "error": null
    }
  ],
  "created_at": "2026-09-12T09:15:00Z",
  "completed_at": "2026-09-12T09:15:12Z"
}
```
*(`plan`, `points`, and `decision` collapsed above purely for length — all three are the identical, already-validated objects shown in full in Stage 3. Nothing is dropped or reshaped between Backend storage and the Frontend response.)*
 
The `allOf`/`if`-`then` block in this schema did something real here, not just in theory: because `plan.primary_intent = "point_safety"`, the schema *requires* `decision` to be present and non-null. Building this exact object against the schema is what confirmed that conditional works as intended.
 
---
 
## STAGE 6 — Chat, full round trip
 
**`POST /api/v1/chat/message` — validates against `contracts/api/ChatMessageRequest.json`:**
```json
{
  "conversation_id": null,
  "analysis_id": "req_20260912_0915_f4e9d1",
  "message": "Why is P3 dangerous and where should I go instead?",
  "language_override": null
}
```
 
**Response — validates against `contracts/api/ChatMessageResponse.json`:**
```json
{
  "conversation_id": "conv_9f8e7d",
  "response_text": "P3 is 5km due east of your point. It's DANGEROUS because wind there exceeds the vessel's absolute safety limit, which floors the score regardless of anything else \u2014 visibility is also dropping through the morning. P2, 5km to the northeast, is your best option: it's SAFE and actually easing further through the window.",
  "response_language": "en",
  "answered_from": "stored_evidence",
  "triggered_analysis_id": null,
  "dashboard_url": "/analysis/req_20260912_0915_f4e9d1"
}
```
`answered_from: "stored_evidence"` — this question is answerable entirely from the Decision and RiskAssessment data already computed in Stage 3; no new Planner execution was triggered. A question requiring new data (a different location or day) would set `answered_from: "new_analysis"` with `triggered_analysis_id` pointing at a fresh analysis linked back via `parent_analysis_id`.
 
**Full conversation state — validates against `contracts/api/ConversationResponse.json`:**
```json
{
  "conversation_id": "conv_9f8e7d",
  "current_context": {
    "location": {
      "original": {
        "name": "Mumbai",
        "lat": 18.922,
        "lon": 72.8347
      },
      "validated": {
        "lat": 19.05,
        "lon": 72.87,
        "snapped": true,
        "snap_distance_km": 6.8,
        "snap_reference": "offshore, west of Mumbai coastline"
      }
    },
    "activity": "fishing",
    "vessel_type": "motorized_country_craft"
  },
  "messages": [
    {
      "role": "user",
      "text": "Is it safe to fish tomorrow morning near Mumbai?",
      "timestamp": "2026-09-12T09:14:58Z",
      "detected_language": "en",
      "response_language": null,
      "analysis_id": "req_20260912_0915_f4e9d1"
    },
    {
      "role": "orca",
      "text": "Go with caution near your point; head to P2 (NE) for genuinely safe conditions.",
      "timestamp": "2026-09-12T09:15:12Z",
      "detected_language": null,
      "response_language": "en",
      "analysis_id": "req_20260912_0915_f4e9d1"
    },
    {
      "role": "user",
      "text": "Why is P3 dangerous and where should I go instead?",
      "timestamp": "2026-09-12T09:20:00Z",
      "detected_language": "en",
      "response_language": null,
      "analysis_id": "req_20260912_0915_f4e9d1"
    },
    {
      "role": "orca",
      "text": "P3 is 5km due east of your point. It's DANGEROUS because wind there exceeds the vessel's absolute safety limit, which floors the score regardless of anything else \u2014 visibility is also dropping through the morning. P2, 5km to the northeast, is your best option: it's SAFE and actually easing further through the window.",
      "timestamp": "2026-09-12T09:20:04Z",
      "detected_language": null,
      "response_language": "en",
      "analysis_id": "req_20260912_0915_f4e9d1"
    }
  ]
}
```
 
**`conversations` collection document — validates against `contracts/db/ConversationDocument.json`:**
```json
{
  "conversation_id": "conv_9f8e7d",
  "current_context": {
    "location": {
      "original": {
        "name": "Mumbai",
        "lat": 18.922,
        "lon": 72.8347
      },
      "validated": {
        "lat": 19.05,
        "lon": 72.87,
        "snapped": true,
        "snap_distance_km": 6.8,
        "snap_reference": "offshore, west of Mumbai coastline"
      }
    },
    "activity": "fishing",
    "vessel_type": "motorized_country_craft"
  },
  "messages": [
    {
      "role": "user",
      "text": "Is it safe to fish tomorrow morning near Mumbai?",
      "timestamp": "2026-09-12T09:14:58Z",
      "detected_language": "en",
      "response_language": null,
      "analysis_id": "req_20260912_0915_f4e9d1"
    },
    {
      "role": "orca",
      "text": "Go with caution near your point; head to P2 (NE) for genuinely safe conditions.",
      "timestamp": "2026-09-12T09:15:12Z",
      "detected_language": null,
      "response_language": "en",
      "analysis_id": "req_20260912_0915_f4e9d1"
    },
    {
      "role": "user",
      "text": "Why is P3 dangerous and where should I go instead?",
      "timestamp": "2026-09-12T09:20:00Z",
      "detected_language": "en",
      "response_language": null,
      "analysis_id": "req_20260912_0915_f4e9d1"
    },
    {
      "role": "orca",
      "text": "P3 is 5km due east of your point. It's DANGEROUS because wind there exceeds the vessel's absolute safety limit, which floors the score regardless of anything else \u2014 visibility is also dropping through the morning. P2, 5km to the northeast, is your best option: it's SAFE and actually easing further through the window.",
      "timestamp": "2026-09-12T09:20:04Z",
      "detected_language": null,
      "response_language": "en",
      "analysis_id": "req_20260912_0915_f4e9d1"
    }
  ],
  "subscriber_id": null,
  "created_at": "2026-09-12T09:14:58Z",
  "updated_at": "2026-09-12T09:20:04Z"
}
```
 
---
 
## BONUS — Geofence check (independent of the analysis above, same fisherman underway)
 
**`POST /api/v1/geofence/check` — validates against `contracts/api/GeofenceCheckRequest.json`:**
```json
{
  "lat": 19.05,
  "lon": 72.87,
  "device_id": "dev_58a2f1",
  "vessel_type": "motorized_country_craft",
  "language_override": null
}
```
 
**Response — validates against `contracts/api/GeofenceCheckResponse.json`:**
```json
{
  "state": "approaching",
  "layer_name": "eez_boundary",
  "constraint_type": "warning_only",
  "distance_km": 4.2,
  "bearing_deg": 265,
  "warning_text": "You are 4.2km from the India-Pakistan maritime boundary. Continuing west is not recommended.",
  "deduplicated": false
}
```
This path never touches the LLM or the AI Service — pure geometry against the cached `gis_layers` collection, target latency under 1 second.
 
---
 
## Anomalies and contradictions found while building this file
 
Everything above passed validation against its real schema on the first try **except one** — the most important finding of this whole exercise:
 
1. **Real bug, fixed:** `contracts/Measurement.json` required `source` and `retrieved_at` as non-nullable strings. But the entire never-fabricate principle — the one that caused the Day 1 restart — depends on representing a field with **no** source that was **never** retrieved (`status: "not_mapped"`). The schema couldn't validate its own most important case. Fixed: both are now `["string", "null"]`, null exactly when `status` is `"missing"` or `"not_mapped"`. Re-verified clean across all 44 files afterward.
2. **Not a bug, deliberately different:** earlier verification flagged `AlertEventDocument.channel` including `null` as a possible mismatch against `AlertSubscriptionRequest.channel`. It isn't — one is required (a subscription must pick a channel), the other is nullable (an audit entry can record that no channel was chosen because nothing was sent).
3. **Confirmed via your own old reference file, not just the doc:** the grid is **P0–P8, 9 points** — your file's own worked example uses exactly this range throughout. Update anywhere "P0-P9" appears in your notes.
4. **New finding, not yet fixed — needs a decision, not just an edit:** `shared/VesselProfile.json` names its wind threshold field `wind_kn`, implying knots. Nothing enforces that a weather agent's wind measurement is actually reported in knots rather than m/s — `Measurement.unit` is a free string. This file deliberately used `"unit": "kn"` to keep the numbers meaningful against the threshold, but a future implementation emitting m/s would silently compare it against a knots threshold and corrupt every risk score derived from it. Needs a fixed per-parameter unit table or a runtime check.
5. **Confirmed gap, not a schema problem:** Stage 2's Backend → AI Service call has no named path anywhere in §103 — only the reverse direction (`/internal/v1/progress`, `/internal/v1/result`) is documented. `ai-service/main.py` needs some entry route; this file didn't invent one to avoid presenting a guess as settled fact.
6. **Undocumented aggregation rule:** how `baseline_score` rolls up from `hourly_scores` isn't specified. §48.4 says a baseline is computed "for every hour with data," but not how that becomes the single top-level `baseline_score` (max across the window? a specific reference hour?). The numbers here are internally plausible but the aggregation rule itself is an assumption, not a doc-confirmed fact.
7. **RESOLVED after this file was first drafted:** `analysis_id` = `req_{YYYYMMDD}_{HHMM}_{hash6}` using request **receipt** time, not the doc's `an_7f3c...` example and not the target analysis window either (the window is often unresolved at ID-generation time for natural-language requests). This file's own `req_20260913_0600_f4e9d1` was corrected to `req_20260912_0915_f4e9d1` for exactly that reason once the rule was settled.