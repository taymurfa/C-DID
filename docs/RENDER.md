# Deploy GridConnects on Render

Blueprint file: [`render.yaml`](../render.yaml) (repo root).

Creates four Docker web services from branch **`main`**:

| Service | Package | Plan |
| --- | --- | --- |
| `gridconnects` | `frontend/` (landing + unified Map / Signal product) | free |
| `gridconnects-ingestion` | `speaker-signal-ingestion/` | free |
| `gridconnects-intelligence` | `intelligence-service/` | free |
| `gridconnects-gtm` | `gtm-service/` | free |

Agents bind `0.0.0.0:$PORT` (Render injects `PORT`). Local Compose still sets `INGESTION_PORT` / `INTELLIGENCE_PORT` / `GTM_PORT`.

## 1. Push the Blueprint

Commit and push `render.yaml` (and related changes) to `main` on GitHub (`taymurfa/C-DID`).

## 2. Create / sync the Blueprint in Render

1. Open [Render Dashboard](https://dashboard.render.com) → **New** → **Blueprint** (or open the existing Blueprint and **Manual Sync**).
2. Connect the `taymurfa/C-DID` repo and select branch **`main`**.
3. Confirm it finds root `render.yaml`, then apply.

## 3. Fill secrets (`sync: false`)

In each service (or paste the same values where shared):

| Key | Where | Notes |
| --- | --- | --- |
| `MONGODB_URI` | all four | Atlas connection string |
| `OPENAI_API_KEY` | all (optional) | Falls back to templates if unset |
| `FIRECRAWL_API_KEY` | dashboard | Optional analyze preview |
| `SEND_MODE` | gtm | **Locked to `mock` on Render** — drafts only, no automatic sending |
| `SMTP_USER` / `SMTP_PASSWORD` / `SMTP_FROM` / `SENDER_EMAIL` | gtm | Zoho (quote passwords that contain `#`) |

Dashboard agent URLs (`INGESTION_API_URL`, `INTELLIGENCE_API_URL`, `GTM_API_URL`) and ingestion’s `INTELLIGENCE_URL` are wired automatically from each service’s `RENDER_EXTERNAL_URL`.

## 4. MongoDB Atlas Network Access

Allow Render egress: add `0.0.0.0/0` under Atlas **Network Access** (demo-friendly), or restrict to Render’s published IPs if you prefer.

## 5. Smoke checks

After deploy:

```bash
curl https://gridconnects-ingestion.onrender.com/health
curl https://gridconnects-intelligence.onrender.com/health
curl https://gridconnects-gtm.onrender.com/health
curl https://gridconnects-gtm.onrender.com/mail/status
# open https://gridconnects.onrender.com
# product: https://gridconnects.onrender.com/app
```

Exact hostnames appear on each service’s Render page (`*.onrender.com`).

## Notes

- Free services **spin down** when idle; first request can take 30–60s.
- Ingestion uses the Playwright base image. If the build exceeds free-tier memory, move that service to **Starter**.
- Do not commit real secrets into `render.yaml`.
- If you previously deployed `speaker-signal-*` services, syncing this Blueprint creates the new `gridconnects*` services; you can delete the old ones after cutover.
- **Email:** Render GTM is locked to `SEND_MODE=mock` (draft only — no automatic sending). Local demo with `SEND_MODE=real` can use **Send demo to team**, which always delivers to `TEST_TO_EMAIL`, never the lead.
