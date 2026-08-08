# intelligence-service (Agent 2)

Agent 2 is the **brain of the system**. It takes Agent 1's raw scraped conference
data (speakers, sessions, companies) and turns the noise into **accurate,
explainable sales intelligence**: cleaned and deduplicated people, ICP-scored
leads, ranked by how much they matter, each with a plain-English *"why this
person matters"* and an auditable evidence trail.

```
Agent 1 IngestionResult (raw speakers/sessions/companies)
  -> clean + normalize names / companies / titles
  -> deduplicate speakers (same person across pages) and companies
  -> score each candidate on 6 signals:
       role fit, company ICP fit, seniority, session-topic relevance,
       buying influence, extraction confidence
  -> OpenAI refines company/ICP fit (optional; deterministic fallback)
  -> blend -> 0-100 score -> tier (A/B/C/D) -> qualified?
  -> "why this person matters" + evidence
  -> ranked qualified leads  ->  store in MongoDB
```

Agent 1 finds truth; **Agent 2 interprets signal**. This service does *not*
scrape, crawl, or fetch anything — it only reasons over data Agent 1 already
collected.

Not in scope here: crawling, page fetching, HTML parsing, outreach/sequences,
funnel logic, or any frontend.

## What it decides

- **ICP** (Ideal Customer Profile): decision-makers at organizations in energy,
  power, grid/transmission, utilities, data centers, and the infrastructure /
  EPC / development that powers them. See `src/score/icpConfig.ts`.
- **Six scoring signals**, each normalized to `0..1` and blended with tunable
  weights into a `0..100` total (`src/score/icpConfig.ts` → `SCORE_WEIGHTS`):
  - `roleFit` — is this a speaker/moderator vs. a sponsor/staff/journalist?
  - `companyIcpFit` — does the company fit the ICP? (OpenAI-refined when available)
  - `seniority` — C-level > VP > Director > Manager > IC
  - `topicRelevance` — do their sessions/bio touch ICP topics?
  - `buyingInfluence` — do they plausibly hold budget / decision authority?
  - `confidence` — Agent 1's extraction confidence for the record
- **Tiers** from the total score: A ≥ 75, B ≥ 60, C ≥ 45, else D.
- **Qualified** when the total meets `QUALIFY_MIN_SCORE` (default 45).

## Stack

- Node.js + TypeScript
- Fastify (HTTP + Swagger/OpenAPI docs)
- Zod (runtime validation + lenient ingestion parsing)
- OpenAI (ICP-fit judgment + reasons; optional)
- MongoDB Atlas (qualification-run persistence; optional)

## Quick start

```bash
npm install
npm run dev
```

The service listens on **port 8002** by default (Agent 1 owns 8001).

### Configuration

Config is loaded from the shared **`backend/.env`** (`../backend/.env` relative
to this service), so it reuses the system's `OPENAI_API_KEY` and `MONGODB_URI`.
Set `ENV_FILE=/path/to/.env` to point somewhere else.

- The service always runs on **8002** (via `INTELLIGENCE_PORT`), and deliberately
  ignores the backend's generic `PORT` so the services don't collide.
- Qualification runs are written to the `speaker_signal_intelligence` database
  (override with `MONGODB_DB`), separate from the backend and from Agent 1.

Optional overrides you can add to `backend/.env`:

```
INTELLIGENCE_PORT=8002
OPENAI_MODEL=gpt-4o-mini
MONGODB_DB=speaker_signal_intelligence
MONGODB_QUALIFICATIONS_COLLECTION=qualifications
QUALIFY_MIN_SCORE=45
QUALIFY_ELIGIBLE_ROLES=speaker,moderator,unknown
QUALIFY_OPENAI_MAX_LEADS=40
```

- Swagger UI: http://localhost:8002/docs
- Health: http://localhost:8002/health

> The service runs fully without `OPENAI_API_KEY` or `MONGODB_URI`.
> Without OpenAI it uses deterministic keyword/heuristic ICP scoring. Without
> MongoDB it returns results in the HTTP response but does not persist them.

## API

### `GET /health`

```json
{ "service": "intelligence", "status": "ok" }
```

### `POST /qualify`

Accepts Agent 1's `IngestionResult` — either the full object at the top level,
or wrapped under an `ingestion` key. Extra keys are ignored, and partial/noisy
payloads are tolerated (only `speakers` is needed to do useful work).

Request (bare payload + options):

```json
{
  "runId": "…",
  "conference": { "name": "DevReach 2026" },
  "sessions": [ … ],
  "speakers": [ … ],
  "minScore": 45,
  "useOpenAi": true
}
```

`minScore` (optional, 0-100) overrides the qualification threshold for the
request. `useOpenAi` (optional, default true) can force deterministic-only
scoring even when OpenAI is configured.

Response: a `QualificationResult` (see
`fixtures/sample-qualified-output.json` for a complete example). It includes:

- `totals` — `speakersIn`, `afterDedup`, `eligible`, `qualified`, `companies`
- `icpEnrichment` — whether OpenAI or the deterministic fallback drove ICP fit
- `leads` — ranked (best first), each with normalized fields, the six
  `scores`, a `tier`, `qualified` flag, `whyThisPersonMatters`, an `evidence`
  list, and `mergedSourceIds` (which raw records were merged)
- `companies` — deduplicated companies with lead counts and ICP fit
- `errors` — invalid input never throws; you get an empty result + an error entry

Inspect stored runs with `npm run leads:list`.

## Team integration

- The full request/response contract is documented via **Swagger UI at `/docs`**.
- `fixtures/sample-ingestion-input.json` is Agent 1's committed sample output;
  `fixtures/sample-qualified-output.json` is Agent 2's committed sample response.
  Downstream consumers can build against these before either service is live.
- Regenerate the sample output after scoring changes with
  `npx tsx scripts/gen-sample.ts`.

## Testing

```bash
npm test
```

Tests cover normalization, speaker/company deduplication, seniority
classification, deterministic scoring, and the full `/qualify` pipeline
(loading Agent 1's sample output and proving it yields valid, ranked, explained
leads — including that duplicates merge and off-ICP juniors don't qualify).

## Design principles (shared with Agent 1)

- **Never invent facts.** Scores and explanations are grounded only in the data
  Agent 1 provides; unknowns stay unknown.
- **Graceful degradation.** No `OPENAI_API_KEY` → deterministic scoring. No
  `MONGODB_URI` → results returned but not persisted.
- **Never throws on bad input.** Partial results and an `errors` array instead.
