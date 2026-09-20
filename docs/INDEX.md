# ORCA: Operational Risk & Catch Advisory System
## Master Documentation Index

Welcome to the comprehensive technical documentation for **ORCA** (Smart India Hackathon SIH26176). 

This folder contains a complete, exhaustive, and beginner-friendly breakdown of the entire ORCA platform. Every single architectural decision, pipeline stage, background job, and code file is documented in painstaking detail so that **anyone—even someone with zero prior knowledge of this codebase—can fully understand how ORCA works, how it was built, and how to run it.**

---

## 📚 Table of Contents

| Document | Title | Description |
| :--- | :--- | :--- |
| **[01_PROJECT_OVERVIEW_AND_GOAL.md](./01_PROJECT_OVERVIEW_AND_GOAL.md)** | **Project Mission & Goals** | What ORCA is, why it was created, the marine safety crisis in India, the dual mission (Safety + Prosperity), user personas, and high-level capabilities. |
| **[02_SYSTEM_ARCHITECTURE_AND_PIPELINE.md](./02_SYSTEM_ARCHITECTURE_AND_PIPELINE.md)** | **Architecture & Pipeline** | How the system is designed, the 3-tier microservice model, the asynchronous HTTP 202 lifecycle, the multi-agent AI pipeline, and strict JSON Schema contracts. |
| **[03_CHRONOLOGICAL_CHANGELOG_AND_JOURNEY.md](./03_CHRONOLOGICAL_CHANGELOG_AND_JOURNEY.md)** | **Chronological Development Journey** | The complete history of all changes made from start to finish—including bugfixes, live Open-Meteo integration, live INCOIS GeoServer WFS integration, deduplication, and automatic daily cron synchronization. |
| **[04_BACKEND_CODEBASE_DEEP_DIVE.md](./04_BACKEND_CODEBASE_DEEP_DIVE.md)** | **Backend Codebase Deep Dive** | An exhaustive, file-by-file analysis of every single file inside `orca/backend/` (Servers, Modules, Controllers, Mongoose Models, Middleware, and Scripts). |
| **[05_AI_SERVICE_CODEBASE_DEEP_DIVE.md](./05_AI_SERVICE_CODEBASE_DEEP_DIVE.md)** | **AI Service Codebase Deep Dive** | An exhaustive, file-by-file analysis of every file inside `orca/ai-service/` (FastAPI main, Planner, Domain Agents, Adapters, Risk Evaluator, and Gemini Decision Synthesizer). |
| **[06_FRONTEND_CODEBASE_DEEP_DIVE.md](./06_FRONTEND_CODEBASE_DEEP_DIVE.md)** | **Frontend Codebase Deep Dive** | An exhaustive breakdown of `orca/frontend/` (React, Vite, Tailwind CSS, Leaflet GIS maps, Voice recognition, Multilingual Bhashini translations, and Advisory UI). |
| **[07_DEPLOYMENT_RUNBOOK_AND_API_REFERENCE.md](./07_DEPLOYMENT_RUNBOOK_AND_API_REFERENCE.md)** | **Deployment Runbook & API Reference** | Step-by-step instructions on setting up, configuring, and running all 4 services, running automated test suites, and complete API endpoint specifications. |

---

## 🧭 How to Read This Documentation

* **If you are new to the project:** Start with **[01_PROJECT_OVERVIEW_AND_GOAL.md](./01_PROJECT_OVERVIEW_AND_GOAL.md)** to understand the core mission, followed by **[02_SYSTEM_ARCHITECTURE_AND_PIPELINE.md](./02_SYSTEM_ARCHITECTURE_AND_PIPELINE.md)** to see the big picture.
* **If you want to understand the code:** Read **[04_BACKEND_CODEBASE_DEEP_DIVE.md](./04_BACKEND_CODEBASE_DEEP_DIVE.md)** and **[05_AI_SERVICE_CODEBASE_DEEP_DIVE.md](./05_AI_SERVICE_CODEBASE_DEEP_DIVE.md)**.
* **If you want to understand what we did recently (Live INCOIS integration, automation, bugfixes):** Read **[03_CHRONOLOGICAL_CHANGELOG_AND_JOURNEY.md](./03_CHRONOLOGICAL_CHANGELOG_AND_JOURNEY.md)**.
* **If you need to start the system or call the APIs:** Jump straight to **[07_DEPLOYMENT_RUNBOOK_AND_API_REFERENCE.md](./07_DEPLOYMENT_RUNBOOK_AND_API_REFERENCE.md)**.
