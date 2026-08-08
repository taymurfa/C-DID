from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.db.postgres import pg_session
from app.models_sql import Membership, NotificationState, User
from app.services.google_gmail import send_gmail


REMINDER_KEY = "okr_update_reminder_weekly"


def _utcnow():
    return datetime.now(timezone.utc)


def run_weekly_okr_update_reminders(*, dry_run: bool = False, min_interval_days: int = 7) -> dict:
    """
    Send OKR update reminder emails to active members who have connected Google email.

    This is intended to be triggered by a scheduler (AWS EventBridge -> ECS task/Lambda),
    but can also be invoked manually for testing.
    """
    sent = 0
    skipped = 0
    errors = 0

    cutoff = _utcnow() - timedelta(days=min_interval_days)

    with pg_session() as s:
        memberships = (
            s.execute(select(Membership).where(Membership.active.is_(True)))
            .scalars()
            .all()
        )
        user_ids = sorted({m.user_id for m in memberships})
        users = s.execute(select(User).where(User.id.in_(user_ids))).scalars().all()
        users_by_id = {u.id: u for u in users}

        for uid in user_ids:
            u = users_by_id.get(uid)
            if not u or not u.email:
                skipped += 1
                continue

            state = s.get(NotificationState, {"key": REMINDER_KEY, "user_id": uid})
            if state and state.last_sent_at and state.last_sent_at.replace(tzinfo=timezone.utc) > cutoff:
                skipped += 1
                continue

            subject = "Reminder: please update your OKRs"
            body = (
                "Hi there,\n\n"
                "This is a reminder to review and update your OKRs for the week.\n"
                "Keeping progress up to date helps leadership roll-ups and cross-team alignment.\n\n"
                "Thanks,\n"
                "OKR Assistant\n"
            )

            try:
                if not dry_run:
                    send_gmail(user_id=uid, to_email=u.email, subject=subject, body_text=body)
                now = _utcnow()
                if state is None:
                    state = NotificationState(key=REMINDER_KEY, user_id=uid, last_sent_at=now, updated_at=now)
                else:
                    state.last_sent_at = now
                    state.updated_at = now
                s.add(state)
                sent += 1
            except Exception:
                errors += 1

    return {"sent": sent, "skipped": skipped, "errors": errors, "dryRun": dry_run}

