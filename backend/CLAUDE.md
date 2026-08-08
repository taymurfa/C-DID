# backend/CLAUDE.md

Flask API for **Speaker Signal**. See root `CLAUDE.md` and `docs/SPEAKER_SIGNAL_SPEC.md` first.

## Layout
- `app/__init__.py` — app factory `create_app()`; **register new blueprints here**.
- `app/routes/` — Flask blueprints (thin). Copy `routes/okrs.py` for style; `require_auth` from
  `routes/auth_backend.py`. New: `routes/speaker_signal.py`.
- `app/models_sql/` — SQLAlchemy 2.0 typed models (`Mapped`, `mapped_column`, UUID str PK). Copy
  `models_sql/okr.py`. New: `models_sql/speaker_signal.py`.
- `app/services/` — business logic (scraper, ICP scoring, dedupe, email drafting, enrichment).
- `app/db/postgres.py` — engine/session + Alembic runner. Use for sessions.
- `alembic/versions/` — migrations. New: `0003_speaker_signal.py`.
- `seed_data.py` — extend with demo conferences + speakers (demo must not need a live site or API key).

## Rules
- **Postgres/SQLAlchemy only** for new code (Mongo is legacy). Import models so Alembic sees them.
- Keep routes thin; put logic in `services/`. Return `jsonify`. Endpoints under `/api` per spec §6.
- OpenAI usage must **degrade gracefully** when `OPENAI_API_KEY` is absent (deterministic scoring +
  seeded parse for known demo URLs). Never let the demo hard-depend on a live LLM call.
- Scraping: `requests` with timeout + honest User-Agent, respect robots.txt, polite delays,
  public pages only. Clean HTML with BeautifulSoup before LLM extraction.

## Migrations
```bash
make migrate                                   # alembic upgrade head (container running)
docker compose exec backend alembic revision -m "speaker_signal"   # if you autogen, review the diff
```

## ICP scoring — the rubric (mirror spec §2)
Score 0–100 = weighted title fit + company-type fit + topic fit, with a one-sentence reason.
- **Title fit:** VP/Head/Director of Engineering, project-delivery, Infrastructure/Data Center/Power,
  VP Development. Down-weight analyst/academic/press.
- **Company-type fit:** lean **owner-operators** and **developers** score high; vendors/consultancies/
  universities/government score low. Classify into `company_type`.
- **Topic fit (heavy weight):** behind-the-meter power, AI data centers, on-site generation, grid
  interconnection, storage-for-compute, microgrids, project-delivery speed → hot. Generic
  sustainability/ESG panels → cool.
Store `icp_score`, `score_breakdown` (JSONB), and `icp_reason`.
