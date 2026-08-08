# speaker-signal-ingestion (Agent 1)

Agent 1 is the **eyes of the system**. Given a conference URL (or a known series),
it navigates the site like a researcher: it figures out where the agenda and
speaker information lives, decides which links are worth following, extracts the
public facts, discovers newly announced events, and hands downstream services a
clean, **evidence-backed** representation of what the site actually says.

```
Starting Conference URL
  -> fetch page  ->  extract same-domain candidate links
  -> cheap deterministic filtering
  -> OpenAI link/page prioritization
  -> crawl highest-value pages  ->  classify page type
  -> extract conference + sessions + speakers (with source evidence)
  -> validate / deduplicate
  -> ask "what's still missing?" and choose the next URL (agentic loop)
  -> discover related/future events
  -> structured JSON + source evidence  ->  store in MongoDB
```

It does **light** relevance filtering to remove obvious junk (privacy/tickets/
login/sponsor-kits) and to distinguish speaker vs sponsor/staff/exhibitor/
moderator/journalist — but it does **not** decide who the best sales leads are.
That is Agent 2's job. Agent 1 finds truth; Agent 2 interprets signal.

Not in scope here: ICP scoring, lead qualification, outreach, sequences, funnel
logic, or any frontend.

### Agentic behavior

After each page, Agent 1 recomputes its **coverage** (do I have dates? location?
agenda? session titles? speaker names/titles/companies? speaker-session links?)
and biases the next crawl toward the page types most likely to fill the gaps
(e.g. missing sessions -> `/agenda`; missing titles/companies -> speaker profile
pages). OpenAI is used as the reasoning layer (is this an agenda? which of these
links hold speakers? is this the 2026 or 2025 event? is this person a speaker or
a sponsor? which company/session belongs to whom?). It never invents missing
fields - unknown values are returned as `null`.

Everything degrades gracefully: with no `OPENAI_API_KEY` it falls back to
deterministic parsing; with no `MONGODB_URI` it returns results without
persisting.

### Event-driven automation (auto-ingest)

Agent 1 doesn't just wait to be told what to crawl - discovery *triggers*
ingestion. Whenever a new, relevant conference appears, it is automatically
enqueued and ingested in the background (no manual `/ingest` call):

- **From `/discover`**: every relevant discovered event is auto-enqueued.
- **From `/ingest`**: conferences surfaced as `discoveredEvents` while ingesting
  one event become new triggers, so the conference universe expands on its own.

The queue is in-process and self-limiting: it **dedupes** by canonical URL,
**skips** conferences already stored in MongoDB, **gates** on
`isRelevantConference` + `AUTO_INGEST_MIN_CONFIDENCE`, bounds concurrency
(`AUTO_INGEST_CONCURRENCY`), and bounds how far chained discoveries are followed
(`AUTO_INGEST_MAX_DEPTH`) so it never runs away crawling the open web. Set
`AUTO_INGEST_ENABLED=false` to fall back to purely manual operation.

Set `BOOTSTRAP_SEEDS` (comma-separated seed pages) to make the service kick off
discovery automatically at startup, so a freshly booted process/container begins
grabbing on its own instead of waiting for the first HTTP call.

Inspect the live queue at `GET /auto-ingest`:

```json
{ "enabled": true, "enqueued": 4, "completed": 3, "failed": 0, "skipped": 1, "active": 1, "pending": 0 }
```

## Stack

- Node.js + TypeScript
- Fastify (HTTP + Swagger/OpenAPI docs)
- Playwright (JS-rendered fallback) + Cheerio (default HTML parsing)
- Zod (runtime validation + schema generation)
- OpenAI (agentic extraction/structuring; optional)
- MongoDB Atlas (run persistence; optional)

## Quick start

```bash
npm install
npm run playwright:install   # one-time: downloads Chromium for the Playwright fallback
npm run dev
```

The service listens on **port 8001** by default.

### Run with Docker

The image is based on the official Playwright image, so Chromium and its OS
dependencies are baked in (the crawler uses them only as a fallback for
JS-rendered pages). Configuration is read from the repo-root **`.env`** via
Compose's `env_file`, so no service-local `.env` is needed.

```bash
docker compose up --build
```

This compiles TypeScript, starts the service on **8001**, and - because the
Compose file sets `BOOTSTRAP_SEEDS` - immediately begins discovering conferences
and auto-ingesting every relevant hit. Change (or clear) `BOOTSTRAP_SEEDS` to
control what it grabs on boot. Watch progress with:

```bash
curl http://localhost:8001/auto-ingest   # live queue stats
```

To build/run just the image without Compose:

```bash
docker build -t speaker-signal-ingestion .
docker run --env-file ../.env -e BOOTSTRAP_SEEDS="https://www.7x24exchange.org/" -p 8001:8001 speaker-signal-ingestion
```

