# Candid Intelligence — Speaker Signal

**Track 2 hackathon submission** on the `Jobersteadt` branch. Point the desk at a public energy-conference agenda → get a deduplicated, explainably ranked list of ICP-fit speakers → run an event-anchored outreach cadence → watch funnel drop-off in one addictive Signal Desk.

For the Candid write-up (what / sources / compliance / next week) and the locked 5-minute demo script, see [`SUBMISSION.md`](SUBMISSION.md).

## Judge quick start

```bash
cp .env.example .env   # set MONGODB_URI for Atlas persistence; OPENAI_API_KEY optional
docker compose up --build
```

- Dashboard (Signal Desk): `http://localhost:3000`
- Agents: ingestion `:8001` · intelligence `:8002` · GTM `:8003`

Open the desk and click **Analyze conference**. Demo mode needs no credentials and walks the full DoD (5 ingested → 4 unique → 3 qualified). Live agents need Atlas Network Access for the Docker host IP.

Desk-only fallback (fixtures, no agents):

```bash
cd speaker-signal
pnpm install
pnpm dev
```

## Deploy to Render

See [`docs/RENDER.md`](docs/RENDER.md). Root [`render.yaml`](render.yaml) is a Blueprint for the web app plus Agents 1–3 (Docker). Connect it in Render → New → Blueprint on branch `Jobersteadt`, then set `sync: false` secrets (`MONGODB_URI`, SMTP, etc.).

## What is built

| Surface | Location | Role |
| --- | --- | --- |
| Signal Desk | [`speaker-signal/`](speaker-signal/) | Next.js dashboard, thin proxies to agents, demo fallback |
| Agent 1 | [`speaker-signal-ingestion/`](speaker-signal-ingestion/) | Public-page discovery, bounded crawling, extraction, auto-ingest |
| Agent 2 | [`intelligence-service/`](intelligence-service/) | Normalize, dedupe, ICP score, rank, explain (live scoring brain) |
| Agent 3 | [`gtm-service/`](gtm-service/) | Event-anchored sequences, draft emails, funnel persistence |

Primary live flow: `conference URL → Agent 1 /ingest → Agent 2 /qualify → Agent 3 /sequences + /funnel`. Persistence is MongoDB Atlas (`speaker_signal_ingestion` / `_intelligence` / `_gtm`). Email send defaults to **mock** (`SEND_MODE=mock`).

Optional Project Radar flavor: static ERCOT atlas under [`frontend/`](frontend/) — not required for the Track 2 demo.

## Demo path

1. Click **Analyze conference** in Demo mode.
2. Confirm five ingested records resolve to four unique people and three qualified leads.
3. Select a ranked speaker → evidence, score breakdown, T−14 → T−7 → T−2 → Event → T+2 cadence.
4. Sequences → personalized drafts with opt-out; UI states send is mocked / draft-only.
5. Funnel → advance a status and show drop-off from identified toward booked.

Product spec: [`docs/SPEAKER_SIGNAL_SPEC.md`](docs/SPEAKER_SIGNAL_SPEC.md).
