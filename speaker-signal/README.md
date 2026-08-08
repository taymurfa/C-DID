# Candid Intelligence Origination Desk

The Next.js desk implements both hackathon tracks: Project Radar finds and stages emerging energy projects, while Speaker Signal finds qualified people and event-anchored outreach moments. The combined view resolves a project company to an upcoming speaker so research can become a reviewable action.

## Judge quick start (Docker + Atlas)

From the repo root:

```bash
# Copy .env.example → .env and set MONGODB_URI (optional OPENAI_API_KEY)
docker compose up --build
```

- Dashboard: [http://localhost:3000](http://localhost:3000)
- Agents: `:8001` ingestion · `:8002` intelligence · `:8003` Agent 3

One Speaker Signal pipeline handles both the empty-URL GridForward fixture and live Agent 1 ingestion. Agent 2 scores both paths, with an embedded fallback when agents are down. Atlas Network Access is needed for live Mongo from Docker.

## Local Next.js only

Requirements: Node.js 20+ and pnpm.

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Both fixture-backed tracks run without credentials. Project Radar live mode accepts up to eight public HTTP(S) URLs and uses `FIRECRAWL_API_KEY`.

## What works

- Discover, normalize, entity-resolve, rank, and stage public project signals.
- Inspect capacity, owner, location, confidence, provenance, stage progression, and evidence.
- Join a selected project to a qualified conference speaker through the resolved company.
- Run normalize → dedupe → score → rank through Agent 2 or its embedded fallback.
- Generate T−14 → T−7 → T−2 → Event → T+2 drafts through Agent 3.
- Inspect funnel drop-off and Agent 1/2/3 system health.
- Use responsive desktop and mobile navigation.

No email is sent automatically. Drafts remain reviewable.

## Project Radar (`/api/projects`)

Project Radar processes public ERCOT, PUCT, FERC, TCEQ, county-agenda, equipment, finance, and news signals:

1. Validate public HTTP(S) URLs and block localhost/private targets.
2. Retrieve bounded pages with Firecrawl v2, or use the stable demo fixture.
3. Extract supported names, capacity, project type, and stage evidence without inventing unknown fields.
4. Resolve aliases, merge provenance, and retain the most advanced supported stage.
5. Rank projects with stage confidence, progression, and source evidence.

The demo contains 10 Texas projects backed by 24 provenance records. Contracts and deterministic resolution live in `lib/project-radar.ts`; fixtures live in `lib/project-radar-data.ts`.

## Architecture

```text
Public project URLs                    Conference URL
         │                                  │
         ▼                                  ▼
  /api/projects                       /api/qualify
         │                                  │
 extract → resolve → stage          Agent 1 → Agent 2
         │                                  │
         ▼                                  ▼
   ranked projects                    ranked speakers
         │                                  │
         └────────── resolved company ──────┘
                           │
                           ▼
                 combined opportunity
                                              │
                                              ▼
                                    Agent 3 drafts + funnel
```

MongoDB Atlas remains the live persistence layer for Agents 1–3. `supabase/schema.sql` is a historical/reference schema extended with the Track 1 provenance model.

## Compliance

- Public data only; HTTP(S); no private-network targets.
- No authentication, CAPTCHA, paywall, or anti-bot bypass.
- No private contact scraping or automatic email sending.
- Fixture paths remain available if live sites or credentials fail during judging.

## Sources

- [Candid AI Agent Development Guide](https://chatgpt.com/share/6a7761b3-0fd4-83ea-9bca-15dd870c3dff)
- [D-Branch template](https://github.com/taymurfa/C-DID/tree/D-Branch)
- [Firecrawl v2 API](https://docs.firecrawl.dev/api-reference/v2-introduction.md)
