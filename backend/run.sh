#!/bin/bash
# Run the backend with the project venv (fixes SSL on macOS).
# Usage: ./run.sh   or   bash run.sh
cd "$(dirname "$0")"
if [ ! -d "venv" ]; then
  echo "Creating venv..."
  python3 -m venv venv
fi
source venv/bin/activate
pip install -q -r requirements.txt
exec python3 run.py
