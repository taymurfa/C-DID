"""Conference-date-anchored cadence.

The whole point of Track 2: the cadence is anchored to the *event date*, not an arbitrary
schedule. Catch the buyer at concept stage, before the RFP. This module turns an event's
start date into the 5 scheduled touch points, each with an EXACT send datetime (minute precision).
"""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from . import config
from .schemas import STEP_KINDS


def parse_event_date(value) -> date | None:
    """Accept a date, datetime, or ISO-ish string ('2026-03-10', '2026-03-10T09:00:00Z')."""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        s = value.strip().replace("Z", "+00:00")
        try:
            return datetime.fromisoformat(s).date()
        except ValueError:
            try:
                return datetime.strptime(s[:10], "%Y-%m-%d").date()
            except ValueError:
                return None
    return None


def build_cadence(event_start: date | None) -> list[dict]:
    """Return the 5 cadence steps, each with an exact `send_at` datetime (UTC, minute precision).

    If the event date is unknown, steps are still created with `send_at=None` so the sequence is
    visible/editable — we just can't schedule them yet (the sender skips null send_at).
    """
    steps: list[dict] = []
    for order, spec in enumerate(STEP_KINDS):
        send_at: datetime | None = None
        if event_start:
            d = event_start + timedelta(days=spec["offset_days"])
            send_at = datetime(
                d.year, d.month, d.day, config.SEND_HOUR, config.SEND_MINUTE, tzinfo=timezone.utc
            )
        steps.append(
            {
                "kind": spec["kind"],
                "label": spec["label"],
                "sort_order": order,
                "send_at": send_at,
            }
        )
    return steps
