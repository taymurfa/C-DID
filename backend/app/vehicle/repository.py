"""MongoDB persistence for vehicle listings and saved searches."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.db.mongodb import get_db
from app.vehicle.models import MergedListing


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _listing_doc_id(m: MergedListing) -> str:
    return m.vin or m.listing_key


def upsert_merged_listings(
    search_id: str | None,
    listings: list[MergedListing],
) -> tuple[list[MergedListing], list[dict[str, Any]]]:
    """
    Persist listings; update first_seen_at, last_seen_at, price_history, status.
    Returns (updated listings, alerts).
    """
    db = get_db()
    col = db.vehicle_listings
    alerts: list[dict[str, Any]] = []
    now = _now_iso()

    for m in listings:
        doc_id = _listing_doc_id(m)
        existing = col.find_one({"_id": doc_id})
        prev_price = existing.get("price") if existing else None

        if existing:
            m.first_seen_at = existing.get("firstSeenAt") or now
            history = existing.get("priceHistory") or []
            if m.price is not None and prev_price is not None and m.price < prev_price:
                drop = prev_price - m.price
                m.price_drop_amount = drop
                history.append({"at": now, "price": m.price, "previous": prev_price})
                if drop >= 500:
                    alerts.append(
                        {
                            "type": "price_drop",
                            "listingId": doc_id,
                            "title": m.title,
                            "dropAmount": drop,
                            "newPrice": m.price,
                            "previousPrice": prev_price,
                        }
                    )
            elif m.price is not None and (not history or history[-1].get("price") != m.price):
                history.append({"at": now, "price": m.price})
            m.price_history = history
            m.last_seen_at = now
            m.status = "active"
        else:
            m.first_seen_at = now
            m.last_seen_at = now
            if m.price is not None:
                m.price_history = [{"at": now, "price": m.price}]
            if m.score >= 80:
                alerts.append(
                    {
                        "type": "new_high_score",
                        "listingId": doc_id,
                        "title": m.title,
                        "score": m.score,
                        "price": m.price,
                        "vin": m.vin,
                    }
                )
            if m.certified and m.price and m.price <= 45000:
                alerts.append(
                    {
                        "type": "certified_under_budget",
                        "listingId": doc_id,
                        "title": m.title,
                        "price": m.price,
                    }
                )

        payload = m.to_api_dict()
        payload["_id"] = doc_id
        payload["searchId"] = search_id
        payload["firstSeenAt"] = m.first_seen_at
        payload["lastSeenAt"] = m.last_seen_at
        payload["priceHistory"] = m.price_history
        payload["status"] = m.status
        payload["listingKey"] = m.listing_key
        col.replace_one({"_id": doc_id}, payload, upsert=True)

    return listings, alerts


def get_listings(
    *,
    search_id: str | None = None,
    min_score: int | None = None,
    limit: int = 100,
) -> list[dict[str, Any]]:
    db = get_db()
    query: dict[str, Any] = {"status": "active"}
    if search_id:
        query["searchId"] = search_id
    if min_score is not None:
        query["score"] = {"$gte": min_score}
    rows = list(db.vehicle_listings.find(query).sort("score", -1).limit(limit))
    for r in rows:
        r["id"] = r.pop("_id")
    return rows


def save_search(user_id: str, name: str, criteria: dict[str, Any], source_ids: list[str] | None) -> str:
    db = get_db()
    doc = {
        "userId": user_id,
        "name": name,
        "criteria": criteria,
        "sourceIds": source_ids or [],
        "createdAt": _now_iso(),
        "updatedAt": _now_iso(),
        "lastRunAt": None,
    }
    result = db.vehicle_saved_searches.insert_one(doc)
    return str(result.inserted_id)


def get_saved_search(search_id: str, user_id: str) -> dict[str, Any] | None:
    from bson import ObjectId
    from bson.errors import InvalidId

    try:
        oid = ObjectId(search_id)
    except InvalidId:
        return None
    db = get_db()
    doc = db.vehicle_saved_searches.find_one({"_id": oid, "userId": user_id})
    if not doc:
        return None
    doc["id"] = str(doc.pop("_id"))
    return doc


def list_saved_searches(user_id: str) -> list[dict[str, Any]]:
    db = get_db()
    rows = list(db.vehicle_saved_searches.find({"userId": user_id}).sort("updatedAt", -1))
    for r in rows:
        r["id"] = str(r.pop("_id"))
    return rows


def touch_saved_search(search_id: str) -> None:
    from bson import ObjectId

    db = get_db()
    db.vehicle_saved_searches.update_one(
        {"_id": ObjectId(search_id)},
        {"$set": {"lastRunAt": _now_iso(), "updatedAt": _now_iso()}},
    )
