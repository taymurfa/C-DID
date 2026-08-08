"""google email tokens and notification state

Revision ID: 0002_google_email_notif
Revises: 0001_init_org_hierarchy_okrs
Create Date: 2026-03-30

Note: revision id must fit alembic_version.version_num (VARCHAR(32)).

"""

from alembic import op
import sqlalchemy as sa


revision = "0002_google_email_notif"
down_revision = "0001_init_org_hierarchy_okrs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "google_email_tokens",
        sa.Column("user_id", sa.Text(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("refresh_token_enc", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "notification_state",
        sa.Column("key", sa.Text(), primary_key=True),
        sa.Column("user_id", sa.Text(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("last_sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("notification_state")
    op.drop_table("google_email_tokens")

