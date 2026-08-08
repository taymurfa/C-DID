"""
Grant MongoDB users.role=admin by email (case-insensitive match on users.email).

Requires MONGODB_URI (and optional MONGODB_DB_NAME). Run from repo backend/:

  python grant_admin_by_email.py user@example.com other@example.com

If no document exists for an email, the user must sign in once so /auth/me creates users._id.
Alternatively set ``APP_ADMIN_EMAILS`` in the backend env so that email becomes admin on first login.
"""
from __future__ import annotations

import re
import sys
from datetime import datetime, timezone

from dotenv import load_dotenv

load_dotenv()

from app.db.mongodb import init_db, get_db  # noqa: E402


def grant_admin_emails(emails: list[str]) -> int:
    init_db()
    db = get_db()
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    exit_code = 0
    for raw in emails:
        email = raw.strip()
        if not email:
            continue
        doc = db.users.find_one({"email": {"$regex": f"^{re.escape(email)}$", "$options": "i"}})
        if not doc:
            print(
                f"[skip] No user with email {email!r}. Sign in once, then re-run, "
                "or set APP_ADMIN_USER_IDS to the Auth0 sub from /profile or JWT."
            )
            exit_code = 1
            continue
        r = db.users.update_one(
            {"_id": doc["_id"]},
            {"$set": {"role": "admin", "okrCreateDisabled": False, "updatedAt": now}},
        )
        print(
            f"[ok] _id={doc['_id']} email={doc.get('email')!r} -> admin "
            f"(modified={r.modified_count})"
        )
    return exit_code


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if a.strip()]
    if not args:
        print("Usage: python grant_admin_by_email.py email@domain.com [more@...]", file=sys.stderr)
        sys.exit(2)
    sys.exit(grant_admin_emails(args))
