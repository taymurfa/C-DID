"""MongoDB access + serialization helpers for Agent 3.

Uses the GTM database (`speaker_signal_gtm` by default). Reads/writes `events`
(with embedded speakers), and owns `sequences` + `emails` (+ optional `funnel_events`).
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import certifi
from pymongo import MongoClient
from pymongo.collection import Collection

from . import config

_client: MongoClient | None = None


def _connect() -> MongoClient:
    global _client
    if _client is None:
        kwargs: dict[str, Any] = {"serverSelectionTimeoutMS": 5000}
        # certifi only matters for TLS Atlas connections; harmless for local.
        if config.MONGODB_URI.startswith("mongodb+srv") or "mongodb.net" in config.MONGODB_URI:
            kwargs["tlsCAFile"] = certifi.where()
        _client = MongoClient(config.MONGODB_URI, **kwargs)
    return _client


def db():
    return _connect().get_database(config.MONGODB_DB_NAME)


def events() -> Collection:
    return db()[config.COLL_EVENTS]


def find_speaker(speaker_id: str) -> tuple[dict | None, dict | None]:
    """Speakers are embedded in the event document. Return (event, speaker) or (None, None)."""
    ev = events().find_one({"speakers.id": speaker_id})
    if not ev:
        return None, None
    for sp in ev.get("speakers", []):
        if sp.get("id") == speaker_id:
            return ev, sp
    return ev, None


def sequences() -> Collection:
    return db()[config.COLL_SEQUENCES]


def emails() -> Collection:
    return db()[config.COLL_EMAILS]


def now() -> datetime:
    return datetime.now(timezone.utc)


def serialize(doc: dict | None) -> dict | None:
    """Make a Mongo doc JSON-safe: ObjectId → str, datetime → ISO. Non-destructive."""
    if doc is None:
        return None
    out: dict[str, Any] = {}
    for k, v in doc.items():
        key = "id" if k == "_id" else k
        out[key] = _coerce(v)
    return out


def _coerce(v: Any) -> Any:
    from bson import ObjectId

    if isinstance(v, ObjectId):
        return str(v)
    if isinstance(v, datetime):
        return v.isoformat()
    if isinstance(v, list):
        return [_coerce(x) for x in v]
    if isinstance(v, dict):
        return {("id" if k == "_id" else k): _coerce(x) for k, x in v.items()}
    return v


def ping() -> bool:
    try:
        _connect().admin.command("ping")
        return True
    except Exception:
        return False
