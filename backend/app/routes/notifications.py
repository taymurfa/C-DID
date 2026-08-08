from __future__ import annotations

from flask import Blueprint, jsonify, request

from app.routes.auth_backend import require_admin
from app.jobs.notifications import run_weekly_okr_update_reminders


bp = Blueprint("notifications", __name__)


@bp.route("/notifications/run-reminders", methods=["POST"])
@require_admin
def run_reminders(user_id: str):
    body = request.get_json() or {}
    dry_run = bool(body.get("dryRun", False))
    try:
        result = run_weekly_okr_update_reminders(dry_run=dry_run)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

