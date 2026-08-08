# Speaker Signal

Speaker Signal turns public energy-conference agendas into explainable, qualified people and event-anchored outreach drafts. It is a judge-ready Next.js implementation derived from the Candid Intelligence challenge and the shared AI Agent Development Guide.

## What works

- Run the real normalize → dedupe → score → rank pipeline from the Signal Desk.
- Use fixture-backed Demo mode with no credentials or switch to live Agent 1 ingestion.
- Explore ranked speakers with deterministic score components, evidence, confidence, and source links.
- Select a speaker to update the T−14 → T−7 → T−2 → Event → T+2 outreach sequence.
- Inspect conference coverage, qualified-speaker counts, conversion, and funnel drop-off.
- Run the full product on mobile or desktop; navigation and primary interactions are responsive.
- Start from a Postgres/Supabase schema that keeps raw sources separate from curated entities.

No email is sent. The GTM surface generates and simulates drafts only.

## Quick start

Requirements: Node.js 20+ and pnpm.

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

The app starts in Demo mode; no URL or credential is required. For live public-page retrieval, start `../speaker-signal-ingestion` on port 8001, copy `.env.example` to `.env.local` if `INGESTION_URL` needs an override, and switch the top-right control to **Live agents**.

```bash
pnpm lint
pnpm build
```

## Architecture

```text
Conference URL
      │
      ▼
Next.js /api/qualify ─── URL safety gate
      │
      ├── Demo mode ───── stable ingestion fixture
      │
      └── Live mode ───── Agent 1 bounded public-page ingestion
                              │
                              ▼
                    typed ingestion boundary
                              │
             ┌────────────────┼────────────────┐
             ▼                ▼                ▼
        entity resolve   explainable score   GTM drafts
             │                │                │
             └────────────────┴────────────────┘
                              ▼
                         Signal Desk
```

The frontend uses the D-Branch project's Next.js 16, React 19, TypeScript, and Lucide foundation. `lib/contracts.ts` is the shared Zod boundary. `app/api/qualify/route.ts` connects the dashboard to Agent 1 and the embedded Person 2 pipeline; it validates conference URLs before ingestion. The original `app/api/analyze/route.ts` remains available as a bounded Firecrawl v2 page-preview endpoint. `supabase/schema.sql` defines provenance, normalized entities, sequences, funnel events, and agent-run persistence.

## Person 2 — qualification pipeline (`/api/qualify`)

Person 2 turns Agent 1's noisy scraped data into accurate, explainable sales
intelligence. Pipeline stages (all in `lib/pipeline/`):

1. **Ingest** — accept an Agent 1 `IngestionResult` directly, fetch it from Agent
   1 via a `conferenceUrl`, or use the bundled energy-conference demo payload
   (`ingestion.ts`, `demo-ingestion.ts`).
2. **Normalize** — clean names (strip honorifics/credentials, fix casing),
   titles (expand VP/SVP/CEO, unify separators), and companies (`normalize.ts`).
3. **Deduplicate** — merge the same speaker across pages by normalized
   name + company key, unioning topics/sessions/evidence and keeping the richest
   fields; roll up unique companies (`dedupe.ts`).
4. **Score** — transparent, additive 0–100 across role fit (20), company fit
   (20), topic relevance (25), seniority (15), buying influence (10), and event
   proximity (10); assign tiers A/B/C/D (`score.ts`, `icp-config.ts`).
5. **ICP fit + explanation** — OpenAI judges ICP fit and writes "why this person
   matters", grounded only in the extracted facts; a deterministic fallback runs
   when no `OPENAI_API_KEY` is set (`icp.ts`, `openai.ts`).
6. **Rank** — filter to qualified tiers, sort by score, and emit ranked
   `QualifiedLead`s with evidence, confidence, and score breakdown (`qualify.ts`).

Request examples:

```jsonc
// Demo mode (no credentials)
{ "demoMode": true }

// From a raw Agent 1 payload
{ "ingestion": { /* IngestionResult */ }, "minTier": "C" }

// Let Person 2 call Agent 1 for you
{ "conferenceUrl": "https://example.com/gridforward", "maxPages": 8 }
```

Every lead carries the additive score components, the reason, evidence URLs, and
confidence. Unknown fields remain unknown; the pipeline never infers employers,
contact data, or unsupported claims.

## Compliance and demo reliability

- Public data only.
- HTTP(S) URLs only; localhost and private network ranges are rejected.
- No authentication, CAPTCHA, paywall, or anti-bot bypass.
- Source URL and evidence are preserved.
- No private contact scraping and no automatic email sending.
- Demo mode stays available if a live conference site or credential fails during judging.

## Next week

1. Replace the single-page scrape with a bounded Firecrawl crawl over agenda, program, session, and speaker paths (Agent 1 already does this; wire `/api/qualify` to it in production).
2. Persist every qualification `AgentRun` (inputs, model, leads) to Supabase.
3. Extend dedupe with fuzzy candidate retrieval and reviewable ambiguous merges (exact normalized-key merge is implemented).
4. Add Supabase auth/workspace policies and scheduled recurrence detection for annual conferences.
5. Connect a compliant sending provider only after explicit human approval of every sequence.

## Sources

- [Candid AI Agent Development Guide](https://chatgpt.com/share/6a7761b3-0fd4-83ea-9bca-15dd870c3dff)
- [D-Branch template](https://github.com/taymurfa/C-DID/tree/D-Branch)
- [Firecrawl v2 API introduction](https://docs.firecrawl.dev/api-reference/v2-introduction.md)
