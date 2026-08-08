from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from bson.errors import InvalidId

from app.db.mongodb import get_db


def _now():
    return datetime.now(timezone.utc)


def _serialize_doc(doc, date_fields=None):
    if doc is None:
        return None
    date_fields = date_fields or [
        "createdAt",
        "updatedAt",
        "lastUpdatedAt",
        "timestamp",
        "recordedAt",
        "uploadedAt",
        "deletedAt",
    ]
    out = dict(doc)
    if "_id" in out:
        out["_id"] = str(out["_id"])
    for k in list(out.keys()):
        if k in ("parentObjectiveId", "objectiveId", "departmentId", "keyResultId", "attachmentId") and out.get(k) is not None:
            out[k] = str(out[k])
        elif k == "relatedObjectiveIds" and out.get(k) is not None:
            out[k] = [str(x) for x in out[k]]
        elif k in date_fields and out.get(k) is not None and hasattr(out[k], "isoformat"):
            out[k] = out[k].isoformat()
    return out


def _parse_object_id(value):
    try:
        return ObjectId(value)
    except (InvalidId, TypeError):
        return None


class MongoOKRRepository:
    def list_departments(self, user_id: str) -> list[dict[str, Any]]:
        db = get_db()
        cursor = db.departments.find({}, {"_id": 1, "name": 1, "color": 1})
        items: list[dict[str, Any]] = []
        for doc in cursor:
            d: dict[str, Any] = {"_id": str(doc["_id"]), "name": doc.get("name", "")}
            if doc.get("color"):
                d["color"] = doc["color"]
            items.append(d)
        return items

    def list_objectives(self, user_id: str, filters: dict[str, Any]) -> list[dict[str, Any]]:
        db = get_db()
        cursor = db.objectives.find(filters).sort("createdAt", -1)
        return [_serialize_doc(d) for d in cursor]

    def get_objective(self, user_id: str, objective_id: str) -> dict[str, Any] | None:
        oid = _parse_object_id(objective_id)
        if oid is None:
            return None
        db = get_db()
        doc = db.objectives.find_one({"_id": oid})
        return _serialize_doc(doc) if doc else None

    def create_objective(self, user_id: str, data: dict[str, Any]) -> dict[str, Any]:
        db = get_db()
        parent_oid = _parse_object_id(data.get("parentObjectiveId")) if data.get("parentObjectiveId") else None
        now = datetime.utcnow()
        doc = {
            "title": data["title"],
            "description": data.get("description", ""),
            "ownerId": data.get("ownerId", user_id),
            "level": data.get("level", "strategic"),
            "timeline": data.get("timeline", "annual"),
            "fiscalYear": data["fiscalYear"],
            "quarter": data.get("quarter"),
            "parentObjectiveId": parent_oid,
            "division": data.get("division"),
            "status": data.get("status", "draft"),
            "departmentId": data.get("departmentId"),
            "relatedObjectiveIds": [],
            "createdAt": now,
            "updatedAt": now,
        }
        if data.get("relatedObjectiveIds"):
            oids = [_parse_object_id(x) for x in data["relatedObjectiveIds"] if _parse_object_id(x)]
            doc["relatedObjectiveIds"] = oids
        result = db.objectives.insert_one(doc)
        doc["_id"] = result.inserted_id
        return _serialize_doc(doc)

    def update_objective(self, user_id: str, objective_id: str, data: dict[str, Any]) -> dict[str, Any] | None:
        oid = _parse_object_id(objective_id)
        if oid is None:
            return None
        db = get_db()
        existing = db.objectives.find_one({"_id": oid})
        if not existing:
            return None
        update: dict[str, Any] = {"updatedAt": _now()}
        for key in (
            "title",
            "description",
            "ownerId",
            "level",
            "timeline",
            "fiscalYear",
            "quarter",
            "division",
            "status",
            "departmentId",
            "nextReviewDate",
            "latestUpdateSummary",
        ):
            if key in data:
                update[key] = data[key]
        if "relatedObjectiveIds" in data:
            ids = data["relatedObjectiveIds"]
            if isinstance(ids, list):
                update["relatedObjectiveIds"] = [_parse_object_id(x) for x in ids if _parse_object_id(x)]
            else:
                update["relatedObjectiveIds"] = []
        if "parentObjectiveId" in data:
            if data["parentObjectiveId"] is None or data["parentObjectiveId"] == "":
                update["parentObjectiveId"] = None
            else:
                poid = _parse_object_id(data["parentObjectiveId"])
                if poid is None:
                    return None
                update["parentObjectiveId"] = poid

        db.objectives.update_one({"_id": oid}, {"$set": update})
        updated = db.objectives.find_one({"_id": oid})
        return _serialize_doc(updated) if updated else None

    def delete_objective(self, user_id: str, objective_id: str) -> bool:
        oid = _parse_object_id(objective_id)
        if oid is None:
            return False
        db = get_db()
        db.key_results.delete_many({"objectiveId": oid})
        res = db.objectives.delete_one({"_id": oid})
        return res.deleted_count > 0

    def get_objective_tree(self, user_id: str, objective_id: str) -> dict[str, Any] | None:
        oid = _parse_object_id(objective_id)
        if oid is None:
            return None
        db = get_db()
        root = db.objectives.find_one({"_id": oid})
        if not root:
            return None

        def build_node(obj_doc):
            node = _serialize_doc(obj_doc)
            node_id = obj_doc["_id"]
            children = list(db.objectives.find({"parentObjectiveId": node_id}))
            node["children"] = [build_node(c) for c in children]
            krs = list(db.key_results.find({"objectiveId": node_id}))
            node["keyResults"] = [_serialize_doc(kr) for kr in krs]
            scores = [kr.get("score") for kr in krs if kr.get("score") is not None]
            node["averageScore"] = round(sum(scores) / len(scores), 1) if scores else None
            return node

        return build_node(root)

    def list_key_results(self, user_id: str, objective_id: str) -> list[dict[str, Any]]:
        oid = _parse_object_id(objective_id)
        if oid is None:
            return []
        db = get_db()
        cursor = db.key_results.find({"objectiveId": oid})
        return [_serialize_doc(d) for d in cursor]

    def get_key_result(self, user_id: str, key_result_id: str) -> dict[str, Any] | None:
        kid = _parse_object_id(key_result_id)
        if kid is None:
            return None
        db = get_db()
        doc = db.key_results.find_one({"_id": kid})
        return _serialize_doc(doc) if doc else None

    def create_key_result(self, user_id: str, data: dict[str, Any]) -> dict[str, Any]:
        oid = _parse_object_id(data["objectiveId"])
        if oid is None:
            raise ValueError("Invalid objectiveId")
        db = get_db()
        now = _now()
        doc = {
            "objectiveId": oid,
            "title": data["title"],
            "target": data.get("target"),
            "currentValue": data.get("currentValue"),
            "unit": data.get("unit", ""),
            "score": data.get("score"),
            "targetScore": data.get("targetScore", 1.0),
            "ownerId": data.get("ownerId", user_id),
            "notes": data.get("notes", []),
            "createdAt": now,
            "lastUpdatedAt": now,
        }
        result = db.key_results.insert_one(doc)
        doc["_id"] = result.inserted_id
        return _serialize_doc(doc)

    def update_key_result(self, user_id: str, key_result_id: str, data: dict[str, Any]) -> dict[str, Any] | None:
        kid = _parse_object_id(key_result_id)
        if kid is None:
            return None
        db = get_db()
        existing = db.key_results.find_one({"_id": kid})
        if not existing:
            return None
        now = _now()
        update: dict[str, Any] = {"lastUpdatedAt": now}
        for key in ("title", "target", "currentValue", "unit", "score", "targetScore", "ownerId", "notes"):
            if key in data:
                update[key] = data[key]
        db.key_results.update_one({"_id": kid}, {"$set": update})
        updated = db.key_results.find_one({"_id": kid})
        return _serialize_doc(updated) if updated else None

    def delete_key_result(self, user_id: str, key_result_id: str) -> bool:
        kid = _parse_object_id(key_result_id)
        if kid is None:
            return False
        db = get_db()
        res = db.key_results.delete_one({"_id": kid})
        return res.deleted_count > 0

