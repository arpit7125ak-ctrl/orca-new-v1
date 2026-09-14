# ORCA Backend — Start & Testing Guide

**Team Nautilus · SIH Problem Statement 26176**

This guide takes you from a fresh clone to a fully tested backend in Postman. Follow it in order. Every step says what you should see, so if something differs you know immediately where it broke.

---

## Part 1 — Prerequisites

You need three things installed:

| Thing | Version | Check it with | If missing |
|---|---|---|---|
| Node.js | 18 or newer | `node --version` | nodejs.org (download the LTS) |
| MongoDB | 6 or newer | `mongod --version` | mongodb.com/try/download/community |
| Postman | any recent | — | postman.com/downloads |

**On the Node version:** if `node --version` prints something starting with `v16` or lower, upgrade. The code uses features that do not exist in older versions and will crash in confusing ways.

---

## Part 2 — Get MongoDB running

The backend will not start without a database. Start MongoDB **first**, every time.

**Windows** — MongoDB usually installs as a service that starts automatically. Check it:
```
services.msc
```
Look for "MongoDB Server". If it says Stopped, right-click → Start.

**macOS (installed via Homebrew):**
```bash
brew services start mongodb-community
```

**Linux:**
```bash
sudo systemctl start mongod
```

**Verify it is actually up** — this is the step people skip and then waste an hour:
```bash
mongosh --eval "db.runCommand({ping:1})"
```
You want to see `{ ok: 1 }`. If you get a connection error, MongoDB is not running and nothing below will work.

> **Using MongoDB Atlas instead?** That is fine. Skip the above, and in Part 3 set `MONGO_URI` to your Atlas connection string. Make sure your current IP is on the Atlas Network Access allowlist, or every connection will hang and then time out.

---

## Part 3 — Configure the backend

```bash
cd backend
npm install
```

This takes a minute or two. Warnings about deprecated transitive packages are normal. **Errors** are not — if `npm install` fails, stop and fix it before continuing.

Now create your `.env` from the template:

**Windows (PowerShell):**
```powershell
Copy-Item .env.example .env
```

**macOS / Linux:**
```bash
cp .env.example .env
```

Open `.env` and change **two** values. The rest of the defaults are fine for local development.

```env
INTERNAL_SECRET=any-long-random-string-you-like-at-least-32-chars
JWT_SECRET=another-different-long-random-string-at-least-32-chars
```

These must not be empty — `src/config/env.js` deliberately refuses to start without them, so a missing secret fails loudly at boot instead of silently at request time.

Need to generate them quickly?
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Run it twice, use a different output for each.

**Confirm your `.env` looks roughly like this:**
```env
NODE_ENV=development
PORT=4000
INTERNAL_PORT=4100
INTERNAL_SECRET=<your long random string>
MONGO_URI=mongodb://localhost:27017/orca
AI_SERVICE_URL=http://localhost:8000
ALLOWED_ORIGINS=http://localhost:5173
JWT_SECRET=<your other long random string>
LOG_LEVEL=info
```

---

## Part 4 — Seed the database

Two commands. Run them once.

```bash
npm run create-indexes
npm run seed:gis
npm run seed:ports
```

**Why `create-indexes` matters:** Mongoose builds indexes in the background by default. On a fresh database, your first geofence check can hit an unindexed collection and take seconds instead of milliseconds. Running this makes it deterministic. Do it before any demo.

You should see:
```
=== Verifying critical indexes ===
  OK      gis_layers.geometry_2dsphere
  OK      analyses.analysis_id_1
  ...
```

If any line says `MISSING`, the script tells you why that index matters. Re-run it; if it still fails, MongoDB is not reachable.

**What the seed scripts load:** simplified demonstration boundary polygons and about 16 Indian ports. Every seeded layer is labelled `source: "DEMO_SEED_DATA"` and `demo_only: true` — deliberately, so nothing presents approximate geometry as if it were an official boundary. Replace with real Marine Regions / WDPA / Bhuvan GeoJSON before any real-world use.

---

## Part 5 — Start the servers

The backend runs as **three separate processes**. Open three terminals.

### Terminal 1 — public API (the one Postman talks to)
```bash
cd backend
npm run dev
```

Expect:
```
[registry] Loaded 7 activities, 6 vessel types, 10 languages, 23 canonical units
[db] Connected to MongoDB
[server] ORCA Backend API listening on http://localhost:4000
```

