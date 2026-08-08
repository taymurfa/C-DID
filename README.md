# GridConnects

GridConnects turns fragmented public signals into one live view of energy projects, the people driving them, and the moment to reach out. The product ships on the `Jobersteadt` branch with a marketing landing page plus the map / signal desk.

## Quick start

```bash
cp .env.example .env   # set MONGODB_URI for Atlas persistence; OPENAI_API_KEY optional
docker compose up --build
```

- Landing: `http://localhost:3000`
- Product: `http://localhost:3000/app`
- Agents: ingestion `:8001` · intelligence `:8002` · GTM `:8003`

Open **/app**, switch to Signal, and click **Analyze conference** (empty URL uses the sample conference through the same agent pipeline; paste a URL for live ingest). Agents need Atlas Network Access for the Docker host IP.

## Deploy to Render

See [`docs/RENDER.md`](docs/RENDER.md). Root [`render.yaml`](render.yaml) is a Blueprint for GridConnects plus Agents 1–3 (Docker). Connect it in Render → New → Blueprint on branch `Jobersteadt`, then set `sync: false` secrets (`MONGODB_URI`, SMTP, etc.).

Local web only:

```bash
cd frontend
npm install
npm run dev
```

## What is built

| Surface | Location | Role |
| --- | --- | --- |
| GridConnects web | [`frontend/`](frontend/) | Landing page, ERCOT atlas map, signal desk, agent proxies |
| Agent 1 | [`speaker-signal-ingestion/`](speaker-signal-ingestion/) | Public-page discovery, bounded crawling, extraction, auto-ingest |
| Agent 2 | [`intelligence-service/`](intelligence-service/) | Normalize, dedupe, ICP score, rank, explain |
| Agent 3 | [`gtm-service/`](gtm-service/) | Event-anchored sequences, draft emails, funnel persistence |

Primary live flow: `conference URL → Agent 1 /ingest → Agent 2 /qualify → Agent 3 /sequences + /funnel`. Persistence is MongoDB Atlas (`speaker_signal_ingestion` / `_intelligence` / `_gtm`). No email is sent automatically.
