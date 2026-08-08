# Speaker Signal — Product Spec (Hackathon POC)

> This file is the source of truth for **what we are building** (Speaker Signal).
>
> **Live stack:** Agents run as microservices on MongoDB Atlas —
> Agent 1 `speaker-signal-ingestion` (:8001), Agent 2 `intelligence-service` (:8002),
> Agent 3 `gtm-service` / `agents/agent3` (:8003), dashboard `speaker-signal` (:3000).
> Prefer the Mongo + HTTP handoff shapes used by those services when implementing.

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

## 5. Data model

Persistence lives in MongoDB Atlas collections owned by each agent service
(`speaker_signal_ingestion` / `_intelligence` / `_gtm`). Conceptual shape (names vary slightly by service):

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

## 6. Agent APIs (live stack)

Auth is not required for the demo. Implement against the microservice packages:

- Agent 1 `speaker-signal-ingestion` (`:8001`) — discover / ingest
- Agent 2 `intelligence-service` (`:8002`) — qualify / rank
- Agent 3 `gtm-service` (`:8003`) — sequences / funnel

Dashboard proxies live under `speaker-signal/app/api/*` (and the optional `frontend/app/api/*` shell).

```
POST /ingest | /discover     -> Agent 1 conference discovery + scrape
POST /qualify                -> Agent 2 ICP score + rank
POST /sequences | /funnel    -> Agent 3 outreach + funnel
```

Dashboard-facing thin proxies:

```
POST /api/analyze            -> scrape preview / demo
POST /api/qualify            -> Agent 1 → Agent 2
POST /api/sequence           -> Agent 3 drafts + cadence
```

**Demo reliability:** ship fixtures so the whole flow demos even if a live site is down or no API key
is present. Without `OPENAI_API_KEY`, agents use deterministic fallbacks. Without `MONGODB_URI`,
results return over HTTP but are not persisted.

## 7. Frontend (Next.js)

Primary demo UI: `speaker-signal/` (Compose service `dashboard` on `:3000`).
Optional Atlas + Signal shell: `frontend/` (home toggles Project Atlas ↔ Signal Desk).

The desk should surface calendar, ranked speakers, sequences, and funnel in one place.

## 8. Suggested build order
1. Agent 1 ingest + Agent 2 qualify wired through dashboard proxies.
2. Signal Desk ranked list with score breakdown + reason.
3. Agent 3 sequences + funnel persistence.
4. Discover / calendar polish.
5. Demo-mode fixtures so judges need no credentials.

## 9. Definition of done (demo script)
1. Open the Signal Desk → see conferences / calendar context.
2. **Analyze conference** → scored, deduped, ICP-ranked speakers with reasons + topics.
3. Select a top speaker → inspect evidence and the event-anchored cadence.
4. Review drafted, personalized emails (T−14 → T+2) with opt-out.
5. **Funnel** shows conversion + drop-off from identified → conversation booked.

