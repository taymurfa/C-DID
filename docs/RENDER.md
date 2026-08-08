# Deploy Speaker Signal on Render

Blueprint file: [`render.yaml`](../render.yaml) (repo root).

Creates four Docker web services on branch **`Jobersteadt`**:

| Service | Package | Plan |
| --- | --- | --- |
| `speaker-signal-dashboard` | `speaker-signal/` | free |
| `speaker-signal-ingestion` | `speaker-signal-ingestion/` | **starter** (Playwright image) |
| `speaker-signal-intelligence` | `intelligence-service/` | free |
| `speaker-signal-gtm` | `gtm-service/` | free |

Agents bind `0.0.0.0:$PORT` (Render injects `PORT`). Local Compose still sets `INGESTION_PORT` / `INTELLIGENCE_PORT` / `GTM_PORT`.

## 1. Push the Blueprint

Commit and push `render.yaml` (and related changes) to `Jobersteadt` on GitHub (`taymurfa/C-DID`).

## 2. Create the Blueprint in Render

1. Open [Render Dashboard](https://dashboard.render.com) → **New** → **Blueprint**.
2. Connect the `taymurfa/C-DID` repo and select branch **`Jobersteadt`**.
3. Confirm it finds root `render.yaml`, then apply.

## 3. Fill secrets (`sync: false`)

In each service (or paste the same values where shared):

| Key | Where | Notes |
| --- | --- | --- |
| `MONGODB_URI` | all four | Atlas connection string |
| `OPENAI_API_KEY` | all (optional) | Falls back to templates if unset |
| `FIRECRAWL_API_KEY` | dashboard | Optional analyze preview |
| `SEND_MODE` | gtm | `real` to send mail; `mock` to log only |
| `SMTP_USER` / `SMTP_PASSWORD` / `SMTP_FROM` / `SENDER_EMAIL` | gtm | Zoho (quote passwords that contain `#`) |

Dashboard agent URLs (`INGESTION_API_URL`, `INTELLIGENCE_API_URL`, `GTM_API_URL`) and ingestion’s `INTELLIGENCE_URL` are wired automatically from each service’s `RENDER_EXTERNAL_URL`.

## 4. MongoDB Atlas Network Access

Allow Render egress: add `0.0.0.0/0` under Atlas **Network Access** (demo-friendly), or restrict to Render’s published IPs if you prefer.

## 5. Smoke checks

After deploy:

```bash
curl https://speaker-signal-ingestion.onrender.com/health
curl https://speaker-signal-intelligence.onrender.com/health
curl https://speaker-signal-gtm.onrender.com/health
curl https://speaker-signal-gtm.onrender.com/mail/status
# open https://speaker-signal-dashboard.onrender.com
```

Exact hostnames appear on each service’s Render page (`*.onrender.com`).

## Notes

- Free services **spin down** when idle; first request can take 30–60s.
- Ingestion uses the Playwright base image — if the build OOMs on free, keep **`starter`** (as in the Blueprint).
- Do not commit real secrets into `render.yaml`.