### Terminal 2 — internal API (the AI Service calls this back)
```bash
cd backend
npm run dev:internal
```

Expect:
```
[internal-server] ORCA internal API listening on http://localhost:4100
```

### Terminal 3 — alert worker (optional for testing)
```bash
cd backend
npm run dev:worker
```

Only needed if you want to watch proactive alerting run. Skip it for basic API testing.

> **Why three processes?** The internal channel is on its own port so it is never exposed publicly. The worker is separate because if the cron ran inside the API and you scaled the API to three instances, every subscriber would get three notifications.

### Expected warnings — these are fine

```
[contracts] contracts/ directory not found. Contract validation is DISABLED.
[bhashini] BHASHINI_API_URL / BHASHINI_API_KEY not set.
[webPush] VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY not set.
```

All three are optional subsystems degrading honestly rather than pretending to work. The server runs fine. See Part 9 to enable them.

---

## Part 6 — Import the Postman collection

1. Open Postman
2. **Import** (top left)
3. Drop in `backend/ORCA_Backend.postman_collection.json`
4. Click the collection name → **Variables** tab
5. Confirm `baseUrl` = `http://localhost:4000` and `internalUrl` = `http://localhost:4100`

The collection captures `analysis_id`, `conversation_id`, `route_id` and `subscription_id` automatically as you go, so you never copy an ID by hand.

---

## Part 7 — Run the tests in order

### Step 1 — Health (folder `0. Health`)

Run all three. **Every one must pass before you continue.** If `/health/ready` shows `mongodb.connected: false`, go back to Part 2.

`GET /api/v1/config` is a good sanity check that the shared config loaded — it should show 7 activities, 6 vessel types, 10 languages, and `wind_speed: "m/s"`.

### Step 2 — Analysis validation (folder `1. Analysis`)

Run these **in order**. The first one captures `analysis_id` for everything later.

| Request | Expected | What it proves |
|---|---|---|
| POST valid | **202** (or 502) | Accepted for async execution |
| POST empty body | **400** | Section 7.1 minimum input |
| POST lat 200 | **400** + `invalid_location` | Section 7.2 range check |
| POST unknown activity | **400** listing valid values | Section 7.6 |
| POST flat lat/lon | **400** naming `coordinate` | Contract nests coordinates |
| POST overnight window | **202** | A clock range `22:00 → 04:00` is legal |
| GET status | **200** | Polling endpoint |
| GET full result | **200** or **206** | 206 = partial data |
| GET malformed id | **400** | Bad input, not missing resource |
| GET missing id | **404** | Missing resource |

**Request shapes come from the contracts, not from intuition.** The three that catch people out:

```jsonc
{
  "coordinate": { "lat": 13.0827, "lon": 80.5 },   // NOT flat lat/lon
  "time_range": { "start": "06:00", "end": "10:00" }, // NOT start_time/end_time
  "language_override": "en"                         // NOT "language"
}
```

Every contract is `additionalProperties: false`, so an extra or misnamed field fails the whole request. The validator returns a message naming the correct shape rather than an opaque schema error.

**There is no `overnight` flag.** A clock range where end < start is simply legal — resolving which calendar day the end falls on is the Planner's job.

**`utc_offset_minutes` is not in the contract either.** Send it as the `X-UTC-Offset-Minutes` header if you want the Backend to build a `time_window`. Omit it and `time_window` stays `null` for the Planner to resolve — the Backend will not guess IST.

