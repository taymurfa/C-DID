# Candid Intelligence — Speaker Signal + Project Radar

Dual-track hackathon build on the `Jobersteadt` branch.

- **Track 2 — Speaker Signal** (primary desk): conference agenda → ranked ICP speakers → event-anchored outreach → funnel.
- **Track 1 — Project Radar** (POC): multi-source project fixtures → entity resolution → stage inference → atlas overlay.

Write-up + Track 2 demo script: [`SUBMISSION.md`](SUBMISSION.md). Track 1 spec: [`docs/PROJECT_RADAR_SPEC.md`](docs/PROJECT_RADAR_SPEC.md).

## Judge quick start

```bash
cp .env.example .env   # set MONGODB_URI for Atlas persistence; OPENAI_API_KEY optional
docker compose up --build
```

| Surface | URL |
| --- | --- |
| Track 2 Signal Desk | http://localhost:3000 |
| Track 1 Project Radar atlas | http://localhost:3001 |
| Track 2 agents | `:8001` ingest · `:8002` intelligence · `:8003` GTM |
| Track 1 agents | `:8011` R1 · `:8012` R2 · `:8013` R3 |

Demo modes need no credentials. Live agents need Atlas Network Access for the Docker host IP.

## Demo path

**Track 2 (5 min):** open `:3000` → **Analyze conference** → 5→4→3 qualify → speaker cadence → sequences → funnel.

**Track 1 (~2 min):** open `:3001` → Map → **Demo ingest** → open the **ER**-badged Lone Star BTM project (aliases + stage evidence + people join).

## What is built

| Surface | Location | Role |
| --- | --- | --- |
| Signal Desk | [`speaker-signal/`](speaker-signal/) | Track 2 Next.js dashboard |
| Agent 1–3 | [`speaker-signal-ingestion/`](speaker-signal-ingestion/), [`intelligence-service/`](intelligence-service/), [`gtm-service/`](gtm-service/) | Track 2 pipeline |
| Project Atlas UI | [`frontend/`](frontend/) | Track 1 map + radar overlay + proxies |
| Radar R1–R3 | [`project-radar-ingest/`](project-radar-ingest/), [`project-radar-normalize/`](project-radar-normalize/), [`project-radar-score/`](project-radar-score/) | Track 1 ingest / ER / stage+join |

Email send defaults to **mock** (`SEND_MODE=mock`).

## Deploy to Render

See [`docs/RENDER.md`](docs/RENDER.md). Root [`render.yaml`](render.yaml) covers Track 2 services; add Radar agents when promoting Track 1.

Product specs: [`docs/SPEAKER_SIGNAL_SPEC.md`](docs/SPEAKER_SIGNAL_SPEC.md) · [`docs/PROJECT_RADAR_SPEC.md`](docs/PROJECT_RADAR_SPEC.md).
