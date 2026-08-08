"""Agent 3 automation — the passes the worker loop runs (and the manual endpoints call).

Two jobs:
  1. process_events()  — find events not yet processed, generate sequences + scheduled emails for
                          every embedded speaker, then mark the event `seen: true`.
  2. send_due()        — send every email whose send_at has arrived and that hasn't been sent yet.

Delivery goes through mailer (mock or real SMTP). Double-send is prevented by an atomic claim
(find_one_and_update on `sent != true`); if a real send then fails, the email is released so it can
be retried — it is never silently lost and never sent twice.
"""
from __future__ import annotations

from datetime import datetime

from bson import ObjectId
from bson.errors import InvalidId
from pymongo import ReturnDocument

from . import mailer, service, store


def _oid(value: str) -> ObjectId:
    try:
        return ObjectId(value)
    except (InvalidId, TypeError) as e:
        raise service.BadRequest(f"Invalid id: {value}") from e


# --- 1. Generator: new events → sequences + scheduled emails ----------------------------
def process_events() -> dict:
    """Process every event not yet marked seen. Idempotent at both event and speaker level."""
    processed: list[dict] = []
    for ev in store.events().find({"seen": {"$ne": True}}):
        speakers = ev.get("speakers", [])
        created = 0
        for sp in speakers:
            if service.generate_for_speaker(sp, ev) is not None:
                created += 1
        # Mark seen once every speaker's emails are generated.
        store.events().update_one(
            {"_id": ev["_id"]}, {"$set": {"seen": True, "processed_at": store.now()}}
        )
        processed.append({"event_id": str(ev["_id"]), "name": ev.get("name"),
                          "speakers": len(speakers), "sequences_created": created})
    return {"events_processed": len(processed), "detail": processed}


# --- 2. Sender: send due emails exactly once --------------------------------------------
def _claim(query: dict) -> dict | None:
    """Atomically reserve one unsent email matching `query`. None if nothing to claim."""
    now = store.now()
    return store.emails().find_one_and_update(
        {**query, "sent": {"$ne": True}},
        {"$set": {"sent": True, "status": "sending", "claimed_at": now, "updated_at": now}},
        return_document=ReturnDocument.AFTER,
    )


def _finalize(email_id, ok: bool, mode: str = "", error: str = "") -> dict:
    now = store.now()
    if ok:
        upd = {"status": "sent", "sent_at": now, "send_mode": mode, "last_error": None, "updated_at": now}
    else:  # release for retry
        upd = {"sent": False, "status": "draft", "last_error": error, "updated_at": now}
    store.emails().find_one_and_update({"_id": email_id}, {"$set": upd})
    return store.serialize(store.emails().find_one({"_id": email_id}))


def _claim_and_send(query: dict) -> dict | None:
    em = _claim(query)
    if em is None:
        return None
    try:
        mode = mailer.deliver(em.get("to_email"), em.get("subject", ""), em.get("body", ""))
        return _finalize(em["_id"], ok=True, mode=mode)
    except Exception as e:  # noqa: BLE001 — release the email, don't lose it
        print(f"[agent3.send] FAILED {em.get('kind')} → {em.get('to_email')}: {e}", flush=True)
        _finalize(em["_id"], ok=False, error=str(e))
        raise service.BadRequest(f"send failed: {e}") from e


def send_due(now: datetime | None = None) -> dict:
    """Send all emails whose send_at <= now and that haven't been sent. Returns what was sent."""
    now = now or store.now()
    sent: list[dict] = []
    errors: list[str] = []
    while True:
        try:
            em = _claim_and_send({"send_at": {"$ne": None, "$lte": now}})
        except service.BadRequest as e:
            errors.append(str(e))
            continue  # released; move on so one bad address can't wedge the loop
        if em is None:
            break
        sent.append(em)
    return {"sent_count": len(sent), "error_count": len(errors), "sent": sent}


def send_email(email_id: str) -> dict:
    """Manual send of ONE email now, ignoring schedule. Safe to call twice (won't resend)."""
    em = store.emails().find_one({"_id": _oid(email_id)})
    if em is None:
        raise service.NotFound(f"Email {email_id} not found")
    if em.get("sent"):
        raise service.BadRequest(f"Email {email_id} was already sent")
    result = _claim_and_send({"_id": em["_id"]})
    if result is None:
        raise service.BadRequest(f"Email {email_id} was already sent")
    return result


# --- Queue reads ------------------------------------------------------------------------
def list_emails(sent: bool | None = None, due: bool | None = None,
                sequence_id: str | None = None, event_id: str | None = None) -> dict:
    q: dict = {}
    if sent is not None:
        q["sent"] = True if sent else {"$ne": True}
    if due is True:
        q["send_at"] = {"$ne": None, "$lte": store.now()}
    if sequence_id:
        q["sequence_id"] = _oid(sequence_id)
    if event_id:
        q["event_id"] = _oid(event_id)
    docs = [store.serialize(e) for e in store.emails().find(q).sort("send_at", 1)]
    return {"count": len(docs), "emails": docs}
