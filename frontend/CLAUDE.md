# frontend/CLAUDE.md

Next.js 16 App Router UI for **Speaker Signal**. See root `CLAUDE.md` and `docs/SPEAKER_SIGNAL_SPEC.md`.

## Layout
- `app/` — App Router pages. New: `events/`, `events/[id]/`, `ingest/`, `speakers/[id]/`,
  `sequences/`, `funnel/`. Copy an existing `app/*/page.tsx` for structure.
- `components/` — shared components; `components/ui/*` are the primitives (buttons, tabs, select,
  progress, etc.). Reuse them; don't reinvent.
- `lib/api.ts` — API client. Browser calls Flask **directly** (cross-origin + cookie); keep that
  pattern. Add typed fetchers for the spec §6 endpoints here.

## Toolkit (already installed — don't add deps unless necessary)
- **Recharts** → the funnel viz (`app/funnel`) and any charts.
- **react-leaflet** + `leaflet` → conference map on `app/events`.
- `motion` → the "explorable/addictive" feel (list/card transitions).
- `sonner` → toasts (e.g. "12 ICP-fit speakers found").
- `lucide-react` → icons. Tailwind v4 for styling.

## Rules
- TypeScript throughout; type API responses to match backend shapes in spec §6.
- The star surfaces are **Events → ranked speaker list** (make it feel great) and the **Funnel**.
  Each speaker row shows score (badge/meter), talk topic, and the one-sentence reason.
- Add new pages to the sidebar/nav. Leave OKR pages in place but don't link to them.
- Show honesty in UI: emails are **drafts**, sending is **mocked**, enrichment may be **unverified**.

## Run
Runs in Docker via `make run` (root). Standalone: `npm run dev` (needs backend on :5001 + env in
`.env.local`; set `NEXT_PUBLIC_API_URL=http://localhost:5001`).
