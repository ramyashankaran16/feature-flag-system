"""initial schema: users, roles, feature_flags, environments, feature_rollouts,
user_assignments, audit_logs

Revision ID: 0001_initial
Revises:
Create Date: 2026-09-25
"""
import sqlalchemy as sa
from alembic import op

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None

MYSQL = {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"}


def upgrade() -> None:
    op.create_table(
        "roles",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(50), nullable=False),
        sa.Column("description", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        **MYSQL,
    )
    op.create_index("ix_roles_name", "roles", ["name"], unique=True)

    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("username", sa.String(50), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(100), nullable=True),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("role_id", sa.Integer(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("last_login_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["role_id"], ["roles.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        **MYSQL,
    )
    op.create_index("ix_users_username", "users", ["username"], unique=True)
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_index("ix_users_role_id", "users", ["role_id"])

    op.create_table(
        "environments",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(50), nullable=False),
        sa.Column("key", sa.String(50), nullable=False),
        sa.Column("description", sa.String(255), nullable=True),
        sa.Column("api_key", sa.String(64), nullable=False),
        sa.Column("is_protected", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
        **MYSQL,
    )
    op.create_index("ix_environments_key", "environments", ["key"], unique=True)
    op.create_index("ix_environments_api_key", "environments", ["api_key"], unique=True)

    op.create_table(
        "feature_flags",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("key", sa.String(100), nullable=False),
        sa.Column("name", sa.String(150), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_archived", sa.Boolean(), nullable=False),
        sa.Column("created_by_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        **MYSQL,
    )
    op.create_index("ix_feature_flags_key", "feature_flags", ["key"], unique=True)
    op.create_index("ix_feature_flags_is_archived", "feature_flags", ["is_archived"])
    op.create_index("ix_feature_flags_created_by_id", "feature_flags", ["created_by_id"])

    op.create_table(
        "feature_rollouts",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("flag_id", sa.Integer(), nullable=False),
        sa.Column("environment_id", sa.Integer(), nullable=False),
        sa.Column("is_enabled", sa.Boolean(), nullable=False),
        sa.Column("rollout_percentage", sa.Integer(), nullable=False),
        sa.Column("scheduled_enable_at", sa.DateTime(), nullable=True),
        sa.Column("scheduled_disable_at", sa.DateTime(), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("updated_by_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.CheckConstraint("rollout_percentage >= 0 AND rollout_percentage <= 100", name="ck_rollout_percentage"),
        sa.ForeignKeyConstraint(["flag_id"], ["feature_flags.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["environment_id"], ["environments.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["updated_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("flag_id", "environment_id", name="uq_rollout_flag_env"),
        **MYSQL,
    )
    op.create_index("ix_feature_rollouts_flag_id", "feature_rollouts", ["flag_id"])
    op.create_index("ix_feature_rollouts_environment_id", "feature_rollouts", ["environment_id"])
    op.create_index("ix_feature_rollouts_scheduled_enable_at", "feature_rollouts", ["scheduled_enable_at"])
    op.create_index("ix_feature_rollouts_scheduled_disable_at", "feature_rollouts", ["scheduled_disable_at"])

    op.create_table(
        "user_assignments",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("flag_id", sa.Integer(), nullable=False),
        sa.Column("environment_id", sa.Integer(), nullable=False),
        sa.Column("user_identifier", sa.String(255), nullable=False),
        sa.Column("is_enabled", sa.Boolean(), nullable=False),
        sa.Column("note", sa.String(255), nullable=True),
        sa.Column("created_by_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["flag_id"], ["feature_flags.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["environment_id"], ["environments.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("flag_id", "environment_id", "user_identifier", name="uq_assignment_flag_env_user"),
        **MYSQL,
    )
    op.create_index("ix_user_assignments_flag_id", "user_assignments", ["flag_id"])
    op.create_index("ix_user_assignments_environment_id", "user_assignments", ["environment_id"])
    op.create_index("ix_user_assignments_user_identifier", "user_assignments", ["user_identifier"])

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("username", sa.String(50), nullable=True),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("entity_type", sa.String(50), nullable=False),
        sa.Column("entity_id", sa.Integer(), nullable=True),
        sa.Column("flag_id", sa.Integer(), nullable=True),
        sa.Column("environment_id", sa.Integer(), nullable=True),
        sa.Column("old_value", sa.JSON(), nullable=True),
        sa.Column("new_value", sa.JSON(), nullable=True),
        sa.Column("description", sa.String(500), nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("user_agent", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        **MYSQL,
    )
    for col in ("user_id", "action", "entity_type", "entity_id", "flag_id", "environment_id", "created_at"):
        op.create_index(f"ix_audit_logs_{col}", "audit_logs", [col])


def downgrade() -> None:
    op.drop_table("audit_logs")
    op.drop_table("user_assignments")
    op.drop_table("feature_rollouts")
    op.drop_table("feature_flags")
    op.drop_table("environments")
    op.drop_table("users")
    op.drop_table("roles")
