"""Agent 3 orchestration — the GTM motion.

Speakers are embedded in each event document (event["speakers"] = [ {id, name, company, ...} ]).
Agent 3 turns each qualified speaker into an event-anchored sequence whose emails live in the
`emails` collection (the send queue), tracks the lead through the funnel, and computes conversion /
drop-off. Automation passes (scan new events, send due emails) live in automation.py and reuse the
generator here.
"""
from __future__ import annotations

from typing import Any

from bson import ObjectId
from bson.errors import InvalidId

from . import store
from .cadence import build_cadence, parse_event_date
from .drafting import draft_email
from .schemas import EMAIL_STATUSES, STAGE_LABELS, STAGES, is_valid_stage, next_stage


class NotFound(Exception):
    pass


class BadRequest(Exception):
    pass


def _oid(value: str) -> ObjectId:
    """For event / sequence / email ids (real ObjectIds). Speaker ids are plain strings."""
    try:
        return ObjectId(value)
    except (InvalidId, TypeError) as e:
        raise BadRequest(f"Invalid id: {value}") from e


def _get_event(event_id: str) -> dict:
    doc = store.events().find_one({"_id": _oid(event_id)})
    if not doc:
        raise NotFound(f"Event {event_id} not found")
    return doc


# --- Reads (events + their embedded qualified speakers) ---------------------------------
def list_events() -> list[dict]:
    """Events available to work, annotated with counts + whether they've been processed."""
    out = []
    for ev in store.events().find().sort("start_date", 1):
        doc = store.serialize(ev) or {}
        doc["qualified_speaker_count"] = len(ev.get("speakers", []))
        doc["enrolled_count"] = store.sequences().count_documents({"event_id": ev["_id"]})
        doc["seen"] = bool(ev.get("seen"))
        out.append(doc)
    return out


def list_event_speakers(event_id: str, min_score: int = 0) -> list[dict]:
    """Embedded speakers for an event, ranked by ICP score, annotated with enrollment state."""
    ev = _get_event(event_id)
    speakers = [s for s in ev.get("speakers", []) if s.get("icp_score", 0) >= min_score]
    speakers.sort(key=lambda s: s.get("icp_score", 0), reverse=True)
    out = []
    for sp in speakers:
        doc = dict(sp)
        seq = store.sequences().find_one({"speaker_id": sp.get("id")})
        doc["enrolled"] = bool(seq)
        doc["sequence_id"] = str(seq["_id"]) if seq else None
        out.append(store.serialize(doc))
    return out


# --- Generation: create a sequence + its 5 scheduled, drafted emails --------------------
# Shared by the manual enroll endpoint AND the automation generator (automation.process_events).
def generate_for_speaker(speaker: dict, event: dict) -> ObjectId | None:
    """Create a sequence + emails for one embedded speaker. Idempotent → None if already enrolled."""
    speaker_id = speaker.get("id")
    if not speaker_id:
        return None
    if store.sequences().find_one({"speaker_id": speaker_id}):
        return None

    now = store.now()
    seq_id = store.sequences().insert_one(
        {
            "speaker_id": speaker_id,
            "event_id": event["_id"],
            "stage": "identified",
            "created_at": now,
            "updated_at": now,
        }
    ).inserted_id

    event_start = parse_event_date(event.get("start_date"))
    for step in build_cadence(event_start):
        email = draft_email(step["kind"], speaker, event)
        store.emails().insert_one(
            {
                "sequence_id": seq_id,
                "speaker_id": speaker_id,
                "event_id": event["_id"],
                "kind": step["kind"],
                "label": step["label"],
                "sort_order": step["sort_order"],
                "send_at": step["send_at"],   # exact datetime (UTC), minute precision, or None
                "to_email": speaker.get("email"),
                "subject": email["subject"],
                "body": email["body"],
                "generated_by": email["generated_by"],
                "status": "draft",
                "sent": False,                # guard against double-send
                "sent_at": None,
                "created_at": now,
                "updated_at": now,
            }
        )
    return seq_id


def enroll_speaker(speaker_id: str, regenerate: bool = False) -> dict:
    event, speaker = store.find_speaker(speaker_id)
    if not speaker:
        raise NotFound(f"Speaker {speaker_id} not found")

    existing = store.sequences().find_one({"speaker_id": speaker_id})
    if existing and regenerate:
        store.emails().delete_many({"sequence_id": existing["_id"]})
        store.sequences().delete_one({"_id": existing["_id"]})
        existing = None
    if existing:
        return get_sequence(str(existing["_id"]))

    seq_id = generate_for_speaker(speaker, event)
    return get_sequence(str(seq_id))


