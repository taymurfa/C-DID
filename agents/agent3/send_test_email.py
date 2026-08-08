"""Send one SMTP test email via Agent 3 mailer.

Usage (from repo root):
  python -m agents.agent3.send_test_email
  python -m agents.agent3.send_test_email you@example.com

Requires SEND_MODE=real and SMTP_PASSWORD (Gmail App Password) in .env.
"""
from __future__ import annotations

import os
import sys

from . import config, mailer


def main() -> int:
    to = (
        (sys.argv[1] if len(sys.argv) > 1 else "").strip()
        or os.getenv("TEST_TO_EMAIL", "").strip()
        or "kirill.cheldishkin2105@gmail.com"
    )
    print("SMTP test (agent3)")
    print(f"  SEND_MODE={config.SEND_MODE}")
    print(f"  SMTP_HOST={config.SMTP_HOST}:{config.SMTP_PORT}")
    print(f"  SMTP_USER={config.SMTP_USER}")
    print(f"  password_set={bool(config.SMTP_PASSWORD)}")
    print(f"  to={to}")

    if config.SEND_MODE != "real":
        print("FAIL: Set SEND_MODE=real in .env to actually send.", file=sys.stderr)
        return 1
    if not config.SMTP_PASSWORD:
        print(
            "FAIL: Set SMTP_PASSWORD to a Gmail App Password "
            "(https://myaccount.google.com/apppasswords).",
            file=sys.stderr,
        )
        return 1

    mode = mailer.deliver(
        to,
        "SMTP test – Speaker Signal Agent 3",
        "This is a test email from Agent 3. SMTP is working.",
    )
    print(f"OK: sent ({mode}) → {to}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
