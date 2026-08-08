"""Email delivery for Agent 3.

Two modes (config.SEND_MODE):
  • "mock" — log the email, send nothing (default; the POC guardrail).
  • "real" — actually send via SMTP (Gmail). Requires SMTP_PASSWORD = a Gmail *App Password*
             (Google account → Security → 2-Step Verification → App passwords). Your normal
             login password will NOT work.

`deliver()` raises on failure so the caller can release the email for retry.
"""
from __future__ import annotations

import smtplib
from email.message import EmailMessage

from . import config


def is_real() -> bool:
    return config.SEND_MODE == "real"


def deliver(to_email: str, subject: str, body: str) -> str:
    """Send one email. Returns the mode actually used ('real'|'mock'). Raises on real-send failure."""
    if not is_real():
        print(f"[mailer:mock] would send → {to_email} | {subject!r}", flush=True)
        return "mock"

    if not to_email:
        raise ValueError("no recipient address on this email")
    if not config.SMTP_PASSWORD:
        raise RuntimeError("SEND_MODE=real but SMTP_PASSWORD is empty (set a Gmail App Password)")

    msg = EmailMessage()
    msg["From"] = f"{config.SENDER_NAME} <{config.SENDER_EMAIL}>"
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(body)

    with smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT, timeout=20) as smtp:
        smtp.starttls()
        smtp.login(config.SMTP_USER, config.SMTP_PASSWORD)
        smtp.send_message(msg)
    print(f"[mailer:real] sent → {to_email} | {subject!r}", flush=True)
    return "real"