def enroll_all_for_event(event_id: str, min_score: int = 0) -> dict:
    """Demo convenience: enroll every qualified speaker of an event in one call."""
    speakers = list_event_speakers(event_id, min_score=min_score)
    created = 0
    for sp in speakers:
        if not sp.get("enrolled"):
            enroll_speaker(sp["id"])
            created += 1
    return {"event_id": event_id, "enrolled_now": created, "total_qualified": len(speakers)}


# --- Sequence reads (Juicebox-style view) -----------------------------------------------
def get_sequence(sequence_id: str) -> dict:
    seq = store.sequences().find_one({"_id": _oid(sequence_id)})
    if not seq:
        raise NotFound(f"Sequence {sequence_id} not found")
    return _hydrate_sequence(seq)


def list_sequences() -> dict:
    seqs = [_hydrate_sequence(s) for s in store.sequences().find().sort("updated_at", -1)]
    return {"sequences": seqs, "rates": _aggregate_rates(seqs)}


def _hydrate_sequence(seq: dict) -> dict:
    doc = store.serialize(seq) or {}
    doc["emails"] = [
        store.serialize(e)
        for e in store.emails().find({"sequence_id": seq["_id"]}).sort("sort_order", 1)
    ]
    event, speaker = store.find_speaker(seq.get("speaker_id"))
    doc["speaker"] = store.serialize(speaker) if speaker else None
    doc["event"] = store.serialize(event) if event else None
    doc["stage_label"] = STAGE_LABELS.get(seq.get("stage", ""), seq.get("stage"))
    return doc


def _aggregate_rates(seqs: list[dict]) -> dict:
    """Open / reply / meeting rates across all emails (Juicebox-style headline numbers)."""
    sent = opened = replied = meeting = 0
    for s in seqs:
        for em in s.get("emails", []):
            st = em.get("status")
            if st in ("sent", "opened", "replied", "meeting"):
                sent += 1
            if st in ("opened", "replied", "meeting"):
                opened += 1
            if st in ("replied", "meeting"):
                replied += 1
            if st == "meeting":
                meeting += 1

    def pct(n: int) -> float:
        return round(100 * n / sent, 1) if sent else 0.0

    return {"sent": sent, "open_rate": pct(opened), "reply_rate": pct(replied), "meeting_rate": pct(meeting)}


# --- Funnel mutations + reporting -------------------------------------------------------
def advance_stage(sequence_id: str) -> dict:
    seq = store.sequences().find_one({"_id": _oid(sequence_id)})
    if not seq:
        raise NotFound(f"Sequence {sequence_id} not found")
    nxt = next_stage(seq.get("stage", "identified"))
    if nxt is None:
        return _hydrate_sequence(seq)  # already at the end
    store.sequences().update_one({"_id": seq["_id"]}, {"$set": {"stage": nxt, "updated_at": store.now()}})
    return get_sequence(sequence_id)


def set_stage(sequence_id: str, stage: str) -> dict:
    if not is_valid_stage(stage):
        raise BadRequest(f"Unknown stage '{stage}'. Valid: {STAGES}")
    res = store.sequences().update_one(
        {"_id": _oid(sequence_id)}, {"$set": {"stage": stage, "updated_at": store.now()}}
    )
    if res.matched_count == 0:
        raise NotFound(f"Sequence {sequence_id} not found")
    return get_sequence(sequence_id)


def mark_email(email_id: str, status: str) -> dict:
    if status not in EMAIL_STATUSES:
        raise BadRequest(f"Unknown status '{status}'. Valid: {EMAIL_STATUSES}")
    em = store.emails().find_one({"_id": _oid(email_id)})
    if not em:
        raise NotFound(f"Email {email_id} not found")
    store.emails().update_one({"_id": em["_id"]}, {"$set": {"status": status, "updated_at": store.now()}})
    return get_sequence(str(em["sequence_id"]))


def funnel() -> dict:
    """Stage counts + conversion/drop-off across the 7-stage funnel."""
    counts = {stage: store.sequences().count_documents({"stage": stage}) for stage in STAGES}
    # A lead at stage N has passed through every prior stage → cumulative reached counts.
    reached: dict[str, int] = {}
    running = 0
    for stage in reversed(STAGES):
        running += counts[stage]
        reached[stage] = running
    top = reached[STAGES[0]] or 0

    steps = []
    prev = None
    for stage in STAGES:
        n = reached[stage]
        steps.append(
            {
                "stage": stage,
                "label": STAGE_LABELS[stage],
                "count": n,
                "at_stage": counts[stage],
                "pct_of_top": round(100 * n / top, 1) if top else 0.0,
                "drop_from_prev": round(100 * (prev - n) / prev, 1) if prev else 0.0,
            }
        )
        prev = n
    return {"identified": top, "steps": steps}
