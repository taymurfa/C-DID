# Candid Intelligence — Origination Desk

The `Jobersteadt` branch now combines both hackathon tracks. **Project Radar (Track 1)** resolves early-stage energy projects from public signals. **Speaker Signal (Track 2)** turns public conference agendas into explainably ranked people and event-anchored outreach. The combined signal connects the right project, company, person, and moment.

For the Candid write-up and locked 5-minute Track 2 demo, see [`SUBMISSION.md`](SUBMISSION.md).

## Judge quick start

```bash
cp .env.example .env   # set MONGODB_URI for Atlas persistence; OPENAI_API_KEY optional
docker compose up --build
```

- Dashboard: `http://localhost:3000`
- Agents: ingestion `:8001` · intelligence `:8002` · GTM `:8003`

The dashboard's fixture-backed flows need no credentials. Track 1 resolves 10 projects from 24 public-source records. Track 2 resolves five ingested speaker records to four unique people and three qualified leads. Live agents need Atlas Network Access for the Docker host IP.

Desk-only fallback:

```bash
cd speaker-signal
pnpm install
pnpm dev
```

## Demo path

1. Open **Project Radar** and click **Run refresh**.
2. Inspect project capacity, inferred stage, confidence, progression, and cross-source evidence.
3. In the combined signal, draft an intro and open Maya Chen, the speaker matched to HelioCore Energy.
4. Return to **Overview**, click **Analyze conference**, and inspect the ranked speakers, cadence, and funnel.

## What is built

| Surface | Location | Role |
| --- | --- | --- |
| Origination Desk | [`speaker-signal/`](speaker-signal/) | Project Radar, Speaker Signal, combined opportunities, and demo fallbacks |
| Agent 1 | [`speaker-signal-ingestion/`](speaker-signal-ingestion/) | Public-page discovery, bounded crawling, extraction, and auto-ingest |
| Agent 2 | [`intelligence-service/`](intelligence-service/) | Normalize, dedupe, ICP score, rank, and explain |
| Agent 3 | [`gtm-service/`](gtm-service/) | Event-anchored sequences, draft emails, and funnel persistence |

Track 1 follows `public project signals → typed extraction → entity resolution → stage inference → ranked project`. Track 2 follows `conference URL → Agent 1 → Agent 2 → Agent 3`. Email send defaults to **mock** (`SEND_MODE=mock`).

## Deploy to Render

See [`docs/RENDER.md`](docs/RENDER.md). Root [`render.yaml`](render.yaml) is a Blueprint for the web app plus Agents 1–3. Set its `sync: false` secrets in Render.

Product spec: [`docs/SPEAKER_SIGNAL_SPEC.md`](docs/SPEAKER_SIGNAL_SPEC.md).
