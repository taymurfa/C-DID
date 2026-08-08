# CLAUDE.md

Guidance for Claude Code when working in this repo.

## What we're building

**Speaker Signal** — a hackathon POC. Point it at an energy-conference URL → get a scored, deduped,
ICP-fit list of speakers with their talk topics → enroll each into an event-anchored outreach sequence
with drafted emails → see a funnel of the whole GTM motion. The conference calendar self-updates.

**Read `docs/SPEAKER_SIGNAL_SPEC.md` first** — it is the source of truth for scope, data model, API,
and pages. This file is *how* (stack + conventions); the spec is *what*.

> ⚠️ **This repo was an OKR platform boilerplate; we are repurposing it.** Anything about OKRs,
> objectives, key results, departments, "vehicle", "pose-attendance", "voice/tutor" is **legacy
> boilerplate** — reference for conventions, not our product. Build new Speaker Signal code alongside
> it; don't route users to the old pages. Don't delete legacy code unless asked. Ignore the stray
> junk files (`Untitled`, `Makefile 2`, `* 2.py` duplicates) — do not build on them.

## Stack

- **Backend:** Flask 3 (app factory `backend/app/__init__.py`), SQLAlchemy 2.0 typed models +
  Alembic + Postgres (psycopg3). OpenAI SDK available. Port **5001**. Legacy MongoDB exists but
  **new code uses Postgres/SQLAlchemy only.**
- **Frontend:** Next.js 16 (App Router), React 19, TypeScript, Tailwind v4, Radix UI, **Recharts**
  (charts/funnel), **react-leaflet** (map), `motion`, `sonner`. Port **3000**.
- **Infra:** Docker Compose (frontend + backend + postgres). Render / Cloudflare configs exist.

## Run it

```bash
make run       # docker compose up --build  (frontend :3000, backend :5001, postgres :5432)
make rerun     # kill + rebuild + run
make logs      # follow logs
make migrate   # alembic upgrade head (backend container must be running)
make down      # stop
```

Env: copy `backend/.env.example` → `backend/.env` and `frontend/.env.example` → `frontend/.env.local`.
For the demo, set **`ALLOW_INSECURE_AUTH0_DEV=1`** in `backend/.env` so no Auth0 tenant is needed.
`DATABASE_URL` inside compose is set for you (`...@postgres:5432/okr`). Put `OPENAI_API_KEY` in
`backend/.env` for LLM extraction/scoring; code must **degrade gracefully to deterministic/seed paths
without it** (demos must not depend on a live key).

## Where code goes

**Backend** (mirror `okr.py` / `routes/okrs.py` conventions exactly):
- Models → `backend/app/models_sql/speaker_signal.py` (UUID str PK, tz-aware `created_at/updated_at`).
- Migration → `backend/alembic/versions/0003_speaker_signal.py` (or `make` an autogen, then review).
- Routes → `backend/app/routes/speaker_signal.py` (Flask `Blueprint`), **register in `app/__init__.py`**.
- Business logic → `backend/app/services/` (`conference_scraper.py`, `icp_scoring.py`, `dedupe.py`,
  `email_drafting.py`, `enrichment.py`). Keep routes thin; logic in services.
- DB sessions → use `app/db/postgres.py`. Seed → extend `backend/seed_data.py`.

**Frontend** (mirror existing `app/*` pages + `components/ui/*`):
- Pages → `frontend/app/{events,events/[id],ingest,speakers/[id],sequences,funnel}/page.tsx`.
- API calls → `frontend/lib/api.ts` (browser calls Flask directly; keep that pattern).
- Reuse `components/ui/*` primitives, Recharts for the funnel, Leaflet for the map. Add nav entries.

## Conventions

- Match the surrounding code's style, naming, and comment density. SQLAlchemy models use
  `Mapped[...]` + `mapped_column`. Routes return `jsonify(...)`, use `require_auth`.
- New API is under `/api`. Keep endpoint shapes as in the spec (§6) so frontend/backend stay in sync.
- **Scope discipline:** this is a one-day POC. Follow the build order in the spec §8; cut from the
  bottom. Prefer working end-to-end slices over breadth. Seed data must make every screen demoable.

## Guardrails (product-level, keep them true)

- **Public data only**, respect site terms + robots, polite rate limits, honest User-Agent.
- Outreach is **genuinely personalized** and includes an **easy opt-out**. POC **does not send email** —
  sending is mocked (status transitions). Reflect that honestly in the UI.

## When done

Verify the demo script in spec §9 actually runs end-to-end (`make run`, click through) before claiming
done. If tests or the flow break, say so with the output.
