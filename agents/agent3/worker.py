"""Agent 3 automation worker — the background loop.

Runs two passes on their own intervals, forever:
  • every GENERATE_INTERVAL_SEC: scan for new events → generate sequences + scheduled emails
  • every SEND_INTERVAL_SEC:     send emails whose send_at has arrived (exactly once)

Run in its own terminal (separate from the API):
    python -m agents.agent3.worker            # loop forever
    python -m agents.agent3.worker --once     # run one generate + one send pass, then exit
"""
from __future__ import annotations

import sys
import time

from . import automation, config, store


def _tick_generate() -> None:
    res = automation.process_events()
    if res["events_processed"]:
        print(f"[worker.generate] processed {res['events_processed']} new event(s): "
              f"{[d['name'] for d in res['detail']]}", flush=True)


def _tick_send() -> None:
    res = automation.send_due()
    if res["sent_count"]:
        print(f"[worker.send] sent {res['sent_count']} due email(s)", flush=True)


def run_once() -> None:
    _tick_generate()
    _tick_send()


def run_forever() -> None:
    if not store.ping():
        print("[worker] WARNING: cannot reach MongoDB — check MONGODB_URI in .env", flush=True)
    print(f"[worker] started. generate every {config.GENERATE_INTERVAL_SEC}s, "
          f"send every {config.SEND_INTERVAL_SEC}s. Ctrl+C to stop.", flush=True)
    last_gen = last_send = 0.0
    while True:
        now = time.monotonic()
        if now - last_gen >= config.GENERATE_INTERVAL_SEC:
            _tick_generate()
            last_gen = now
        if now - last_send >= config.SEND_INTERVAL_SEC:
            _tick_send()
            last_send = now
        time.sleep(1)


if __name__ == "__main__":
    if "--once" in sys.argv:
        run_once()
    else:
        try:
            run_forever()
        except KeyboardInterrupt:
            print("\n[worker] stopped.", flush=True)
