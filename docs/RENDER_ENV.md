# Environment variables on Render

All values below are **Render dashboard → Environment** unless the blueprint wires them automatically.

## Auto-injected (do not set manually)

| Variable | Where |
|----------|--------|
| `PORT` | Render injects for the listening port. |
| `RENDER_EXTERNAL_URL` | Public `https://…onrender.com` URL for **each** web service. |
| `DATABASE_URL` | Backend only: from Postgres via `render.yaml` `fromDatabase`. |
| `FRONTEND_URL` | Backend only: from `render.yaml` `fromService` → `okr-frontend` `RENDER_EXTERNAL_URL`. |
| `BACKEND_URL` | Frontend only: from `render.yaml` → `okr-backend` `RENDER_EXTERNAL_URL`. |

## Backend (`okr-backend`)

| Variable | Required | Notes |
|----------|----------|--------|
| `FLASK_ENV` | Yes | `production` in blueprint. |
| `OKR_REPOSITORY` | Yes | `postgres` in blueprint. |
| `FLASK_SECRET_KEY` | Yes | Blueprint uses `generateValue: true`. |
| `MONGODB_URI` | Yes* | MongoDB Atlas connection string. |
| `MONGODB_DB_NAME` | Optional | Defaults in app if unset. |
| `FRONTEND_URL` | Auto | Blueprint wires it from the frontend service (`fromService`). |
| `APP_ADMIN_USER_IDS` | Optional | Comma-separated Auth0 `sub` values. |
| `APP_ADMIN_EMAILS` | Optional | Comma-separated emails → admin on login. |
| `APP_ORG_OWNER_EMAILS` | Optional | Comma-separated emails → `org_owner` on login (admin list wins if the same email is in both). |
| `APP_DEFAULT_ORG_NAME` | Optional | Display name for the auto-created Postgres org (e.g. `Select Quote`). Replaces names ending in `'s organization` when listing orgs. |
| `AUTH0_ISSUER_BASE_URL` | Yes | Auth0 tenant issuer URL. |
| `AUTH0_CLIENT_ID` | Yes | Auth0 application client id. |
| `AUTH0_CLIENT_SECRET` | Yes | Auth0 application secret. |
| `AUTH0_AUDIENCE` | Optional | API audience; defaults if omitted when domain is set. |
| `AUTH0_DOMAIN` | Optional | Alternative to deriving host from `AUTH0_ISSUER_BASE_URL`. |
| `ALLOW_INSECURE_AUTH0_DEV` | **Do not set** | Only for local Flask (`FLASK_ENV` ≠ `production`). Never on Render production. |

\* Set `MONGODB_URI` in the dashboard.

**Auth0** must be set on the backend in production, or the app will not start. Use your `*.onrender.com` URLs in Auth0’s callback / logout / web origins, not localhost.

**Atlas / MongoDB:** allow Render’s outbound IPs or temporarily `0.0.0.0/0` under Network Access if you see TLS or timeout errors from Render.

**Not needed on the backend** (handled in code or Render):

- `BACKEND_URL` — defaults to `RENDER_EXTERNAL_URL`.
- `CORS_ORIGINS` — omit to allow **only** `FRONTEND_URL`; set `CORS_ORIGINS` only if you need comma-separated extra origins.

## Frontend (`okr-frontend`)

| Variable | Required | Notes |
|----------|----------|--------|
| `NODE_ENV` | Yes | `production` in blueprint. |
| `BACKEND_URL` | Auto | Blueprint: `fromService` → `okr-backend` `RENDER_EXTERNAL_URL`. |

**Not needed on the frontend** (unless you override):

- `NEXT_PUBLIC_API_URL` — omit to keep same-origin `/api` → rewrites to `BACKEND_URL`.
- `NEXT_PUBLIC_APP_URL` — optional; only if the client must know the public URL at build time.

**Auth0 on the frontend** (when using Next.js Auth0 helpers): add `AUTH0_SECRET`, `AUTH0_ISSUER_BASE_URL`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, optional `AUTH0_AUDIENCE` / `AUTH0_BASE_URL` in the Render dashboard; use production URLs.

## Auth0 Dashboard

OAuth completes on the **Flask** API. Configure Auth0 for the backend and add:

- **Allowed Callback URLs:** `{BACKEND_URL}/api/auth/callback` (copy `RENDER_EXTERNAL_URL` from `okr-backend` + path).
- **Allowed Logout URLs** and **Allowed Web Origins:** `{FRONTEND_URL}` (auto from blueprint on the backend, or copy from `okr-frontend`).

After the first deploy, copy the two `https://…onrender.com` URLs from Render into Auth0.
