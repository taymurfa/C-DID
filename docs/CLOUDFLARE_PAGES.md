# Cloudflare Pages — frontend

Reference YAML: [`frontend/cloudflare-pages.yaml`](../frontend/cloudflare-pages.yaml)

## Dashboard (Git integration)

1. **Workers & Pages** → **Create** → **Connect to Git**.
2. **Root directory**: `frontend`
3. **Build command**: `npm ci && npm run build` (or `npm install && npm run build`)
4. **Build output directory**: depends on how you deploy Next.js (see below).

Set **Environment variables** (Production / Preview):

| Variable | Example |
|----------|---------|
| `NODE_VERSION` | `20` (or rely on [`frontend/.nvmrc`](../frontend/.nvmrc)) |
| `NEXT_PUBLIC_API_URL` | `https://your-backend.onrender.com` |
| `AUTH0_*` | Same meaning as `frontend/.env.local` (no secrets in git) |

## Why output directory is not `out` by default

This app uses `output: "standalone"` in [`next.config.ts`](../frontend/next.config.ts) (Docker / `next start`). **Cloudflare Pages static hosting** expects a static folder (`out` with `output: 'export'`) or an adapter build.

You have **Next.js Route Handlers** under `frontend/app/api/`. A plain static export would drop those unless you move API logic elsewhere.

### Option A — Full Next on Cloudflare (recommended for Pages)

Use [**OpenNext Cloudflare**](https://opennext.js.org/cloudflare) or Cloudflare’s [**next-on-pages**](https://developers.cloudflare.com/pages/framework-guides/nextjs/) flow so SSR / routes work on Workers.

### Option B — Static UI only

Switch Next to `output: 'export'`, remove or replace `app/api` routes, point the browser at `NEXT_PUBLIC_API_URL` for the Flask API, and set the Pages **output directory** to `out`.

### Option C — Host the Node server elsewhere

Build `standalone` and run the Docker image (Render, Fly, etc.); use Cloudflare only for DNS/CDN in front.

## Wrangler

[`frontend/wrangler.toml`](../frontend/wrangler.toml) is a starter; fill `pages_build_output_dir` after you choose OpenNext or a static export path.
