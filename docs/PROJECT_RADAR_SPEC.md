# Project Radar — Product Spec (Hackathon POC)

> Track 1 origination: multi-source capital projects → entity resolution → stage inference → map UI.

## Pitch

There is no single live source of truth for energy capital projects. Project Radar ingests public filings (ERCOT GIS, PUCT dockets, TCEQ permits in the POC fixtures), resolves the same project under different LLC/names, infers stage with confidence + evidence, and presents it beside the ERCOT atlas.

## Agents (mirror Track 2)

| Agent | Service | Port | Role |
| --- | --- | --- | --- |
| R1 | `project-radar-ingest` | 8011 | Multi-source raw ingest |
| R2 | `project-radar-normalize` | 8012 | Normalize + entity resolution |
| R3 | `project-radar-score` | 8013 | Stage inference, rank, light people join |

UI: `frontend/` on Compose `:3001` — Map + **Demo ingest** overlay.

## Demo path (~2 min)

1. `docker compose up --build`
2. Open `http://localhost:3001` → Map
3. Click **Demo ingest**
4. Confirm agents healthy; list shows scored projects
5. Open the **ER**-badged project (Lone Star BTM) — aliases across ERCOT / PUCT / TCEQ, stage + confidence, source evidence, people join

## Endpoints

- R1 `POST /ingest` `{ "mode": "demo" }`
- R2 `POST /normalize` `{ "records": [...] }`
- R3 `POST /score` `{ "projects": [...] }`
- R3 `POST /join` / `GET /projects`
- Frontend orchestration: `POST /api/radar/demo`

## Out of scope (POC)

Live PUCT/FERC scrapers, full GIS regenerator, replacing Track 2 desk.
