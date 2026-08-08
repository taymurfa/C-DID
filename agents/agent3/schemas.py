"""Domain constants + the data contract for Agent 3.

This is the single source of truth for the funnel stages and the conference-date-anchored cadence.
Persons 1/2/4 can read this file to see exactly what Agent 3 consumes and produces.
"""
from __future__ import annotations

# --- Funnel stages (order matters — advance() walks this list) --------------------------
# identified → contacted → replied → meeting → met → follow_up → conversation_booked
STAGES: list[str] = [
    "identified",
    "contacted",
    "replied",
    "meeting",          # meeting scheduled
    "met",              # met at the event
    "follow_up",        # post-event follow-up sent
    "conversation_booked",
]

STAGE_LABELS: dict[str, str] = {
    "identified": "Identified",
    "contacted": "Contacted",
    "replied": "Replied",
    "meeting": "Meeting scheduled",
    "met": "Met at event",
    "follow_up": "Follow-up sent",
    "conversation_booked": "Conversation booked",
}

# --- Cadence: the 5 steps, anchored to the conference start date ------------------------
# offset_days is added to the event start_date to get each step's scheduled_date.
STEP_KINDS: list[dict] = [
    {"kind": "t_minus_14", "offset_days": -14, "label": "T-14 · First touch"},
    {"kind": "t_minus_7", "offset_days": -7, "label": "T-7 · Follow-up"},
    {"kind": "t_minus_2", "offset_days": -2, "label": "T-2 · Meet at the event"},
    {"kind": "event_day", "offset_days": 0, "label": "Event day · Meet in person"},
    {"kind": "post_event", "offset_days": 3, "label": "Post-event · Book a conversation"},
]

# --- Per-email delivery status (mocked — POC does not actually send) ---------------------
# draft → sent → opened → replied → meeting
EMAIL_STATUSES: list[str] = ["draft", "sent", "opened", "replied", "meeting"]


def is_valid_stage(stage: str) -> bool:
    return stage in STAGES


def next_stage(stage: str) -> str | None:
    """Return the stage after `stage`, or None if already at the end."""
    if stage not in STAGES:
        return None
    i = STAGES.index(stage)
    return STAGES[i + 1] if i + 1 < len(STAGES) else None
