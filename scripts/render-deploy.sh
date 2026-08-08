#!/usr/bin/env bash
# Trigger Render deploys for okr-backend and okr-frontend via the Render CLI.
#
# Prereqs:
#   brew install render
#   render login
#   render workspace set   # pick the workspace that owns these services
#
# First-time infrastructure: create the Blueprint in the Render Dashboard
# (New → Blueprint → connect https://github.com/Joshober/HackathonTemplate → render.yaml).
# The CLI cannot apply a brand-new Blueprint file; it validates it and triggers deploys
# for existing services.
#
# Optional: RENDER_API_KEY for CI (see https://render.com/docs/cli )

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! render whoami -o text >/dev/null 2>&1; then
  echo "Render CLI is not logged in. Run:  render login"
  echo "Then:  render workspace set"
  exit 1
fi

echo "Validating render.yaml..."
render blueprints validate render.yaml --confirm -o text

echo "Fetching services..."
JSON=$(render services -o json --confirm)

deploy_id() {
  local want_name="$1"
  python3 -c "
import json, sys
want = sys.argv[2]
raw = json.loads(sys.argv[1])

def walk(o):
    if isinstance(o, dict):
        if o.get('name') == want and ('id' in o or 'serviceId' in o):
            return o.get('id') or o.get('serviceId')
        for v in o.values():
            r = walk(v)
            if r:
                return r
    elif isinstance(o, list):
        for x in o:
            r = walk(x)
            if r:
                return r
    return None

sid = walk(raw)
if sid:
    print(sid)
    sys.exit(0)
sys.exit(1)
" "$JSON" "$want_name"
}

BACKEND_ID="$(deploy_id "okr-backend" || true)"
FRONTEND_ID="$(deploy_id "okr-frontend" || true)"

if [[ -z "$BACKEND_ID" || -z "$FRONTEND_ID" ]]; then
  echo "Could not find okr-backend / okr-frontend in this workspace."
  echo "Create them once: Dashboard → New → Blueprint → repo + render.yaml"
  echo "Or check names with: render services -o json --confirm"
  exit 1
fi

echo "Deploying backend ($BACKEND_ID)..."
render deploys create "$BACKEND_ID" --confirm --wait -o text

echo "Deploying frontend ($FRONTEND_ID)..."
render deploys create "$FRONTEND_ID" --confirm --wait -o text

echo "Done."
