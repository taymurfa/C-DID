"""Dashboard / gtm-service API compatibility for Agent 3.

The Signal Desk and speaker-signal proxies speak the TypeScript GTM contract
(`POST /sequences`, `GET /funnel`, `POST /funnel/events`). Agent 3's native
model uses embedded event speakers + `emails` documents. This module bridges
those shapes without changing the core orchestration in `service.py`.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from .cadence import parse_event_date
from . import service, store

# --- Stage aliases: Agent 3 internal ↔ dashboard LeadStatus -------------------
TO_DASHBOARD_STAGE = {
    "identified": "identified",
    "contacted": "contacted",
    "replied": "replied",
    "meeting": "meeting",
    "met": "met",
    "follow_up": "follow-up",
    "conversation_booked": "booked",
}
FROM_DASHBOARD_STAGE = {v: k for k, v in TO_DASHBOARD_STAGE.items()}

KIND_TO_ANCHOR = {
    "t_minus_14": "T-14",
    "t_minus_7": "T-7",
    "t_minus_2": "T-2",
    "event_day": "Event",
    "post_event": "T+2",
}

DASHBOARD_FUNNEL_LABELS = {
    "identified": "Identified",
    "contacted": "Contacted",
    "replied": "Replied",
    "meeting": "Meeting",
    "met": "Met",
    "follow-up": "Follow-up",
    "booked": "Booked",
}
DASHBOARD_STAGES = list(DASHBOARD_FUNNEL_LABELS.keys())


def _as_utc_midnight(value: Any) -> datetime | None:
    d = parse_event_date(value)
    if not d:
        return None
    return datetime(d.year, d.month, d.day, tzinfo=timezone.utc)


def _iso(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.isoformat()
    return str(value)


def _step_status(email: dict, now: datetime | None = None) -> str:
    status = (email.get("status") or "draft").lower()
    if status in ("sent", "opened"):
        return "Sent"
    if status in ("replied", "meeting"):
        return "Opportunity"
    send_at = email.get("send_at")
    if isinstance(send_at, str):
        try:
            send_at = datetime.fromisoformat(send_at.replace("Z", "+00:00"))
        except ValueError:
            send_at = None
    if isinstance(send_at, datetime):
        ref = now or store.now()
        if send_at.tzinfo is None:
            send_at = send_at.replace(tzinfo=timezone.utc)
        return "Scheduled" if send_at <= ref else "Planned"
    return "Planned"


def _grounded_on(speaker: dict, event: dict) -> list[str]:
    bits: list[str] = []
    for key in ("talk_title", "talk_topic", "company", "title", "icp_reason"):
        val = speaker.get(key)
        if val:
            bits.append(str(val))
    for key in ("name", "location", "venue"):
        val = event.get(key)
        if val:
            bits.append(str(val))
    return bits[:6]


def sequence_to_dashboard(seq_doc: dict) -> dict:
    """Hydrated Agent 3 sequence → dashboard SequenceResponse (+ persistence ids)."""
    speaker = seq_doc.get("speaker") or {}
    event = seq_doc.get("event") or {}
    emails = seq_doc.get("emails") or []
    steps = []
    drafts = []
    for em in emails:
        kind = em.get("kind") or ""
        anchor = KIND_TO_ANCHOR.get(kind, "T-14")
        steps.append(
            {
                "id": em.get("id") or str(uuid4()),
                "anchor": anchor,
                "label": em.get("label") or anchor,
                "scheduledFor": _iso(em.get("send_at")) or "",
                "subject": em.get("subject"),
                "status": _step_status(em),
            }
        )
        drafts.append(
            {
                "anchor": anchor,
                "subject": em.get("subject") or "",
                "body": em.get("body") or "",
                "groundedOn": _grounded_on(speaker, event),
                "generatedBy": "openai" if em.get("generated_by") == "llm" else "template",
            }
        )
    return {
        "id": seq_doc.get("id"),
        "leadId": seq_doc.get("speaker_id") or speaker.get("id"),
        "steps": steps,
        "drafts": drafts,
        "createdAt": _iso(seq_doc.get("created_at")) or store.now().isoformat(),
        "updatedAt": _iso(seq_doc.get("updated_at")) or store.now().isoformat(),
    }


def _speaker_from_lead(lead: dict) -> dict:
    topics = lead.get("topics") or []
    talk = lead.get("session") or (topics[0] if topics else None)
    evidence = lead.get("evidence") or []
    evidence_bits: list[str] = []
    for item in evidence:
        if isinstance(item, dict):
            bit = item.get("excerpt") or item.get("label") or item.get("sourceUrl")
            if bit:
                evidence_bits.append(str(bit))
        elif item:
            evidence_bits.append(str(item))
    return {
        "id": lead["id"],
        "name": lead.get("name") or "Speaker",
        "title": lead.get("title"),
        "company": lead.get("company"),
        "talk_title": talk,
        "talk_topic": ", ".join(topics) if topics else talk,
        "icp_score": lead.get("score") or lead.get("icp_score") or 0,
        "icp_reason": lead.get("reason") or lead.get("whyThisPersonMatters") or lead.get("icp_reason"),
        "evidence": evidence_bits,
        "email": lead.get("email"),
        "qualified": True,
    }


def _upsert_event_with_speaker(lead: dict, conference: dict) -> tuple[dict, dict]:
    """Materialize an Agent 3 event doc (speakers embedded) from a desk payload."""
    speaker = _speaker_from_lead(lead)
    start = parse_event_date(conference.get("startDate"))
    name = conference.get("name") or lead.get("conference") or "Conference"
    website = conference.get("websiteUrl") or ""

    query: dict[str, Any] = {"name": name}
    if start:
        query["start_date"] = datetime(start.year, start.month, start.day, tzinfo=timezone.utc)

    existing = store.events().find_one(query)
    now = store.now()
    if existing:
        speakers = list(existing.get("speakers") or [])
        replaced = False
        for i, sp in enumerate(speakers):
            if sp.get("id") == speaker["id"]:
                speakers[i] = {**sp, **speaker}
                replaced = True
                break
        if not replaced:
            speakers.append(speaker)
        store.events().update_one(
            {"_id": existing["_id"]},
            {
                "$set": {
                    "speakers": speakers,
                    "location": conference.get("location") or existing.get("location"),
                    "url": website or existing.get("url"),
                    "end_date": _as_utc_midnight(conference.get("endDate")),
                    "updated_at": now,
                }
            },
        )
        event = store.events().find_one({"_id": existing["_id"]}) or existing
        return event, speaker

    doc = {
        "name": name,
        "conference": name,
        "url": website,
        "venue": None,
        "location": conference.get("location"),
        "start_date": _as_utc_midnight(conference.get("startDate")),
        "end_date": _as_utc_midnight(conference.get("endDate")),
        "description": None,
        "status": "upcoming",
        "seen": False,
        "speakers": [speaker],
        "created_at": now,
        "updated_at": now,
        "source": "dashboard",
    }
    inserted = store.events().insert_one(doc)
    doc["_id"] = inserted.inserted_id
    return doc, speaker


def create_sequence_from_dashboard(payload: dict) -> dict:
    """POST /sequences body {lead, conference, now?} → dashboard sequence response."""
    lead = payload.get("lead") or {}
    conference = payload.get("conference") or {}
    if not lead.get("id") or not lead.get("name"):
        raise service.BadRequest("lead.id and lead.name are required")
    if not conference.get("startDate"):
        raise service.BadRequest("conference.startDate is required")
    if parse_event_date(conference.get("startDate")) is None:
        raise service.BadRequest("conference.startDate must be a valid date")

    event, speaker = _upsert_event_with_speaker(lead, conference)
    existing = store.sequences().find_one({"speaker_id": speaker["id"]})
    if existing:
        # Regenerate drafts so subjects stay fresh for the desk.
        store.emails().delete_many({"sequence_id": existing["_id"]})
        store.sequences().delete_one({"_id": existing["_id"]})

    seq_id = service.generate_for_speaker(speaker, event)
    if seq_id is None:
        raise service.BadRequest("Could not create sequence for lead")
    return sequence_to_dashboard(service.get_sequence(str(seq_id)))


def list_sequences_dashboard() -> dict:
    try:
        native = service.list_sequences()
    except Exception as exc:  # noqa: BLE001 — demo must survive Atlas outages
        print(f"[agent3.compat] list_sequences failed: {exc}", flush=True)
        return {"sequences": []}
    return {
        "sequences": [sequence_to_dashboard(s) for s in native.get("sequences", [])],
    }


def get_sequence_dashboard(sequence_id: str) -> dict:
    return sequence_to_dashboard(service.get_sequence(sequence_id))


def record_funnel_event(payload: dict) -> dict:
    """POST /funnel/events — update sequence stage (and optional audit doc)."""
    lead_id = (payload.get("leadId") or "").strip()
    status = (payload.get("status") or "").strip()
    if not lead_id:
        raise service.BadRequest("leadId is required")
    if status not in FROM_DASHBOARD_STAGE:
        raise service.BadRequest(f"Unknown status '{status}'. Valid: {DASHBOARD_STAGES}")

    internal = FROM_DASHBOARD_STAGE[status]
    try:
        seq = store.sequences().find_one({"speaker_id": lead_id})
        if seq:
            service.set_stage(str(seq["_id"]), internal)
        else:
            now = store.now()
            store.sequences().insert_one(
                {
                    "speaker_id": lead_id,
                    "event_id": None,
                    "stage": internal,
                    "conference_name": payload.get("conferenceName"),
                    "created_at": now,
                    "updated_at": now,
                    "source": "funnel_event",
                }
            )
        try:
            store.db()["funnel_events"].insert_one(
                {
                    "eventId": str(uuid4()),
                    "leadId": lead_id,
                    "status": status,
                    "at": payload.get("at") or store.now().isoformat(),
                    "conferenceName": payload.get("conferenceName"),
                    "created_at": store.now(),
                }
            )
        except Exception:  # noqa: BLE001
            pass
    except Exception as exc:  # noqa: BLE001
        raise service.BadRequest(f"Mongo unavailable: {exc}") from exc

    return {
        "event": {
            "eventId": str(uuid4()),
            "leadId": lead_id,
            "status": status,
            "at": payload.get("at") or store.now().isoformat(),
            "conferenceName": payload.get("conferenceName"),
        }
    }


def dashboard_funnel() -> dict:
    """GET /funnel — classic cumulative roll-up in dashboard LeadStatus names."""
    lead_statuses: dict[str, str] = {}
    try:
        for seq in store.sequences().find():
            speaker_id = seq.get("speaker_id")
            if not speaker_id:
                continue
            stage = TO_DASHBOARD_STAGE.get(seq.get("stage", "identified"), "identified")
            lead_statuses[str(speaker_id)] = stage

        # Prefer latest funnel_events when present (matches prior gtm-service behavior).
        for doc in store.db()["funnel_events"].find().sort("at", 1).limit(5000):
            lid = doc.get("leadId")
            st = doc.get("status")
            if lid and st in DASHBOARD_FUNNEL_LABELS:
                lead_statuses[str(lid)] = st
    except Exception as exc:  # noqa: BLE001 — empty funnel if Atlas is down
        print(f"[agent3.compat] funnel read failed: {exc}", flush=True)
        lead_statuses = {}

    statuses = list(lead_statuses.values())
    counts: list[int] = []
    for i, stage in enumerate(DASHBOARD_STAGES):
        counts.append(sum(1 for s in statuses if DASHBOARD_STAGES.index(s) >= i))

    stages = []
    for i, stage in enumerate(DASHBOARD_STAGES):
        prior = None if i == 0 else counts[i - 1]
        conversion = None if prior is None else (0 if prior == 0 else round(100 * counts[i] / prior))
        stages.append(
            {
                "stage": stage,
                "label": DASHBOARD_FUNNEL_LABELS[stage],
                "count": counts[i],
                "conversionFromPrior": conversion,
            }
        )

    drop_off = None
    for i in range(1, len(stages)):
        lost = max(0, stages[i - 1]["count"] - stages[i]["count"])
        if lost > 0 and (drop_off is None or lost > drop_off["lost"]):
            drop_off = {
                "from": stages[i - 1]["stage"],
                "to": stages[i]["stage"],
                "fromLabel": stages[i - 1]["label"],
                "toLabel": stages[i]["label"],
                "lost": lost,
            }

    return {"stages": stages, "dropOff": drop_off, "leadStatuses": lead_statuses}