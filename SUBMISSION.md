# Speaker Signal — Hackathon Submission

Track 2 submission for Candid. Canonical demo surface: Compose → [`speaker-signal/`](speaker-signal/) + Agents 1–3.

## What we built

Speaker Signal turns **public conference agendas** into a GTM motion for Candid’s ICP (lean energy / data-center-power owner-operators). Paste or demo-analyze a conference → Agent 1 ingests speakers + sessions → Agent 2 dedupes and ICP-scores with human-readable reasons → Agent 3 builds an event-anchored sequence (T−14 / T−7 / T−2 / Event / T+2) with personalized drafts → the Signal Desk shows ranked speakers, cadence, and funnel drop-off in one place.

Three-agent architecture:

1. **Ingestion** (`speaker-signal-ingestion`, `:8001`) — bounded public crawl, extract speakers/topics, bootstrap discover from seed venues.
2. **Intelligence** (`intelligence-service`, `:8002`) — normalize, dedupe, score, rank, explain.
3. **GTM** (`gtm-service`, `:8003`) — sequences, drafts, funnel events (mock send by default).

Offline robustness: `NEXT_PUBLIC_DEMO_MODE` + fixture ingestion so judges complete the DoD with no API keys.

## Sources used

Public conference / organizer pages only (no private CRM, no scraped paywalls):

| Seed / venue | Role |
| --- | --- |
| [7x24 Exchange](https://www.7x24exchange.org/) | Compose `BOOTSTRAP_SEEDS` discovery |
| [Data Center World](https://www.datacenterworld.com/) | Compose `BOOTSTRAP_SEEDS` discovery |
| [Infrastructure Masons events](https://infrastructuremasons.org/events/) | Compose `BOOTSTRAP_SEEDS` discovery |
| Desk calendar fixtures | GridForward Summit, Energy Storage North America, POWERGEN, Industrial Energy Forum (demo calendar context) |

Demo Analyze uses a fixture GridForward agenda (5 speakers including a duplicate + non-ICP journalist) so judges always see **5 → 4 → 3**.

## Compliance

- **Public data only** — agendas and speaker directories published on the open web.
- **Robots / rate limits** — Agent 1 uses bounded crawl (`maxPages`, concurrency caps); discover/auto-ingest are budgeted, not open-ended scrapes.
- **Mock send** — `SEND_MODE=mock` by default; desk copy says “Draft only — no automatic sending” / “No send — review only.” Drafts include an easy opt-out (`reply STOP`).
- **Honest gaps** — no real open/reply tracking; calendar self-update is seed + discover/auto-ingest, not a fully autonomous product; Firecrawl `/api/analyze` is preview-only (Agent 1 is the real ingest path).

## What we’d build next week

1. **Real engagement metrics** — open/reply/meeting instrumentation wired into the funnel (still consent-safe).
2. **Stronger calendar discovery** — richer recurring-event seeds + change detection when agendas publish.
3. **Light project ↔ people join** — connect ICP speakers to the static ERCOT atlas / Project Radar entities for a bonus “who is speaking *and* what are they building” view (without full multi-source Track 1).

---

## 5-minute demo script

Locked narrative for judges. Aim ~4:30 + buffer; Atlas is optional overtime only.

### 0:00 — Problem (30s)

> The right buyers are already on stage at energy conferences, saying exactly what they’re working on. Nobody has automated the motion from public agenda → ranked ICP leads → event-timed outreach → funnel.

Open `http://localhost:3000`. Point at calendar / conferences visible. Call out **Demo data** toggle as intentional robustness.

### 0:30 — Analyze / dedupe / ICP (90s)

Click **Analyze conference** (Demo).

Call out the notice: **5 ingested → 4 after dedupe → 3 qualified**.

Select **Maya Chen** (top A-tier). Show:

- Score + breakdown (role / company / topic…)
- Evidence chips (session, bio, source URLs)
- One-sentence **why they matter** (score reason)

Emphasize: **precision over volume** — duplicate collapsed, journalist filtered.

### 2:00 — Sequence (75s)

Go to **Sequences** (or speaker drawer cadence).

Walk T−14 → T−7 → T−2 → Event → T+2. Open **Review draft**: personalization grounded on session/topics; **opt-out** line; footer **No send — review only** / “Draft only.”

### 3:15 — Funnel (45s)

Open **Funnel**. Advance Maya (or show existing drop-off) **Identified → Contacted → …**. Call out the leak (largest drop-off band). This is where the GTM motion dies without a desk.

### 4:00 — Liveness / Demo robustness (30s)

**Agent Runs** / System health: green when Compose is up. If venue Wi‑Fi flakes, flip **Demo data** and re-run Analyze — same story, no credentials.

### 4:30 — Optional Atlas cameo (only if ahead)

If Track 2 is solid and time remains: open [`frontend/`](frontend/) ERCOT map as “Track 1 direction / next-week project↔people join” — do **not** derail the Speaker Signal story.

### Close

> Signal quality + sequencing depth + an addictive desk — runnable today with Compose, mock-safe by default.
