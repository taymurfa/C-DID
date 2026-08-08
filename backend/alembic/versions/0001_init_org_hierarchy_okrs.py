"""init org hierarchy and okrs

Revision ID: 0001_init_org_hierarchy_okrs
Revises: 
Create Date: 2026-03-30

"""

from alembic import op
import sqlalchemy as sa


revision = "0001_init_org_hierarchy_okrs"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "organizations",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("slug", sa.String(length=100), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_organizations_slug", "organizations", ["slug"], unique=True)

    op.create_table(
        "departments",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("org_id", sa.dialects.postgresql.UUID(as_uuid=False), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("canonical_name", sa.String(length=120), nullable=False),
        sa.Column("display_name", sa.String(length=200), nullable=False),
        sa.Column("parent_department_id", sa.dialects.postgresql.UUID(as_uuid=False), sa.ForeignKey("departments.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("org_id", "canonical_name", name="uq_department_canonical_per_org"),
    )
    op.create_index("ix_departments_org_id", "departments", ["org_id"], unique=False)
    op.create_index("ix_departments_parent_department_id", "departments", ["parent_department_id"], unique=False)

    op.create_table(
        "teams",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("org_id", sa.dialects.postgresql.UUID(as_uuid=False), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("department_id", sa.dialects.postgresql.UUID(as_uuid=False), sa.ForeignKey("departments.id", ondelete="SET NULL"), nullable=True),
        sa.Column("canonical_name", sa.String(length=120), nullable=False),
        sa.Column("display_name", sa.String(length=200), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("org_id", "canonical_name", name="uq_team_canonical_per_org"),
    )
    op.create_index("ix_teams_org_id", "teams", ["org_id"], unique=False)
    op.create_index("ix_teams_department_id", "teams", ["department_id"], unique=False)

    op.create_table(
        "users",
        sa.Column("id", sa.String(length=255), primary_key=True),
        sa.Column("email", sa.String(length=320), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=False)

    op.create_table(
        "memberships",
        sa.Column("user_id", sa.String(length=255), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("org_id", sa.dialects.postgresql.UUID(as_uuid=False), sa.ForeignKey("organizations.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("department_id", sa.dialects.postgresql.UUID(as_uuid=False), sa.ForeignKey("departments.id", ondelete="SET NULL"), nullable=True),
        sa.Column("team_id", sa.dialects.postgresql.UUID(as_uuid=False), sa.ForeignKey("teams.id", ondelete="SET NULL"), nullable=True),
        sa.Column("role", sa.String(length=50), nullable=False, server_default="individual"),
        sa.Column("title", sa.String(length=120), nullable=True),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("user_id", "org_id", name="uq_membership_user_org"),
    )
    op.create_index("ix_memberships_department_id", "memberships", ["department_id"], unique=False)
    op.create_index("ix_memberships_team_id", "memberships", ["team_id"], unique=False)
    op.create_index("ix_memberships_role", "memberships", ["role"], unique=False)
    op.create_index("ix_memberships_active", "memberships", ["active"], unique=False)

    op.create_table(
        "objectives",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("org_id", sa.dialects.postgresql.UUID(as_uuid=False), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("department_id", sa.dialects.postgresql.UUID(as_uuid=False), sa.ForeignKey("departments.id", ondelete="SET NULL"), nullable=True),
        sa.Column("team_id", sa.dialects.postgresql.UUID(as_uuid=False), sa.ForeignKey("teams.id", ondelete="SET NULL"), nullable=True),
        sa.Column("owner_user_id", sa.String(length=255), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("level", sa.String(length=30), nullable=False, server_default="strategic"),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="draft"),
        sa.Column("timeline", sa.String(length=30), nullable=False, server_default="annual"),
        sa.Column("fiscal_year", sa.Integer(), nullable=False),
        sa.Column("quarter", sa.Integer(), nullable=True),
        sa.Column("division", sa.String(length=120), nullable=True),
        sa.Column("parent_objective_id", sa.dialects.postgresql.UUID(as_uuid=False), sa.ForeignKey("objectives.id", ondelete="SET NULL"), nullable=True),
        sa.Column("next_review_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("latest_update_summary", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_objectives_org_id", "objectives", ["org_id"], unique=False)
    op.create_index("ix_objectives_department_id", "objectives", ["department_id"], unique=False)
    op.create_index("ix_objectives_team_id", "objectives", ["team_id"], unique=False)
    op.create_index("ix_objectives_owner_user_id", "objectives", ["owner_user_id"], unique=False)
    op.create_index("ix_objectives_level", "objectives", ["level"], unique=False)
    op.create_index("ix_objectives_status", "objectives", ["status"], unique=False)
    op.create_index("ix_objectives_timeline", "objectives", ["timeline"], unique=False)
    op.create_index("ix_objectives_fiscal_year", "objectives", ["fiscal_year"], unique=False)
    op.create_index("ix_objectives_quarter", "objectives", ["quarter"], unique=False)
    op.create_index("ix_objectives_division", "objectives", ["division"], unique=False)
    op.create_index("ix_objectives_parent_objective_id", "objectives", ["parent_objective_id"], unique=False)
    op.create_index("ix_objectives_created_at", "objectives", ["created_at"], unique=False)
    op.create_index("ix_objectives_updated_at", "objectives", ["updated_at"], unique=False)
    op.create_index("ix_objectives_org_level_fy", "objectives", ["org_id", "level", "fiscal_year"], unique=False)

    op.create_table(
        "key_results",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("objective_id", sa.dialects.postgresql.UUID(as_uuid=False), sa.ForeignKey("objectives.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("target", sa.String(length=200), nullable=True),
        sa.Column("current_value", sa.String(length=200), nullable=True),
        sa.Column("unit", sa.String(length=50), nullable=False, server_default=""),
        sa.Column("score", sa.Float(), nullable=True),
        sa.Column("target_score", sa.Float(), nullable=False, server_default="1.0"),
        sa.Column("owner_user_id", sa.String(length=255), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_key_results_objective_id", "key_results", ["objective_id"], unique=False)
    op.create_index("ix_key_results_owner_user_id", "key_results", ["owner_user_id"], unique=False)
    op.create_index("ix_key_results_last_updated_at", "key_results", ["last_updated_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_key_results_last_updated_at", table_name="key_results")
    op.drop_index("ix_key_results_owner_user_id", table_name="key_results")
    op.drop_index("ix_key_results_objective_id", table_name="key_results")
    op.drop_table("key_results")

    op.drop_index("ix_objectives_org_level_fy", table_name="objectives")
    op.drop_index("ix_objectives_updated_at", table_name="objectives")
    op.drop_index("ix_objectives_created_at", table_name="objectives")
    op.drop_index("ix_objectives_parent_objective_id", table_name="objectives")
    op.drop_index("ix_objectives_division", table_name="objectives")
    op.drop_index("ix_objectives_quarter", table_name="objectives")
    op.drop_index("ix_objectives_fiscal_year", table_name="objectives")
    op.drop_index("ix_objectives_timeline", table_name="objectives")
    op.drop_index("ix_objectives_status", table_name="objectives")
    op.drop_index("ix_objectives_level", table_name="objectives")
    op.drop_index("ix_objectives_owner_user_id", table_name="objectives")
    op.drop_index("ix_objectives_team_id", table_name="objectives")
    op.drop_index("ix_objectives_department_id", table_name="objectives")
    op.drop_index("ix_objectives_org_id", table_name="objectives")
    op.drop_table("objectives")

    op.drop_index("ix_memberships_active", table_name="memberships")
    op.drop_index("ix_memberships_role", table_name="memberships")
    op.drop_index("ix_memberships_team_id", table_name="memberships")
    op.drop_index("ix_memberships_department_id", table_name="memberships")
    op.drop_table("memberships")

    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")

    op.drop_index("ix_teams_department_id", table_name="teams")
    op.drop_index("ix_teams_org_id", table_name="teams")
    op.drop_table("teams")

    op.drop_index("ix_departments_parent_department_id", table_name="departments")
    op.drop_index("ix_departments_org_id", table_name="departments")
    op.drop_table("departments")

    op.drop_index("ix_organizations_slug", table_name="organizations")
    op.drop_table("organizations")

