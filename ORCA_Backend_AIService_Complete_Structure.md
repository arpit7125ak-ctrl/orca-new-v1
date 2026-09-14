# ORCA — Complete Backend + AI Service Folder Structure (Every File Named)
 
No `...`, no collapsed folders. `contracts/` and `shared-config/` stay as already finalized (44 JSON Schema files — see `ORCA_Final_Folder_Structure.md` for that tree); this document expands **only** `backend/` and `ai-service/` down to every individual file.
 
Two things flagged inline where this listing forced a decision the doc doesn't make: `ai-service/api/entry.py` (Backend→AI Service has no named path in §103) and `backend/src/modules/auth/` user-management routes (the `users` collection exists via `User.json`, but §103 defines no endpoints for it). Both are marked `NEW/PROPOSED` below — call these out to your team before building against them, they aren't doc-confirmed.
 
---
 
## `backend/`
 
```
backend/
├── package.json
├── .env.example
│
├── src/
│   ├── server.js
│   ├── internal-server.js
│   ├── worker.js
│   ├── app.js
│   │
│   ├── config/
│   │   ├── env.js
│   │   ├── limits.js
│   │   └── registry.js
│   │
│   ├── db/
│   │   ├── connection.js
│   │   ├── indexes.js
│   │   └── models/
│   │       ├── analysis.model.js              # db/AnalysesDocument.json
│   │       ├── agentResult.model.js            # AgentResult.json
│   │       ├── riskResult.model.js             # db/RiskResultsDocument.json
│   │       ├── decision.model.js               # Decision.json
│   │       ├── gisLayer.model.js               # db/GisLayerDocument.json
│   │       ├── alertSubscription.model.js      # api/AlertSubscriptionResponse.json
│   │       ├── alertEvent.model.js             # db/AlertEventDocument.json
│   │       ├── geofenceEvent.model.js          # db/GeofenceEventDocument.json
│   │       ├── conversation.model.js           # db/ConversationDocument.json
│   │       ├── route.model.js                  # RouteResult.json
│   │       ├── report.model.js                 # ReportContent.json
│   │       └── user.model.js                   # User.json
│   │
│   ├── modules/
│   │   ├── analysis/
│   │   │   ├── analysis.routes.js              # POST /analysis, GET /:id, GET /:id/status
│   │   │   ├── analysis.controller.js
│   │   │   ├── analysis.service.js             # create id + record, dispatch to AI, lifecycle states
│   │   │   ├── analysis.validator.js           # structural validation, §7
│   │   │   ├── pointMerge.js                   # point_id association, drops+logs not_applicable
│   │   │   ├── statusBuilder.js                # assembles AnalysisStatusResponse
│   │   │   └── resultBuilder.js                # assembles AnalysisResultResponse (plan+points+decision/route/trend)
│   │   │
│   │   ├── internal/
│   │   │   ├── internal.routes.js              # POST /internal/v1/progress, /result
│   │   │   ├── progress.controller.js          # consumes ProgressMessage.json
│   │   │   └── result.controller.js            # consumes api/InternalResultPayload.json
│   │   │
│   │   ├── chat/
│   │   │   ├── chat.routes.js                  # POST /chat/message, GET /chat/:id, GET /chat/:id/history
│   │   │   ├── chat.controller.js
│   │   │   ├── chat.service.js
│   │   │   ├── contextBuilder.js               # summarised analysis context for Chat Agent
│   │   │   └── conversationHistory.controller.js
│   │   │
│   │   ├── geofence/
│   │   │   ├── geofence.routes.js              # POST /geofence/check
│   │   │   ├── geofence.controller.js
│   │   │   ├── geofence.service.js             # pure geometry, no LLM, <1s
│   │   │   ├── dedup.js
│   │   │   └── auditLogger.js                  # writes db/GeofenceEventDocument.json rows
│   │   │
│   │   ├── map/
│   │   │   ├── map.routes.js                   # GET /map/layers
│   │   │   └── map.controller.js
│   │   │
│   │   ├── route/
│   │   │   ├── route.routes.js                 # POST /route, GET /route/:id
│   │   │   ├── route.controller.js
│   │   │   └── route.service.js                # proxy to AI Service + persist RouteResult.json
│   │   │
│   │   ├── trend/
│   │   │   ├── trend.routes.js                 # POST /trend
│   │   │   ├── trend.controller.js
│   │   │   └── trend.service.js
│   │   │
│   │   ├── report/
│   │   │   ├── report.routes.js                # GET /report/:analysis_id
│   │   │   ├── report.controller.js
│   │   │   └── report.service.js
│   │   │
│   │   ├── alerts/
│   │   │   ├── subscriptions.routes.js         # CRUD, POST/GET/PATCH/DELETE
│   │   │   ├── subscriptions.controller.js
│   │   │   ├── subscriptions.service.js
│   │   │   ├── scheduler.js                    # used only by worker.js
│   │   │   ├── dedup.js
│   │   │   ├── eventLogger.js                  # writes db/AlertEventDocument.json rows
│   │   │   └── delivery/
│   │   │       └── webPush.js                  # SMS/WhatsApp adapters slot in here later
│   │   │
│   │   ├── voice/
│   │   │   ├── voice.routes.js                 # POST /voice/query
│   │   │   ├── voice.controller.js
│   │   │   └── voice.service.js                # Bhashini proxy
│   │   │
│   │   └── auth/
│   │       ├── auth.routes.js                  # NEW/PROPOSED — no §103 endpoint defined for User.json
│   │       ├── auth.controller.js              # NEW/PROPOSED
│   │       ├── user.service.js                 # NEW/PROPOSED — User.json CRUD
│   │       └── inviteCode.js                   # invite-code redemption, role assignment
│   │
│   ├── clients/
│   │   ├── aiService.client.js                 # signed, short-lived tokens; sends api/AnalysisExecutionRequest.json
│   │   └── bhashini.client.js
│   │
│   ├── middleware/
│   │   ├── internalAuth.js                     # protects /internal/v1
│   │   ├── roleGuard.js
│   │   ├── rateLimit.js
│   │   ├── cors.js
│   │   ├── sanitize.js                         # query/chat text before it reaches any tool
│   │   ├── validateContract.js                 # Ajv against ../../contracts/**/*.json
│   │   └── errorHandler.js
│   │
│   ├── errors/
│   │   ├── errorCategories.js                  # mirrors shared/ErrorInfo.json's error_category enum
│   │   └── httpStatus.js                       # §40 status-code mapping
│   │
│   ├── i18n/
│   │   └── templates/
│   │       ├── geofenceWarnings.json           # pre-translated per §66.2
│   │       └── alertMessages.json
│   │
│   ├── observability/
│   │   ├── logger.js                           # redacts keys, limits GPS trails
│   │   └── trace.js                            # execution_trace writer, §100
│   │
│   └── utils/
│       ├── ids.js                              # analysis_id generator — format still open
│       └── time.js                             # local + UTC window handling
│
├── scripts/
│   ├── seed-gis-layers.js                      # populates db/GisLayerDocument.json rows
│   ├── seed-ports.js
│   ├── create-indexes.js
│   └── validate-schemas.js                     # ajv.compile() on every contracts/**/*.json in CI
│
└── tests/
    ├── unit/
    │   ├── pointMerge.test.js
    │   ├── dedup.test.js
    │   ├── ids.test.js
    │   └── resultBuilder.test.js
    ├── integration/
    │   ├── analysisLifecycle.test.js
    │   ├── internalAuth.test.js
    │   ├── geofenceLatency.test.js
    │   └── alertDedup.test.js
    └── contract/
        └── everyResponse.test.js               # validates live responses against contracts/**/*.json
```
 
