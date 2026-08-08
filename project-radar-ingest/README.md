# Project Radar Agent R1 — multi-source ingest

```bash
cp ../.env.example ../.env   # shared Atlas URI optional
npm install
npm run dev
```

- Health: `GET http://localhost:8011/health`
- Docs: `http://localhost:8011/docs`
- Ingest: `POST /ingest` `{ "mode": "demo" }`
