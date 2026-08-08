# Speaker Signal — Product Spec (Hackathon POC)

> This repo started as an OKR platform boilerplate. We are repurposing it into **Speaker Signal**.
> This file is the source of truth for **what we are building**. `CLAUDE.md` covers **how** (stack,
> conventions, run commands). Read both before writing code.

## 1. The pitch in one line

Point the app at an energy-conference URL → get back a **scored, deduplicated, enriched list of
ICP-fit speakers with their talk topics** → each fit speaker flows into an **event-anchored outreach
sequence** with drafted personalized emails → a **funnel view** shows conversion and drop-off at
every stage. The **conference calendar maintains itself**.

We (Candid) sell to energy / data-center-power buyers. The right buyers stand on stage at energy
conferences and say exactly what they're working on. Speaker Signal turns that public signal into a
GTM motion.

## 2. Who we're selling to (the ICP)

**Candid's ICP** = the target we score every speaker against.

- **Titles that fit:** VP / Head / Director of Engineering, project-delivery leaders, Head of
  Infrastructure / Data Center / Power, VP Development, Chief Development Officer. Decision-makers who
  own delivery, not analysts or academics.
- **Company type that fits:** **lean owner-operators and developers** in energy and data-center
  power — companies that build and run the assets. Down-weight: large consultancies, vendors selling
  services, universities, government/regulators, press.
- **Topic signal (very important):** *what they're speaking about is itself a signal.* A talk on
  "behind-the-meter power for AI data centers" is a **hotter** lead than a generic "sustainability
  panel." Boost topics about: behind-the-meter power, AI data centers, on-site generation, grid
  interconnection, energy storage for compute, powering data centers, microgrids, project delivery
  speed.

Every scored speaker must carry a **human-readable reason** ("why this one matters") — title + company
type + topic, in one sentence.

## 3. Two jobs

### Job 1 — Aggregate & visualize
1. **Self-updating calendar** of energy conferences. Most recur annually → seed the recurring ones;
   detect newly announced events. (POC: seed a handful; a "discover" action simulates detection.)
2. **Parse a conference/agenda URL** → extract each speaker's **name, title, company**, plus their
   **session/talk topic**.
3. **Score every speaker against the ICP** (0–100) with a reason.
4. **Present it** in one explorable view: every upcoming event and every ICP-fit person on it, ranked,
   with the reason each matters. Explorable and "addictive," not a static table.

### Job 2 — The sequence (the GTM motion)
1. An identified speaker becomes a **timed outreach campaign**, anchored to the **conference date**:
   - **T–2 weeks:** first touch
   - **T–1 week:** follow-up
   - **T–2 days:** "let's meet at the event" nudge
   - **At the event:** meet in person
   - **Post-event:** follow-up to book a real conversation
2. Each step has a **drafted, personalized email** (references their talk + company + the event).
3. A **Sequences view** (Juicebox-style) tracks open / reply / meeting rates.
4. A **funnel view** shows conversion and drop-off across stages:
   `identified → contacted → replied → meeting_scheduled → met_at_event → follow_up_sent → conversation_booked`

## 4. Guardrails (non-negotiable, part of the story)
- **Public data only.** Only parse publicly published agenda/speaker pages. Respect each site's terms
  and `robots.txt`. Reasonable rate limits, honest User-Agent.
- **Genuine personalization + compliance.** Emails must reference real, specific relevance (their talk,
  their company). Every draft includes an **easy opt-out**. Not a spam cannon.
- POC does **not** actually send email. Sending is **mocked** (status transitions only). Say so in the UI.

## 5. Data model (Postgres, SQLAlchemy 2.0 typed models)

New tables in `backend/app/models_sql/speaker_signal.py`. UUID string PKs, `created_at/updated_at`
timezone-aware — match the existing `okr.py` style exactly. One new Alembic migration:
`0003_speaker_signal.py`.

```
conferences
  id (uuid str, pk)
  name              str
  url               str          # agenda/speaker page we parse
  venue             str | null
  location          str | null   # "Dallas, TX" — used by the map view
  latitude/longitude float | null
  start_date        date | null
  end_date          date | null
  recurring         bool         # seeded annual events
  status            str          # 'upcoming' | 'past' | 'announced'
  source            str          # 'seed' | 'discovered' | 'manual'
  last_scraped_at   datetime | null
  created_at, updated_at

speakers
  id (uuid str, pk)
  conference_id     fk -> conferences (index)
  name              str
  title             str | null
  company           str | null
  company_type      str | null   # 'owner_operator' | 'developer' | 'vendor' | 'consultancy' | 'other'
  linkedin_url      str | null   # enrichment (may be stubbed)
  email             str | null   # enrichment (may be stubbed / guessed pattern)
  talk_title        str | null
  talk_topic        str | null   # normalized topic used for topic scoring
  icp_score         int          # 0..100
  icp_reason        text | null  # "why this one matters", one sentence
  score_breakdown   JSONB | null # {title: n, company: n, topic: n}
  dedup_key         str (index)  # lower(name)|lower(company) — dedupe across sessions/events
  created_at, updated_at

sequences               # one per (speaker) enrolled into the motion
  id (uuid str, pk)
  speaker_id        fk -> speakers (index)
  conference_id     fk -> conferences (index)
  stage             str          # funnel stage (see §3.2), default 'identified'
  created_at, updated_at

sequence_steps
  id (uuid str, pk)
  sequence_id       fk -> sequences (index)
  kind              str          # 't_minus_2w' | 't_minus_1w' | 't_minus_2d' | 'at_event' | 'post_event'
  scheduled_date    date         # computed from conference date
  email_subject     str | null
  email_body        text | null  # drafted, personalized, includes opt-out
  status            str          # 'draft' | 'sent' | 'opened' | 'replied' | 'meeting' (mocked)
  sort_order        int
  created_at, updated_at
```