**Backend file count: 79**
 
---
 
## `ai-service/`
 
```
ai-service/
├── main.py                                     # FastAPI entrypoint
│
├── api/
│   └── entry.py                                # NEW/PROPOSED — receives api/AnalysisExecutionRequest.json;
│                                                #   §103 never names this path, only the reverse direction
│
├── graph/
│   ├── state.py                                # LangGraph shared state schema (Pydantic)
│   ├── build_graph.py                          # StateGraph node/edge wiring
│   └── nodes/
│       ├── planner_node.py
│       ├── risk_node.py
│       ├── decision_node.py
│       ├── route_node.py
│       ├── trend_node.py
│       ├── report_node.py
│       └── chat_node.py
│
├── planner/
│   ├── planner_llm.py                          # plan validation → ExecutionPlan.json
│   ├── language_detector.py                    # §11
│   ├── intent_classifier.py                    # §12
│   ├── geocoder.py                             # §13.1
│   ├── land_sea_mask.py                        # §13.2
│   ├── offshore_snapping.py                    # §13.3 → Location.json
│   ├── time_parser.py                          # §14 → TimeWindow.json
│   └── spatial_sampling.py                     # §15-17 → PointObservation.json array
│
├── agents/
│   ├── weather_agent.py
│   ├── ocean_agent.py
│   ├── tide_agent.py
│   ├── cyclone_agent.py
│   ├── ecosystem_agent.py
│   ├── pfz_agent.py
│   └── gis_agent.py
│
├── adapters/
│   ├── weather/
│   │   ├── imd_adapter.py
│   │   └── open_meteo_adapter.py
│   ├── ocean/
│   │   ├── incois_osf_adapter.py
│   │   └── copernicus_adapter.py
│   ├── ecosystem_mosdac_adapter.py
│   ├── gis_bhuvan_adapter.py
│   ├── pfz_incois_adapter.py
│   └── mock/
│       ├── mock_weather.py
│       ├── mock_ocean.py
│       ├── mock_gis.py
│       ├── mock_pfz.py
│       └── mock_ecosystem.py
│
├── risk/
│   ├── baseline.py                             # §48, deterministic scoring
│   ├── official_warning_override.py            # §49
│   ├── hard_rules.py                           # §50
│   ├── risk_llm.py                             # §51, bounded LLM adjustment
│   └── risk_validator.py                       # §56.2, validates against schemas/risk_assessment.py
│
├── decision/
│   ├── point_selector.py                       # §59, hard-constraint selection → excluded_points[]
│   ├── best_time.py                            # §63, best_time_windows[]
│   ├── decision_llm.py
│   └── decision_validator.py                   # §56.3
│
├── route/
│   ├── cost_grid.py
│   └── pathfinder.py                           # A*/Dijkstra → RouteResult.json
│
├── trend/
│   ├── anomaly_calc.py
│   └── trend_llm.py                            # → TrendResult.json
│
├── report/
│   └── report_agent.py                         # → ReportContent.json
│
├── visualization/
│   └── viz_spec_builder.py                     # §32.5
│
├── chat/
│   ├── chat_agent.py
│   └── followup_decider.py                     # §90.1, stored_evidence vs new_analysis
│
├── data_discovery/
│   ├── data_catalog.py                         # §19.1
│   └── data_plan_builder.py                    # → ExecutionPlan.data_plan[]
│
├── registry/
│   ├── agent_registry.yaml                     # §22, single source of truth for agent capabilities
│   └── registry_loader.py
│
├── prompts/
│   ├── planner_prompt.md
│   ├── risk_prompt.md
│   ├── decision_prompt.md
│   ├── trend_prompt.md
│   ├── report_prompt.md
│   └── chat_prompt.md
│
├── config/
│   ├── risk_thresholds.yaml                    # §48.5 — 0-34/35-64/65-84/85-100 default bands
│   ├── official_warning_rules.yaml             # §49.2
│   ├── gis_constraints.yaml                    # §65.1
│   └── vessel_profiles.yaml                    # validated against contracts/shared/VesselProfile.json
│
├── schemas/                                    # GENERATED by contracts/generate.sh — one .py per contracts/*.json.
│   │                                            #   Never hand-edited. Mirrors contracts/ folder-for-folder.
│   ├── analysis_request.py                     # AnalysisRequest.json
│   ├── point_observation.py                    # PointObservation.json
│   ├── measurement.py                          # Measurement.json
│   ├── risk_assessment.py                      # RiskAssessment.json
│   ├── decision.py                             # Decision.json
│   ├── user.py                                 # User.json
│   ├── execution_plan.py                       # ExecutionPlan.json
│   ├── agent_result.py                         # AgentResult.json
│   ├── progress_message.py                     # ProgressMessage.json
│   ├── route_result.py                         # RouteResult.json
│   ├── trend_result.py                         # TrendResult.json
│   ├── report_content.py                       # ReportContent.json
│   │
│   ├── shared/
│   │   ├── location.py                         # shared/Location.json
│   │   ├── time_window.py                      # shared/TimeWindow.json
│   │   ├── vessel_profile.py                   # shared/VesselProfile.json
│   │   ├── data_field_status.py                # shared/DataFieldStatus.json
│   │   ├── freshness.py                        # shared/Freshness.json
│   │   ├── data_quality.py                     # shared/DataQuality.json
│   │   ├── agent_selection.py                  # shared/AgentSelection.json
│   │   └── error_info.py                       # shared/ErrorInfo.json
│   │
│   ├── api/
│   │   ├── analysis_execution_request.py       # api/AnalysisExecutionRequest.json
│   │   ├── analysis_created_response.py        # api/AnalysisCreatedResponse.json
│   │   ├── analysis_status_response.py         # api/AnalysisStatusResponse.json
│   │   ├── analysis_result_response.py         # api/AnalysisResultResponse.json
│   │   ├── chat_message_request.py             # api/ChatMessageRequest.json
│   │   ├── chat_message_response.py            # api/ChatMessageResponse.json
│   │   ├── conversation_response.py            # api/ConversationResponse.json
│   │   ├── map_layers_response.py              # api/MapLayersResponse.json
│   │   ├── geofence_check_request.py           # api/GeofenceCheckRequest.json
│   │   ├── geofence_check_response.py          # api/GeofenceCheckResponse.json
│   │   ├── route_request.py                    # api/RouteRequest.json
│   │   ├── trend_request.py                    # api/TrendRequest.json
│   │   ├── alert_subscription_request.py       # api/AlertSubscriptionRequest.json
│   │   ├── alert_subscription_response.py      # api/AlertSubscriptionResponse.json
│   │   ├── alert_subscription_patch_request.py # api/AlertSubscriptionPatchRequest.json
│   │   ├── voice_query_request.py              # api/VoiceQueryRequest.json
│   │   ├── voice_query_response.py             # api/VoiceQueryResponse.json
│   │   └── internal_result_payload.py          # api/InternalResultPayload.json
│   │
│   └── db/
│       ├── analyses_document.py                # db/AnalysesDocument.json
│       ├── risk_results_document.py            # db/RiskResultsDocument.json
│       ├── gis_layer_document.py               # db/GisLayerDocument.json
│       ├── alert_event_document.py             # db/AlertEventDocument.json
│       ├── conversation_document.py            # db/ConversationDocument.json
│       └── geofence_event_document.py          # db/GeofenceEventDocument.json
│
├── internal_api/
│   ├── progress.py                             # POST to Backend's /internal/v1/progress
│   └── result.py                               # POST to Backend's /internal/v1/result
│
├── security/
│   └── internal_auth.py
│
└── tests/
    ├── test_planner.py
    ├── test_weather_agent.py
    ├── test_ocean_agent.py
    ├── test_gis_agent.py
    ├── test_risk.py
    ├── test_decision.py
    ├── test_route.py
    ├── test_trend.py
    ├── test_report.py
    ├── test_chat.py
    └── test_validation.py                      # round-trips every schemas/**/*.py against contracts/**/*.json
```
 
**AI Service file count: 44 generated schema files + 61 hand-written files = 105**
 
---
 
## Grand total
 
| Layer | Files |
|---|---|
| `contracts/` (already final) | 44 |
| `backend/` | 79 |
| `ai-service/` | 105 |
| **Total** | **228** |
 
Two flags repeated from the file listing itself, since they're easy to miss buried in a tree this size:
 
- **`ai-service/api/entry.py`** and **`backend/src/modules/auth/*`** are marked `NEW/PROPOSED` — I added them because the folder structure needed *some* file to hold that logic, not because the architecture doc specifies them. Confirm both before building.
- **`ai-service/schemas/`** is now laid out as a 1:1, folder-for-folder mirror of `contracts/`. This makes the still-unwired `generate.sh` → Pydantic step concrete: it's 44 files to generate, in a known shape, not an abstract "sync the two" task.