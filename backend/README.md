# ORCA Backend

**Team Nautilus · SIH Problem Statement 26176 · ISRO / Space Technology**

The backend for ORCA — an agentic marine intelligence platform that turns satellite Earth Observation, oceanographic and geospatial data into explainable go/no-go safety advisories for fishermen and coastal operators.

This service receives, validates, persists and tracks analysis requests. It is the only layer permitted to talk to MongoDB or the AI Service.

---

## Quick start

```bash
npm install
cp .env.example .env          # then set INTERNAL_SECRET and JWT_SECRET
npm run create-indexes
npm run seed:gis && npm run seed:ports
npm run dev                   # :4000
```

Full step-by-step instructions, including Postman testing: **[docs/ORCA_BACKEND_POSTMAN_GUIDE.md](docs/ORCA_BACKEND_POSTMAN_GUIDE.md)**

Why the code is built the way it is: **[docs/ORCA_BACKEND_BUILD_NOTES.md](docs/ORCA_BACKEND_BUILD_NOTES.md)**

---

## Three processes

| Command | Port | Role |
|---|---|---|
| `npm run dev` | 4000 | Public API — the Frontend talks to this |
| `npm run dev:internal` | 4100 | AI Service callbacks — never exposed publicly |
| `npm run dev:worker` | — | Alert scheduler (cron) |

The internal channel is a separate process on a separate port so it can be bound to a private network, and the worker is separate so a scaled-out API tier cannot fire duplicate alerts.

---

## Architecture position

```
Frontend  →  Backend  →  AI Service  →  Backend  →  Frontend
```

Never Frontend → AI Service. Never Frontend → Bhashini. This protects internal services and credentials (architecture doc §102).

The backend contains **no** data-source logic. Nothing here knows what INCOIS or IMD is — all external data arrives via the AI Service as normalised `Measurement` objects, which is why swapping mock adapters for real ones never requires touching this code.

---

## The rule that shapes everything

**Never fabricate.** Missing or unmapped data renders as explicitly unavailable — never as a placeholder, never as zero, never interpolated.

A fabricated `0.0 m` wave height reads as a flat calm sea. That is the most dangerous wrong answer a marine safety system can give. The rule is enforced in schema nullability, Ajv configuration, the point-merge layer, time handling, the execution trace, and every external client.

---

## Verification

```bash
npm run check              # parse every source file + verify contract conformance
npm test                   # unit + contract suites (no database needed)
npm run check:contracts    # payload shapes vs. the 44 contracts
npm run validate-schemas   # inventory the contracts/ set
```

All request and response shapes are validated against the locked 44-file
contract set in `../contracts`. `npm run check:contracts` verifies the exact
payloads this service emits, so field-name drift fails the build rather than
surfacing as a 400 during the demo.

---

## Stack

Node.js 18+ · Express 4 · Mongoose 8 · MongoDB 6+ · Ajv · pino · node-cron · web-push

Plain JavaScript throughout — not TypeScript.