## 6. Backend API (Flask blueprint `speaker_signal.py`, prefix `/api`)

Register in `app/__init__.py`. Follow the existing route/blueprint style. Auth: reuse `require_auth`,
but for the demo run with `ALLOW_INSECURE_AUTH0_DEV=1` so no Auth0 tenant is needed.

```
GET  /api/conferences                      -> list (calendar); newest/upcoming first
POST /api/conferences/discover             -> simulate self-updating calendar: add newly "announced" events
GET  /api/conferences/<id>                 -> one conference + counts
GET  /api/conferences/<id>/speakers        -> speakers ranked by icp_score desc (?min_score=)

POST /api/conferences/ingest               -> body {url}. Scrape+parse+dedupe+score. Returns conference + speakers.
                                              THE money endpoint. Idempotent on conference url.

GET  /api/speakers/<id>                     -> speaker detail (+ sequence if enrolled)
POST /api/speakers/<id>/enroll              -> create sequence + generate event-anchored steps with drafted emails

GET  /api/sequences                         -> Juicebox-style list w/ per-step status + aggregate rates
POST /api/sequences/<id>/advance            -> move to next funnel stage (mock)
POST /api/sequence-steps/<id>/mark          -> body {status} sent|opened|replied|meeting (mock)

GET  /api/funnel                            -> stage counts + conversion/drop-off for the funnel view
```

### Ingestion pipeline (`app/services/`)
- `conference_scraper.py` — fetch HTML (`requests`, honest UA, timeout, respect robots). Clean with
  BeautifulSoup. Then **LLM extraction** (OpenAI, already a dependency) with a strict JSON schema:
  list of `{name, title, company, talk_title, talk_topic}`. LLM extraction handles varied site layouts
  better than brittle CSS selectors. Keep the cleaned text chunked/truncated to stay within context.
- `icp_scoring.py` — hybrid: deterministic signal boosts (title keywords, company-type classification,
  topic keywords from §2) + an LLM pass for the reason sentence and edge cases. Return score 0–100,
  breakdown, and reason. Deterministic first so it's fast and demoable without a key.
- `dedupe.py` — normalize `name`+`company` → `dedup_key`; merge duplicates across sessions/events.
- `email_drafting.py` — given a speaker + conference + step kind, draft subject + body. Must reference
  their talk/company, be short, and include an opt-out line.
- `enrichment.py` — LinkedIn URL / email guess. POC may stub (pattern-based email, e.g.
  `first.last@company.com`) and clearly mark as unverified.

**Demo reliability:** ship a seed with 2–3 real energy conferences and a bank of realistic speakers so
the whole flow demos even if a live site is down or no API key is present. `POST /ingest` should fall
back to seeded parse results for known demo URLs. See `backend/seed_data.py` pattern.

## 7. Frontend (Next.js App Router, `frontend/app/`)

Use existing primitives: `components/ui/*`, `@/lib/api.ts` for calls, **Recharts** for the funnel,
**Leaflet** (`react-leaflet`) for a conference map, `motion` for the "explorable/addictive" feel,
`sonner` for toasts. New pages:

- `app/events/page.tsx` — self-updating **calendar/list** of conferences (+ optional map). "Discover new
  events" button → `POST /conferences/discover`. Card per event: name, date, location, #ICP-fit speakers.
- `app/events/[id]/page.tsx` — **ranked speaker list** for one event. Each row: name, title, company,
  talk topic, ICP score (badge/meter), the reason, and an **Enroll** button. Filter by min score. This
  is the "addictive, explorable" surface — make it feel great.
- `app/ingest/page.tsx` — paste a conference URL → run ingest → show the scored list appearing.
- `app/speakers/[id]/page.tsx` — speaker detail + their sequence (steps, drafted emails, statuses).
- `app/sequences/page.tsx` — **Sequences view** (Juicebox-style): every enrolled speaker, their steps,
  and aggregate open/reply/meeting rates.
- `app/funnel/page.tsx` — **funnel viz** with Recharts: counts and drop-off across the 7 stages.

Add these to the sidebar/nav. It's fine to leave the OKR pages in place; just don't route to them.

## 8. Suggested build order (one day)
1. Models + migration `0003` + seed data. (`make migrate`)
2. `GET /conferences`, `GET /conferences/<id>/speakers`, seed-backed. Wire `events` + `events/[id]` pages.
3. `POST /ingest` with scraper + ICP scoring (deterministic first). Wire `ingest` page.
4. `POST /speakers/<id>/enroll` + email drafting. Wire `speakers/[id]` + `sequences` page.
5. `GET /funnel` + `funnel` page (Recharts).
6. `POST /conferences/discover` (self-updating calendar) + polish/motion.

Cut from the bottom if time runs short. Steps 1–4 are the demo core.

## 9. Definition of done (demo script)
1. Open **Events** → see a self-maintaining calendar of energy conferences.
2. **Ingest** a conference URL → watch scored, deduped, ICP-ranked speakers appear with reasons + topics.
3. Open an event → the ranked speaker list; enroll a top speaker.
4. See the **event-anchored sequence** with drafted, personalized emails (T–2w … post-event).
5. **Sequences** view shows open/reply/meeting rates; **Funnel** shows conversion + drop-off.
6. Hit **Discover** → a newly "announced" event appears without anyone adding it by hand.
