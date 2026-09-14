# ORCA — Backend Delivery (contract-reconciled)

**Team Nautilus · SIH 26176**

## What is in this zip

```
orca/
├── backend/          the complete backend service
│   ├── src/          82 source files
│   ├── scripts/      setup + verification scripts
│   ├── tests/        unit + contract suites
│   ├── docs/         build notes + Postman guide
│   └── ORCA_Backend.postman_collection.json   (43 requests)
├── contracts/        the locked 44-file contract set
└── shared-config/    activities, vessel types, languages, canonical units
```

## Keep this folder layout

All three folders must stay siblings:
- `backend/src/config/registry.js` reads `../../shared-config`
- `backend/src/middleware/validateContract.js` reads `../../contracts`
- The AI Service will read the same two folders

## AI Service execute path — RESOLVED

`clients/aiService.client.js` posts to `POST {AI_SERVICE_URL}/v1/analysis/execute`,
per `contracts/api/AnalysisExecutionRequest.json`. Architecture doc §103 said
`/internal/v1/execute`, but the contract's own description notes §103 never
actually specified this route — contracts win. **Confirm the AI Service is
built to listen on `/v1/analysis/execute`.**

## This build is reconciled against the contracts

- 15/15 emitted payload shapes conform
- 19/19 Postman request bodies conform

```bash
cd backend && npm run check
```

## Read these first

1. `backend/docs/ORCA_BACKEND_POSTMAN_GUIDE.md`
2. `backend/docs/ORCA_BACKEND_BUILD_NOTES.md` (section 2a: the reconciliation)

## One-minute start

```bash
cd backend
npm install
cp .env.example .env      # set INTERNAL_SECRET and JWT_SECRET
npm run create-indexes
npm run seed:gis && npm run seed:ports
npm run dev
```
