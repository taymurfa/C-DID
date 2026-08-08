# Atlas + Speaker Signal + Project Radar frontend

Pairs the ERCOT Project Atlas map with Project Radar agents (R1–R3) and the Speaker Signal desk.

```bash
# Full stack from repo root (recommended)
docker compose up --build
# Track 2 desk:  http://localhost:3000
# Track 1 atlas: http://localhost:3001
```

Or run this app alone (agents must already be up on 8011–8013):

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open http://localhost:3000 — Map view → **Demo ingest** to run ingest → normalize → score.
