# Candid Origination — Hackathon Submission

Dual-track submission for Candid: **Track 2 Speaker Signal** (canonical 5-min demo) + **Track 1 Project Radar** (POC on the same agent pattern).

- Track 2 desk: Compose → [`speaker-signal/`](speaker-signal/) + Agents 1–3 (`:3000`)
- Track 1 atlas: Compose → [`frontend/`](frontend/) + Radar R1–R3 (`:3001`)

## What we built

### Track 2 — Speaker Signal

Speaker Signal turns **public conference agendas** into a GTM motion for Candid’s ICP (lean energy / data-center-power owner-operators). Paste or demo-analyze a conference → Agent 1 ingests speakers + sessions → Agent 2 dedupes and ICP-scores with human-readable reasons → Agent 3 builds an event-anchored sequence (T−14 / T−7 / T−2 / Event / T+2) with personalized drafts → the Signal Desk shows ranked speakers, cadence, and funnel drop-off in one place.

Three-agent architecture:

1. **Ingestion** (`speaker-signal-ingestion`, `:8001`) — bounded public crawl, extract speakers/topics, bootstrap discover from seed venues.
2. **Intelligence** (`intelligence-service`, `:8002`) — normalize, dedupe, score, rank, explain.
3. **GTM** (`gtm-service`, `:8003`) — sequences, drafts, funnel events (mock send by default).

Offline robustness: fixture ingestion so judges complete the DoD with no API keys.

### Track 1 — Project Radar (POC)

Project Radar mirrors the same Node/Fastify + Mongo pattern for **projects**:

1. **R1 ingest** (`project-radar-ingest`, `:8011`) — multi-source fixtures (ERCOT GIS + PUCT + TCEQ).
2. **R2 normalize** (`project-radar-normalize`, `:8012`) — entity resolution (hard case: three LLC/names → one project).
3. **R3 score** (`project-radar-score`, `:8013`) — stage inference with confidence + evidence, rank, light people↔project join.

UI: ERCOT atlas + **Demo ingest** overlay on [`frontend/`](frontend/) (`:3001`).

## Sources used

**Track 2** — public conference / organizer pages only:

| Seed / venue | Role |
| --- | --- |
| [7x24 Exchange](https://www.7x24exchange.org/) | Compose `BOOTSTRAP_SEEDS` discovery |
| [Data Center World](https://www.datacenterworld.com/) | Compose `BOOTSTRAP_SEEDS` discovery |
| [Infrastructure Masons events](https://infrastructuremasons.org/events/) | Compose `BOOTSTRAP_SEEDS` discovery |
| Desk calendar fixtures | GridForward Summit, Energy Storage North America, POWERGEN, Industrial Energy Forum |

Demo Analyze uses a fixture GridForward agenda (5 speakers including a duplicate + non-ICP journalist) so judges always see **5 → 4 → 3**.

**Track 1** — public project signals (POC fixtures modeled on):

| Source | Role |
| --- | --- |
| ERCOT GIS report | Queue / milestone / capacity rows |
| PUCT Interchange | Docket / CCN / market registration stubs |
| TCEQ air permits | Permit stubs aliased to the same projects |

Hard ER demo: *Lone Star BTM Energy Storage* ↔ *LSBTM Holdings LLC* ↔ *LoneStar Behind-the-Meter Facility*.

## Compliance

- **Public data only** — agendas, speaker directories, and public queue/permit-style records.
- **Robots / rate limits** — Agent 1 uses bounded crawl; Radar POC is fixture-first (no open-ended scrapes).
- **Mock send** — `SEND_MODE=mock` by default; drafts include opt-out (`reply STOP`).
- **Honest gaps** — no real open/reply tracking; Radar live scrapers / full GIS regenerator not shipped; join is fixture-linked to Track 2 demo companies.

## What we’d build next week

1. **Real engagement metrics** — open/reply/meeting instrumentation wired into the funnel.
2. **Stronger calendar discovery** — richer recurring-event seeds + change detection.
3. **Live Radar adapters** — real PUCT/TCEQ fetch + regenerable ERCOT GIS pipeline; deeper projects↔people join in one desk.

---

## 5-minute demo script

Locked narrative for judges. Aim ~4:30 on Track 2; add ~90s for Track 1 if time remains.

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

### 4:30 — Optional Track 1 cameo (only if ahead)

If Track 2 is solid and time remains: open `http://localhost:3001` → **Demo ingest** → Lone Star **ER** project (three aliases, stage evidence, people join). Keep it to ~90s — do **not** derail the Speaker Signal story.

### Close

> Signal quality + sequencing depth + an addictive desk — runnable today with Compose, mock-safe by default. Track 1 Project Radar POC rides the same agent pattern for projects.
