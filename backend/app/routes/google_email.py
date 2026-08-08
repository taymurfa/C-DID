from __future__ import annotations

import logging
import os
import urllib.parse
from datetime import datetime

from flask import Blueprint, jsonify, redirect, request

from app.db.postgres import pg_session
from app.models_sql.integrations import GoogleEmailToken
from app.routes.auth_backend import require_auth
from app.services.token_crypto import encrypt_token


logger = logging.getLogger(__name__)

bp = Blueprint("google_email", __name__)

GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send"


def _google_cfg():
    def _s(v):
        return (v or "").strip().strip("\"'").strip() if v else ""

    client_id = _s(os.getenv("GOOGLE_CLIENT_ID"))
    client_secret = _s(os.getenv("GOOGLE_CLIENT_SECRET"))
    redirect_uri = _s(os.getenv("GOOGLE_EMAIL_REDIRECT_URI") or os.getenv("GOOGLE_REDIRECT_URI"))
    if not client_id or not client_secret or not redirect_uri:
        return None
    return {"client_id": client_id, "client_secret": client_secret, "redirect_uri": redirect_uri}


def _redirect_frontend(status: str, reason: str = ""):
    frontend = (os.getenv("FRONTEND_URL") or "http://localhost:3000").rstrip("/")
    base = f"{frontend}/integrations?google_email={urllib.parse.quote(status)}"
    if reason and os.getenv("FLASK_ENV") == "development":
        base += "&reason=" + urllib.parse.quote(reason[:200])
    return redirect(base)


@bp.route("/integrations/google-email/auth-url", methods=["GET"])
@require_auth
def google_email_auth_url(user_id: str):
    cfg = _google_cfg()
    if not cfg:
        return jsonify({"error": "Google email integration not configured"}), 503
    base = "https://accounts.google.com/o/oauth2/v2/auth"
    params = {
        "client_id": cfg["client_id"],
        "redirect_uri": cfg["redirect_uri"],
        "response_type": "code",
        "scope": GMAIL_SEND_SCOPE,
        "access_type": "offline",
        "prompt": "consent",
        "include_granted_scopes": "true",
        "state": user_id,
    }
    return jsonify({"url": f"{base}?{urllib.parse.urlencode(params)}"}), 200


@bp.route("/integrations/google-email/callback", methods=["GET"])
def google_email_callback():
    code = request.args.get("code")
    state = request.args.get("state")  # user_id
    error = request.args.get("error")
    error_description = request.args.get("error_description", "")

    if error:
        logger.warning("Google email OAuth error: %s %s", error, error_description)
        return _redirect_frontend("error", error_description or error)
    if not code or not state:
        return _redirect_frontend("error", "missing_code_or_state")

    cfg = _google_cfg()
    if not cfg:
        return _redirect_frontend("error", "google_not_configured")

    try:
        from google_auth_oauthlib.flow import Flow

        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": cfg["client_id"],
                    "client_secret": cfg["client_secret"],
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [cfg["redirect_uri"]],
                }
            },
            scopes=[GMAIL_SEND_SCOPE],
        )
        flow.redirect_uri = cfg["redirect_uri"]
        flow.fetch_token(code=code)
        credentials = flow.credentials
        refresh_token = credentials.refresh_token
        if not refresh_token:
            return _redirect_frontend("error", "no_refresh_token")

        refresh_token_enc = encrypt_token(refresh_token)
        now = datetime.utcnow()
        with pg_session() as s:
            row = s.get(GoogleEmailToken, state)
            if row is None:
                row = GoogleEmailToken(user_id=state, refresh_token_enc=refresh_token_enc, created_at=now, updated_at=now)
                s.add(row)
            else:
                row.refresh_token_enc = refresh_token_enc
                row.updated_at = now
                s.add(row)

        return _redirect_frontend("connected")
    except Exception as e:
        logger.exception("Google email OAuth callback failed: %s", e)
        return _redirect_frontend("error", str(e))

