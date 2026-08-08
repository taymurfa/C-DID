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

Demo mode works with no keys. Live agents need Atlas Network Access for the Docker host IP.

## Local Next.js only

Requirements: Node.js 20+ and pnpm.

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Demo mode needs no credentials. For live mode, run the three agents (or `docker compose up`) and switch to **Live agents**.

## What works

- Run normalize → dedupe → score → rank from the Signal Desk (demo embeds Person 2; live calls Agent 2).
- Fixture-backed Demo mode with no credentials, or Live agents: ingest → intelligence → GTM.
- Ranked speakers with score components, evidence, confidence, and source links.
- Event-anchored T−14 → T−7 → T−2 → Event → T+2 sequences (via Agent 3 when available).
- Funnel roll-up with drop-off; status advances post funnel events to Agent 3.
- System health dots for Agents 1/2/3 on the Agent Runs rail.
- Mobile and desktop responsive navigation.

No email is sent. Drafts only.

## Architecture

```text
Conference URL
      │
      ▼
Next.js /api/qualify
      │
      ├── Demo ──── embedded Person 2 + fixture
      │
      └── Live ──── Agent 1 /ingest → Agent 2 /qualify → desk
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
- Demo mode remains available if live sites or credentials fail during judging.

## Sources

- [Candid AI Agent Development Guide](https://chatgpt.com/share/6a7761b3-0fd4-83ea-9bca-15dd870c3dff)
- [D-Branch template](https://github.com/taymurfa/C-DID/tree/D-Branch)
