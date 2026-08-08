# Atlas + Speaker Signal frontend

Optional local shell that pairs the ERCOT Project Atlas map with the Speaker Signal desk.

For the hackathon demo path, prefer the Compose dashboard in `speaker-signal/`:

```bash
# from repo root
docker compose up --build
```

Or run this app alone:

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open http://localhost:3000 — toggle between Project Atlas and Speaker Signal.
