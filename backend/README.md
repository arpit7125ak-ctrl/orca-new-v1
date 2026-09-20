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

Node.js 20+ · Express 4 · Mongoose 8 · MongoDB Atlas / 7.0 · Ajv · Pino · node-cron · web-push

---

## Live Cloud Production Deployment (Render + MongoDB Atlas)

| Endpoint | Method | Public URL | Description |
| :--- | :--- | :--- | :--- |
| **Liveness Probe** | `GET` | `https://orca-backend-anp5.onrender.com/health` | Instant process liveness response |
| **API Liveness** | `GET` | `https://orca-backend-anp5.onrender.com/api/v1/health` | Reverse-proxy compatible health check |
| **Readiness Probe** | `GET` | `https://orca-backend-anp5.onrender.com/health/ready` | Verifies Atlas connection & contract loading |
| **Analysis Dispatch** | `POST` | `https://orca-backend-anp5.onrender.com/api/v1/analysis` | Public trigger for multi-agent advisory |
| **GIS Map Layers** | `GET` | `https://orca-backend-anp5.onrender.com/api/v1/map/layers` | 299 authoritative maritime boundary layers |

*Note: In single-port cloud environments (like Render), `internalRoutes` are also mounted on `/internal/v1/*` protected by `internalAuth` JWT token authentication so internal AI callbacks work flawlessly without requiring exposed separate ports.*

---

## Future Backend Architecture & Enterprise Vision

To scale ORCA into a nationwide maritime infrastructure across all 9 coastal states and island territories, the backend transitions toward an event-driven microservice topology:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                 ORCA FINAL ENTERPRISE BACKEND ARCHITECTURE                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                  ┌──────────────────────────────────────┐                   │
│                  │  Cloudflare / AWS CloudFront Ingress │                   │
│                  └──────────────────┬───────────────────┘                   │
│                                     │ TLS 1.3 / mTLS                        │
│                                     ▼                                       │
│                  ┌──────────────────────────────────────┐                   │
│                  │  KONG / Envoy API Gateway (Rate Lmt) │                   │
│                  └──────────────────┬───────────────────┘                   │
│                                     │                                       │
│        ┌────────────────────────────┼────────────────────────────┐          │
│        ▼                            ▼                            ▼          │
│  ┌───────────┐                ┌───────────┐                ┌───────────┐    │
│  │  Core API │                │ Telemetry │                │ Broadcast │    │
│  │  Gateway  │                │ Ingestion │                │ Dispatch  │    │
│  │(Express 5)│                │(Fastify/Go│                │(WebPush/  │    │
│  └─────┬─────┘                └─────┬─────┘                │  SMS/IVR) │    │
│        │                            │                      └─────┬─────┘    │
│        │       ┌────────────────────┴────────────────────┐       │          │
│        └──────►│    Apache Kafka / NATS Event Mesh       │◄──────┘          │
│                └────────────────────┬────────────────────┘                  │
│                                     │                                       │
│        ┌────────────────────────────┼────────────────────────────┐          │
│        ▼                            ▼                            ▼          │
│  ┌───────────┐                ┌───────────┐                ┌───────────┐    │
│  │  MongoDB  │                │  Redis 7  │                │ Indian CG │    │
│  │   Atlas   │                │Distributed│                │ MRCC SAR  │    │
│  │Geospatial │                │  Cluster  │                │ Integration│   │
│  └───────────┘                └───────────┘                └───────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1. High-Throughput Telemetry Ingestion (Kafka / NATS)
- Scaled ingestion supporting **100,000+ simultaneous vessel GPS points per second** streaming from fishing craft transponders, tourist boats, and automated AIS stations.
- Partitioned topic streams for Indian Maritime Zones: West Coast, East Coast, Andaman & Nicobar, Lakshadweep.

### 2. Distributed Caching & Rate Limiting (Redis 7 Enterprise)
- Sub-millisecond geographic boundary lookups cached in Redis GEO indexes.
- Prevents database saturation during major cyclone events when concurrent user queries spike by 1,000x.

### 3. Automated Earth Observation Satellite Ingestion Pipeline
- Automated cron and webhook listeners polling ISRO MOSDAC (Oceansat-3 OCM-3), INCOIS GeoServer, and Copernicus Sentinel-3 as soon as daily granules are published.
- Automated generation of spatial GeoJSON vector contours for thermal fronts and chlorophyll plumes.

### 4. Search-and-Rescue (SAR) & Indian Coast Guard Bridge
- Automated distress payload generation when a vessel enters a `DANGEROUS` state combined with SOS trigger.
- Instant dispatch to Indian Coast Guard Maritime Rescue Coordination Centres (MRCC) in Mumbai, Chennai, and Port Blair via CAP (Common Alerting Protocol) XML.

