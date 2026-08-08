# Speaker Signal

Speaker Signal turns public energy-conference agendas into explainable, qualified people and event-anchored outreach drafts. It is a judge-ready Next.js implementation derived from the Candid Intelligence challenge and the shared AI Agent Development Guide.

## Judge quick start (Docker + Atlas)

From the **repo root** (preferred):

```bash
# Copy .env.example → .env and set MONGODB_URI (optional OPENAI_API_KEY)
docker compose up --build
```

- Dashboard: [http://localhost:3000](http://localhost:3000)
- Agents: `:8001` ingestion · `:8002` intelligence · `:8003` Agent 3 (`agents/agent3`)

One pipeline: empty URL uses the GridForward fixture; a pasted URL hits Agent 1. Both score through Agent 2 (embedded fallback if agents are down). Atlas Network Access is needed for live Mongo from Docker.

## Local Next.js only

Requirements: Node.js 20+ and pnpm.

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Analyze with an empty URL for the sample conference, or paste a public agenda URL / use Discover for live ingest.

## What works

- Run normalize → dedupe → score → rank from the Signal Desk (Agent 2 when reachable; embedded fallback otherwise).
- Sample fixture or live ingest — same qualify → sequence → funnel path.
- Ranked speakers with score components, evidence, confidence, and source links.
- Event-anchored T−14 → T−7 → T−2 → Event → T+2 sequences (via Agent 3 when available).
- Funnel roll-up with drop-off; status advances post funnel events to Agent 3.
- System health dots for Agents 1/2/3 on the Agent Runs rail.
- Mobile and desktop responsive navigation.

No email is sent. Drafts only.

## Architecture

```text
Conference URL (optional)
      │
      ▼
Next.js /api/qualify
      │
      ├── no URL ── GridForward fixture
      └── URL ──── Agent 1 /ingest
                │
                ▼
         Agent 2 /qualify  (embedded fallback)
                │
                ▼
      /api/sequence → Agent 3 /sequences
      /api/funnel   → Agent 3 /funnel
```

Persistence is **MongoDB Atlas only** (not Supabase). Collection map:

| Service | DB | Collections |
|---------|-----|-------------|
| Ingestion | `speaker_signal_ingestion` | `runs` |
| Intelligence | `speaker_signal_intelligence` | `qualifications` |
| Agent 3 | `speaker_signal_gtm` | `events`, `sequences`, `emails`, `funnel_events` |

`supabase/schema.sql` is deprecated historical reference.

## Compliance

- Public data only; HTTP(S); no private-network targets.
- No auth/CAPTCHA/paywall bypass; no automatic email sending.
- Empty-URL fixture path remains available if live sites or credentials fail during judging.

## Sources

- [Candid AI Agent Development Guide](https://chatgpt.com/share/6a7761b3-0fd4-83ea-9bca-15dd870c3dff)
- [D-Branch template](https://github.com/taymurfa/C-DID/tree/D-Branch)
