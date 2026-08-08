# Render.com (free tier blueprint)

**Environment variables:** see [`RENDER_ENV.md`](RENDER_ENV.md).

The repo root [`render.yaml`](../render.yaml) defines:

- **Web service** `okr-backend`: Docker build from [`backend/Dockerfile`](../backend/Dockerfile), **Free** plan.
- **Web service** `okr-frontend`: Docker build from [`frontend/Dockerfile`](../frontend/Dockerfile) (Next.js `standalone`), **Free** plan.
- **PostgreSQL** `okr-postgres`: **Free** plan (limits apply; check [Render pricing](https://render.com/pricing)).

`okr-frontend` gets **`BACKEND_URL`** from the backend service’s `RENDER_EXTERNAL_URL` (same blueprint). Set **`AUTH0_*`** and **`AUTH0_BASE_URL`** to your frontend URL (e.g. `https://okr-frontend.onrender.com`).

## Deploy

1. In Render: **New** → **Blueprint** → connect this GitHub repo and select `render.yaml`.
2. After the first deploy, open each **Web Service** → **Environment** and set the variables marked `sync: false` (MongoDB, Auth0, `BACKEND_URL` on the API if needed, `CORS_ORIGINS`, `FRONTEND_URL`, etc.). `FLASK_SECRET_KEY` can stay auto-generated unless you rotate it.
3. Point **`CORS_ORIGINS`** (backend) and Auth0 **Allowed Callback URLs** at the frontend URL, and set **`FRONTEND_URL`** / **`AUTH0_BASE_URL`** (frontend) to that same frontend URL.

`DATABASE_URL` is wired from the Render Postgres instance; the backend normalizes `postgresql://` to `postgresql+psycopg://` for SQLAlchemy.

## Health checks

Render uses **`GET /live`** (always 200) for load balancer health. **`GET /health`** still checks MongoDB.
