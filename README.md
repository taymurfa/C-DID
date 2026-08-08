# Candid Intelligence — Speaker Signal

Speaker Signal is the Track 2 hackathon submission on the `Jobersteadt` branch. It turns public energy-conference agendas into a deduplicated, explainably ranked list of ICP-fit speakers, then makes the event-anchored outreach motion and funnel visible in one desk.

## Judge quick start

```bash
cp .env.example .env   # set MONGODB_URI for Atlas persistence; OPENAI_API_KEY optional
docker compose up --build
```

- Dashboard: `http://localhost:3000`
- Agents: ingestion `:8001` · intelligence `:8002` · GTM `:8003`

Open the desk and click **Analyze conference**. Demo mode needs no credentials. Live agents need Atlas Network Access for the Docker host IP.

## Deploy to Render

See [`docs/RENDER.md`](docs/RENDER.md). Root [`render.yaml`](render.yaml) is a Blueprint for the dashboard plus Agents 1–3 (Docker). Connect it in Render → New → Blueprint on branch `Jobersteadt`, then set `sync: false` secrets (`MONGODB_URI`, SMTP, etc.).

Local dashboard only (fixture demo):

```bash
cd speaker-signal
pnpm install
pnpm dev
```

## What is built

| Surface | Location | Role |
| --- | --- | --- |
| Signal Desk | [`speaker-signal/`](speaker-signal/) | Next.js dashboard, thin proxies to agents, demo fallback |
| Agent 1 | [`speaker-signal-ingestion/`](speaker-signal-ingestion/) | Public-page discovery, bounded crawling, extraction, auto-ingest |
| Agent 2 | [`intelligence-service/`](intelligence-service/) | Normalize, dedupe, ICP score, rank, explain (live scoring brain) |
| Agent 3 | [`gtm-service/`](gtm-service/) | Event-anchored sequences, draft emails, funnel persistence |

Primary live flow: `conference URL → Agent 1 /ingest → Agent 2 /qualify → Agent 3 /sequences + /funnel`. Persistence is MongoDB Atlas (`speaker_signal_ingestion` / `_intelligence` / `_gtm`). No email is sent automatically.

## Demo path

1. Click **Analyze conference** in Demo mode.
2. Confirm five ingested records resolve to four unique people and three qualified leads.
3. Select a ranked speaker to inspect evidence, score components, and the T−14 → T−7 → T−2 → Event → T+2 cadence.
4. Review the conference calendar and funnel leak from identified to conversation booked.

Detailed architecture, API contracts, configuration, tests, sources, compliance decisions, and next-week work are documented in each package README. The source brief is the [Candid AI Agent Development Guide](https://chatgpt.com/share/6a7761b3-0fd4-83ea-9bca-15dd870c3dff); live retrieval can also use the existing Firecrawl v2 preview endpoint in `speaker-signal/app/api/analyze`.
