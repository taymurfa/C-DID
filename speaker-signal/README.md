# Speaker Signal

Speaker Signal turns public energy-conference agendas into explainable, qualified people and event-anchored outreach drafts. It is a judge-ready Next.js implementation derived from the Candid Intelligence challenge and the shared AI Agent Development Guide.

## What works

- Paste a public conference URL into the Signal Desk and run a typed analysis pipeline.
- Use fixture-backed Demo data with no credentials or switch to live Firecrawl scraping.
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

The app starts in Demo data mode. For live public-page retrieval, copy `.env.example` to `.env.local`, set `FIRECRAWL_API_KEY`, restart the app, and switch the top-right control to **Live Firecrawl**.

```bash
pnpm lint
pnpm build
```

## Architecture

```text
Conference URL
      │
      ▼
Next.js /api/analyze ─── URL safety gate
      │
      ├── Demo mode ───── persisted fixture contract
      │
      └── Live mode ───── Firecrawl v2 scrape (public page only)
                              │
                              ▼
                    typed evidence boundary
                              │
             ┌────────────────┼────────────────┐
             ▼                ▼                ▼
        entity resolve   explainable score   GTM drafts
             │                │                │
             └────────────────┴────────────────┘
                              ▼
                         Signal Desk
```

The frontend uses the D-Branch project's Next.js 16, React 19, TypeScript, and Lucide foundation. `lib/contracts.ts` is the shared Zod boundary. `lib/firecrawl.ts` owns public page retrieval. `app/api/analyze/route.ts` validates URLs and prevents localhost/private-network targets before invoking Firecrawl. `supabase/schema.sql` defines provenance, normalized entities, sequences, funnel events, and agent-run persistence.

## Scoring

Overall score is transparent and additive:

- role fit: 20
- company fit: 20
- session/topic relevance: 25
- seniority: 15
- buying influence: 10
- event proximity: 10

The UI stores the components, the reason, evidence URLs, and confidence. Unknown fields remain unknown; the live adapter does not infer employers, contact data, or unsupported claims.

## Compliance and demo reliability

- Public data only.
- HTTP(S) URLs only; localhost and private network ranges are rejected.
- No authentication, CAPTCHA, paywall, or anti-bot bypass.
- Source URL and evidence are preserved.
- No private contact scraping and no automatic email sending.
- Demo mode stays available if a live conference site or credential fails during judging.

## Next week

1. Replace the single-page scrape with a bounded Firecrawl crawl over agenda, program, session, and speaker paths.
2. Add OpenAI Structured Outputs at the extraction/scoring boundaries and persist every `AgentRun`.
3. Implement deterministic normalization, fuzzy candidate retrieval, and reviewable ambiguous merges.
4. Add Supabase auth/workspace policies and scheduled recurrence detection for annual conferences.
5. Connect a compliant sending provider only after explicit human approval of every sequence.

## Sources

- [Candid AI Agent Development Guide](https://chatgpt.com/share/6a7761b3-0fd4-83ea-9bca-15dd870c3dff)
- [D-Branch template](https://github.com/taymurfa/C-DID/tree/D-Branch)
- [Firecrawl v2 API introduction](https://docs.firecrawl.dev/api-reference/v2-introduction.md)
