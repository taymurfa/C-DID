"""Vehicle inventory search API — Tundra-focused multi-source scraper."""

from __future__ import annotations

from flask import Blueprint, jsonify, request

from app.routes.auth_backend import require_auth
from app.vehicle.repository import get_saved_search, list_saved_searches, save_search
from app.vehicle.service import get_cached_listings, get_source_layout, run_vehicle_search

bp = Blueprint("vehicle_search", __name__)


@bp.route("/vehicle/sources", methods=["GET"])
def list_sources():
    """Source registry grouped by mode (api / browser / aggregator / dealer / disabled)."""
    return jsonify(get_source_layout()), 200


@bp.route("/vehicle/criteria/default", methods=["GET"])
def default_criteria():
    layout = get_source_layout()
    return jsonify({"criteria": layout["defaultCriteria"], "prioritySources": layout["prioritySources"]}), 200


@bp.route("/vehicle/search", methods=["POST"])
@require_auth
def search_vehicles(user_id):
    """
    Run multi-source search: dealer sites + aggregators + VIN dedupe + scoring.

    Body (optional):
    {
      "sourceIds": ["toyota_certified", "dealer_website", "autotempest"],
      "criteria": { "yearMin": 2012, "maxPrice": 45000, ... },
      "savedSearchId": "...",
      "persist": true
    }
    """
    data = request.get_json(silent=True) or {}
    source_ids = data.get("sourceIds")
    criteria = data.get("criteria") or {}
    search_id = data.get("savedSearchId")
    persist = data.get("persist", True)

    if search_id:
        saved = get_saved_search(str(search_id), user_id)
        if not saved:
            return jsonify({"error": "Saved search not found"}), 404
        if not source_ids:
            source_ids = saved.get("sourceIds") or None
        if not criteria:
            criteria = saved.get("criteria") or {}

    try:
        result = run_vehicle_search(
            source_ids=source_ids,
            criteria=criteria,
            search_id=str(search_id) if search_id else None,
            persist=bool(persist),
        )
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@bp.route("/vehicle/listings", methods=["GET"])
@require_auth
def list_vehicle_listings(user_id):
    search_id = request.args.get("savedSearchId")
    min_score = request.args.get("minScore", type=int)
    limit = request.args.get("limit", default=100, type=int)
    rows = get_cached_listings(search_id=search_id, min_score=min_score, limit=min(limit, 200))
    return jsonify({"listings": rows, "count": len(rows)}), 200


@bp.route("/vehicle/saved-searches", methods=["GET"])
@require_auth
def get_saved_searches(user_id):
    return jsonify({"searches": list_saved_searches(user_id)}), 200


@bp.route("/vehicle/saved-searches", methods=["POST"])
@require_auth
def create_saved_search(user_id):
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "Tundra search").strip()
    criteria = data.get("criteria") or {}
    source_ids = data.get("sourceIds")
    sid = save_search(user_id, name, criteria, source_ids)
    return jsonify({"id": sid, "name": name}), 201


@bp.route("/vehicle/saved-searches/<search_id>/alerts", methods=["GET"])
@require_auth
def saved_search_alerts(search_id, user_id):
    """
    Re-run saved search and return new high-score / price-drop alerts (§9).
    """
    saved = get_saved_search(search_id, user_id)
    if not saved:
        return jsonify({"error": "Saved search not found"}), 404
    result = run_vehicle_search(
        source_ids=saved.get("sourceIds") or None,
        criteria=saved.get("criteria") or {},
        search_id=search_id,
        persist=True,
    )
    return jsonify(
        {
            "searchId": search_id,
            "name": saved.get("name"),
            "alerts": result.get("alerts") or [],
            "newListingsCount": result.get("dedupedCount", 0),
            "ranAt": result.get("ranAt"),
        }
    ), 200