**About the 502:** if the AI Service (your teammate's Python service) is not running, `POST /analysis` returns **502** with `error_category: upstream_unavailable` — *and still returns an `analysis_id`*. That is correct behaviour, not a bug. The analysis is persisted before dispatch, so nothing is lost. Part 8 shows how to complete an analysis without the AI Service.

### Step 3 — Geofence (folder `2. Geofence`)

The safety-critical path. Requires `npm run seed:gis` to have run.

- **open sea** (15.0, 85.0) → `state: "clear"`
- **inside demo IMBL** (9.5, 79.5) → `state: "inside"`, `constraint_type: "prohibited"`, message in Tamil
- **dedup** — run the same request twice; the second returns `deduplicated: true`
- **no coords** → **400**

Check `elapsed_ms` in the response. It should be well under 1000. If it is not, your 2dsphere index is missing — re-run `npm run create-indexes`.

### Step 4 — Everything else

Run folders 3 through 9 in order. Notes on the ones that surprise people:

- **Report** returns **400** if the analysis has not completed. That is correct — a report is a cached record, and caching one built on incomplete evidence would freeze a half-finished answer forever.
- **Duplicate subscription** returns **409**. That is the partial unique index working.
- **DELETE subscription** returns 200 with `active: false`. Soft delete, because `alert_events` reference the subscription and hard-deleting would orphan the audit trail.
- **Voice** returns **502** unless Bhashini is configured. It refuses to invent a transcript — a wrong transcript feeding a safety decision is worse than an honest failure.

---

## Part 7a — Optional: run a stub AI Service for realistic testing

Without anything listening on port 8000, every `POST /analysis` fails
dispatch immediately (`ECONNREFUSED`) and the analysis lands in `failed`
before you can meaningfully test `/internal/v1/progress` or
`/internal/v1/result` against it - the analysis is already terminal.

This repo includes `stub-ai-service.js` - a minimal stand-in that does the
one thing the real AI Service must do on handoff: accept immediately.

```bash
node stub-ai-service.js
```

Run it in a fourth terminal. With it running, `POST /analysis` returns a
real `202`/`queued` and the analysis stays `running`, so the progress and
result callbacks in Part 8 actually have something live to update. This is
a test-only stub - delete it once the real AI Service exists.

## Part 8 — Complete an analysis without the AI Service

This is the important one for testing while your teammate's service is still being built. You will play the role of the AI Service.

### Step 1 — Mint an internal token

The internal endpoints need a signed short-lived token. From the `backend` folder:

```bash
node -e "require('dotenv').config();const jwt=require('jsonwebtoken');console.log(jwt.sign({iss:'orca-ai-service',aud:'orca-backend'},process.env.INTERNAL_SECRET,{expiresIn:'2h',algorithm:'HS256'}))"
```

Copy the long string it prints.

> Note `expiresIn:'2h'` — that is for convenience while testing. The real AI Service uses 120-second tokens.

### Step 2 — Paste it into Postman

Collection → **Variables** → set `internal_token` to the string you just copied → **Save**.

### Step 3 — Verify the guard works

Run **POST /internal/v1/progress - no token**. It must return **401**. If it returns 200, your internal auth is broken and that is a security problem worth stopping for.

### Step 4 — Send progress, then the result

Run these **in order**. They mirror how the real AI Service reports:

1. **progress - planner (plan + points)** → the ExecutionPlan, resolved location, time window and sampled points
2. **progress - weather agent result** → measurements with full provenance
3. **progress - tide agent FAILS** → an honest failure with `error_category`
4. **progress - risk assessment** → per-point scores, baseline → adjustment → final
5. **result - with token** → the final Decision

All should return **200**.

**Where results actually travel matters.** `InternalResultPayload` carries *only* the final artefact — exactly one of `decision` / `route_result` / `trend_result` / `report_content` / `quick_information_result`. Agent results and risk assessments arrive **during** execution, inline on `ProgressMessage.data` (or by reference via `data_ref`). If you expected to post everything in one final call, that is not how the contract works.

Note also `agent`, not `stage`, and that `status_code` and `timestamp` are required on every progress message.

### Step 5 — See the full evidence chain

Go back to folder 1 and re-run **GET /analysis/:id**. You now get a complete result with:

- per-point measurements with sources
- the risk breakdown (baseline → floors → final)
- the decision and recommendation
- the execution trace showing weather succeeded and tide failed

The analysis comes back as **206 Partial Content**, not 200 — because the tide agent failed and the evidence is genuinely incomplete. That status is what tells the Frontend to show "some data unavailable" rather than presenting this as a complete answer.

Look at how the missing data renders:

```json
{
  "value": null,
  "source": null,
  "retrieved_at": null,
  "status": "missing",
  "freshness": { "state": "unknown" }
}
```

`null`, not `0`. That is the never-fabricate rule visible in the API output — a fabricated `0.0 m` wave height reads as a flat calm sea.

Note the status vocabulary is `available | partial | missing | not_mapped | derived`. `missing` means the source was asked and returned nothing; `not_mapped` means the adapter has no mapping for that field yet. Keeping them distinct is what makes an adapter gap visible as a gap rather than hiding behind an ordinary outage.

The failed tide agent also appears in `agents_missing` on every point, with its `error_category` — because Section 50 needs to know what evidence is absent before any point can be rated safe.

Now run **GET /report/:analysis_id** — it works, and the advisory includes a "Data limitations" section naming the parameters that were unavailable and explicitly stating they were not estimated.

---

## Part 9 — Optional subsystems

### Contract validation (already enabled)

The 44-file contract set ships **inside this delivery**, at the repo root beside `backend/`:

```
orca/
├── backend/
├── contracts/          ← 44 files, already here
└── shared-config/
```

On startup you should see `[contracts] Contracts loaded {count: 44}`. Every request-bearing route validates against its contract before the handler runs.

Verify the set independently:
```bash
npm run validate-schemas    # loads and inventories the contracts
npm run check:contracts     # checks the payloads this backend emits
```

### Enable Web Push

```bash
npx web-push generate-vapid-keys
```

Put the two keys in `.env` as `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`, then restart the worker.

### Enable voice

Set `BHASHINI_API_URL` and `BHASHINI_API_KEY` in `.env` and restart.

---

## Part 10 — Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `[env] Missing required environment variable` | `.env` absent or a secret is blank | Part 3 |
| `ECONNREFUSED 127.0.0.1:27017` | MongoDB not running | Part 2 |
| `EADDRINUSE :::4000` | Port already taken | `PORT=4001` in `.env`, and update `baseUrl` in Postman |
| Every request → **429** | Rate limited | Wait 60s, or raise `RATE_LIMIT_MAX_REQUESTS` |
| Geofence always `clear` | Layers not seeded | `npm run seed:gis` |
| Geofence slow | `geometry_full` 2dsphere index missing | `npm run create-indexes` |
| **400 `additionalProperties`** | Field not in the contract | Check the shape table above |
| **400 on `language`** | Field is `language_override` | Rename it |
| Internal endpoint → **401** | Token missing/expired | Re-mint (Part 8) |
| `POST /analysis` → **502** | AI Service not running | Expected. Use Part 8 |
| Report → **400** | Analysis not finished | Complete it via Part 8 first |
| `Cannot find module 'pino'` | Deps not installed | `npm install` |

### Two commands that answer "is my code broken or my setup?"

```bash
npm run check     # parses every source file without executing it
npm test          # runs the unit/contract suites — no database needed
```

If both pass, the code is fine and the problem is environmental.

---

## Quick reference

```bash
# one-time setup
npm install
cp .env.example .env          # then edit the two secrets
npm run create-indexes
npm run seed:gis && npm run seed:ports

# every session (three terminals)
npm run dev                   # :4000  public API
npm run dev:internal          # :4100  AI Service callbacks
npm run dev:worker            # alert scheduler (optional)

# verification
npm run check                 # syntax + contract conformance
npm test                      # unit + contract tests
npm run validate-schemas      # inventory the contract set
npm run check:contracts       # verify emitted payload shapes
```

| Endpoint | Method | Purpose |
|---|---|---|
| `/health` | GET | Liveness |
| `/health/ready` | GET | Readiness (Mongo, AI Service, contracts) |
| `/api/v1/config` | GET | Activities, vessels, languages, units |
| `/api/v1/analysis` | POST | Create analysis → 202 |
| `/api/v1/analysis/:id` | GET | Full result → 200/206 |
| `/api/v1/analysis/:id/status` | GET | Poll progress |
| `/api/v1/chat/message` | POST | Conversational query |
| `/api/v1/chat/:id` | GET | Conversation |
| `/api/v1/chat/:id/history` | GET | Paginated history |
| `/api/v1/map/layers` | GET | Reference GIS layers |
| `/api/v1/geofence/check` | POST | Live GPS boundary check |
| `/api/v1/route` | POST | Route request |
| `/api/v1/route/:id` | GET | Route result |
| `/api/v1/trend` | POST | Historical/trend analysis |
| `/api/v1/report/:analysis_id` | GET | Shareable advisory |
| `/api/v1/alerts/subscriptions` | POST | Create → 201 |
| `/api/v1/alerts/subscriptions/:id` | GET/PATCH/DELETE | Manage |
| `/api/v1/voice/query` | POST | Audio in |
| `/api/v1/voice/speak` | POST | Audio out |
| `/internal/v1/progress` | POST | **:4100**, token required |
| `/internal/v1/result` | POST | **:4100**, token required |
