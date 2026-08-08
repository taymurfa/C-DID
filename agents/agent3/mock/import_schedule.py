"""Import the real conference schedule into Mongo as events with EMBEDDED speakers.

Source: mock/full_schedule.csv (exported from schedule_events_example.numbers). Each session row
becomes one event document; speakers are embedded in event["speakers"] (no separate collection).
Every speaker's `email` is set to TEST_TO_EMAIL so real sends land in your test inbox.

Usage:  python -m agents.agent3.mock.import_schedule
"""
from __future__ import annotations

import csv
import os
import re
import uuid
from datetime import datetime
from pathlib import Path

from .. import store

CSV_PATH = Path(__file__).with_name("full_schedule.csv")
TEST_TO_EMAIL = os.getenv("TEST_TO_EMAIL", "kirill.cheldishkin2105@gmail.com")
CONFERENCE = "Data Center World Power 2026"
CONFERENCE_URL = "https://www.datacenterworld.com/"
CONFERENCE_CITY = "Dallas, TX"

NO_SPEAKERS = "no speakers found for this session"
# "Name(Company), Name(Company), ..." — company may contain commas, so match balanced parens.
_SPEAKER_RE = re.compile(r"([^()]+?)\(([^)]+?)\)")

# Topic keywords that signal a hot, ICP-relevant session (drives a simple heuristic score).
HOT_KEYWORDS = [
    "behind-the-meter", "behind the meter", "ai data center", "on-site", "onsite", "on site",
    "grid", "interconnection", "nuclear", "fusion", "microgrid", "energy storage", "storage",
    "demand response", "virtual power", "hyperscale", "generation", "power", "gas", "turbine",
    "smr", "reliability", "resilience", "procurement",
]


def _parse_dt(value: str) -> datetime | None:
    value = (value or "").strip()
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d"):
        try:
            return datetime.strptime(value, fmt)
        except ValueError:
            continue
    return None


def _parse_speakers(raw: str) -> list[dict]:
    raw = (raw or "").strip()
    if not raw or raw.lower() == NO_SPEAKERS:
        return []
    people = []
    for name, company in _SPEAKER_RE.findall(raw):
        name = name.strip(" ,\t\r\n")
        company = company.strip()
        if name:
            people.append({"name": name, "company": company})
    return people


def _score(title: str) -> tuple[int, str, list[str]]:
    text = (title or "").lower()
    hits = sorted({kw for kw in HOT_KEYWORDS if kw in text})
    score = min(96, 55 + 7 * len(hits)) if hits else 45
    if hits:
        reason = f"Speaking on \"{title}\" — topic signals: {', '.join(hits[:4])}."
    else:
        reason = f"Speaking on \"{title}\" — general session, weaker topic signal."
    return score, reason, hits


def run() -> None:
    if not CSV_PATH.exists():
        raise SystemExit(f"Missing {CSV_PATH}")

    # Clean slate for imported data + all Agent-3-owned output.
    store.emails().delete_many({})
    store.sequences().delete_many({})
    store.events().delete_many({"source": "schedule_import"})

    events: list[dict] = []
    with CSV_PATH.open(newline="") as f:
        for row in csv.DictReader(f):
            title = (row.get("session title") or "").strip()
            if not title:
                continue
            speakers = []
            for p in _parse_speakers(row.get("speakers", "")):
                sc, reason, hits = _score(title)
                speakers.append(
                    {
                        "id": uuid.uuid4().hex,
                        "name": p["name"],
                        "title": None,          # not in the source data
                        "company": p["company"],
                        "company_type": None,
                        "talk_title": title,
                        "talk_topic": title,
                        "icp_score": sc,
                        "icp_reason": reason,
                        "evidence": [f"Session: {title}", f"Company: {p['company']}"],
                        "email": TEST_TO_EMAIL,
                        "qualified": True,
                    }
                )
            events.append(
                {
                    "name": title,
                    "conference": CONFERENCE,
                    "url": CONFERENCE_URL,
                    "venue": (row.get("location") or "").strip() or None,
                    "location": CONFERENCE_CITY,
                    "start_date": _parse_dt(row.get("start time", "")),
                    "end_date": _parse_dt(row.get("end time", "")),
                    "day": (row.get("day") or "").strip() or None,
                    "description": (row.get("description") or "").strip() or None,
                    "tracks": (row.get("tracks") or "").strip() or None,
                    "format": (row.get("format") or "").strip() or None,
                    "status": "upcoming",
                    "source": "schedule_import",
                    "seen": False,
                    "speakers": speakers,
                    "created_at": store.now(),
                    "updated_at": store.now(),
                }
            )

    store.events().insert_many(events)
    total_speakers = sum(len(e["speakers"]) for e in events)
    with_speakers = sum(1 for e in events if e["speakers"])
    print(
        f"Imported {len(events)} events ({with_speakers} with speakers, {total_speakers} speakers "
        f"total) into '{store.db().name}'. All speaker emails → {TEST_TO_EMAIL}. "
        f"Sequences/emails cleared.",
        flush=True,
    )


if __name__ == "__main__":
    run()
