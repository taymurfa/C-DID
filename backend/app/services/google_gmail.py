from __future__ import annotations

import base64
from email.message import EmailMessage
from typing import Optional

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

from app.db.postgres import pg_session
from app.models_sql.integrations import GoogleEmailToken
from app.services.token_crypto import decrypt_token


GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send"


def _get_refresh_token(user_id: str) -> Optional[str]:
    with pg_session() as s:
        row = s.get(GoogleEmailToken, user_id)
        if not row:
            return None
        return decrypt_token(row.refresh_token_enc)


def send_gmail(
    *,
    user_id: str,
    to_email: str,
    subject: str,
    body_text: str,
    from_email: Optional[str] = None,
) -> str:
    """
    Send an email via Gmail API on behalf of user_id (OAuth refresh token stored in Postgres).
    Returns Gmail message id.
    """
    refresh_token = _get_refresh_token(user_id)
    if not refresh_token:
        raise ValueError("Google email is not connected for this user")

    creds = Credentials(
        token=None,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=None,
        client_secret=None,
        scopes=[GMAIL_SEND_SCOPE],
    )
    # client_id/secret are needed for refresh; we set them via with_subject below
    # (we inject into creds using private fields for simplicity).
    import os

    client_id = (os.getenv("GOOGLE_CLIENT_ID") or "").strip().strip("\"'").strip()
    client_secret = (os.getenv("GOOGLE_CLIENT_SECRET") or "").strip().strip("\"'").strip()
    if not client_id or not client_secret:
        raise ValueError("GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET not configured")
    creds._client_id = client_id  # type: ignore[attr-defined]
    creds._client_secret = client_secret  # type: ignore[attr-defined]

    message = EmailMessage()
    message["To"] = to_email
    message["Subject"] = subject
    if from_email:
        message["From"] = from_email
    message.set_content(body_text)

    encoded = base64.urlsafe_b64encode(message.as_bytes()).decode("utf-8")
    service = build("gmail", "v1", credentials=creds, cache_discovery=False)
    sent = service.users().messages().send(userId="me", body={"raw": encoded}).execute()
    return sent.get("id") or ""