### Configuration

Config is loaded from the repo-root **`.env`** (`../.env` relative to this
service), so it reuses the system's `OPENAI_API_KEY` and `MONGODB_URI`.
Set `ENV_FILE=/path/to/.env` to point somewhere else.

- The service always runs on **8001** (via `INGESTION_PORT`).
- Mongo runs are written to the `speaker_signal_ingestion` database (override
  with `MONGODB_DB`) on the shared cluster.

Optional overrides you can add to the root `.env`:

```
INGESTION_PORT=8001
OPENAI_MODEL=gpt-4o-mini
MONGODB_DB=speaker_signal_ingestion
MONGODB_RUNS_COLLECTION=runs
CRAWL_MAX_PAGES=12
CRAWL_MAX_DEPTH=2
CRAWL_CONCURRENCY=2
CRAWL_REQUEST_DELAY_MS=750
CRAWL_REQUEST_TIMEOUT_MS=20000
CRAWL_USER_AGENT=SpeakerSignalIngestionBot/0.1 (+https://github.com/)
RESPECT_ROBOTS=true
AUTO_INGEST_ENABLED=true
AUTO_INGEST_MIN_CONFIDENCE=0.6
AUTO_INGEST_CONCURRENCY=1
AUTO_INGEST_MAX_DEPTH=1
AUTO_INGEST_MAX_PAGES=12
```

- Swagger UI: http://localhost:8001/docs
- Health: http://localhost:8001/health

> The service runs fully without `OPENAI_API_KEY` or `MONGODB_URI`.
> Without OpenAI it uses deterministic Cheerio parsing. Without MongoDB it returns
> results in the HTTP response but does not persist them.

## API

### `GET /health`

```json
{ "service": "ingestion", "status": "ok" }
```

### `POST /ingest`

Request:

```json
{ "conferenceUrl": "https://www.7x24exchange.org/", "maxPages": 12, "discoverEvents": true }
```

`maxPages` (optional, <=40) and `discoverEvents` (optional, default true) tune the
agentic loop.

Response: an `IngestionResult` (see `fixtures/sample-ingestion-output.json` for a
complete example). It includes:

- `conference` - name, website, dates, location (nulls when not stated)
- `coverage` - Agent 1's self-assessment of what it found
- `pages` - each crawled page with `pageType`, `contentHash`, and a `changed`
  freshness flag (vs the previous stored run)
- `sessions` / `speakers` - with `topics` tags, `sourceUrls` evidence, and
  `extractionConfidence`; speakers also carry a `role` and `sessionSourceIds`
  linking them to sessions, plus a `linkedinUrl` (the public LinkedIn profile
  the conference site links, canonicalized; `null` when none is published)
- `discoveredEvents` - related/future editions with a relevance classification
- `errors` - one bad page never fails the run; partial results are always returned

Inspect stored runs with `npm run runs:list`.

### `POST /discover`

Cold-start discovery: expand the conference universe from seed pages (organizer
sites, event index/listing pages) before you know a specific event URL.

Request:

```json
{ "seedUrls": ["https://devopsdays.org/events/"], "maxPerSeed": 20 }
```

Response:

```json
{
  "discoveredEvents": [
    {
      "eventName": "Data Center Power Summit 2027",
      "eventUrl": "https://.../events/2027-...",
      "isRelevantConference": true,
      "confidence": 0.94,
      "reason": "Upcoming event focused on data-center power infrastructure",
      "startDate": "2027-03-12"
    }
  ],
  "pagesFetched": 1,
  "errors": []
}
```

## Team integration

- The full request/response contract is documented via **Swagger UI at `/docs`**.
- `fixtures/sample-ingestion-output.json` is a committed, stable example of the `/ingest`
  response. The intelligence-service developer can build against it before this service is
  finished.

## Testing

```bash
npm test
```

Tests load `fixtures/sample-conference.html` and prove that the parser extracts the agenda,
3 sessions, and 5 speakers (with names, titles, and companies) correctly.

## Safety & politeness

- Respects `robots.txt` and site terms.
- Rate-limits requests and bounds the crawl (no full-domain crawling).
- Does **not** bypass CAPTCHA, authentication, paywalls, or anti-bot protections.
- Public data only.
- **LinkedIn:** we capture the LinkedIn profile URL a speaker *already links from
  the public conference page* (`speaker.linkedinUrl`). We do **not** crawl,
  fetch, or scrape LinkedIn itself - it requires authentication and blocks
  automated access, which is out of scope. Enriching those profiles with more
  data should go through LinkedIn's official API or a compliant provider
  downstream (Agent 2), not this crawler.
