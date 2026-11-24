"""system notification policy

Revision ID: 0014_system_notifications
Revises: 0013_app_notices
"""

import sqlalchemy as sa
from alembic import op

revision = "0014_system_notifications"
down_revision = "0013_app_notices"
branch_labels = None
depends_on = None


def upgrade():
    inspector = sa.inspect(op.get_bind())
    if "organizations" not in inspector.get_table_names():
        return
    columns = {column["name"] for column in inspector.get_columns("organizations")}
    if "system_notifications" not in columns:
        op.add_column("organizations", sa.Column("system_notifications", sa.JSON(), nullable=True))


def downgrade():
    inspector = sa.inspect(op.get_bind())
    if "organizations" not in inspector.get_table_names():
        return
    columns = {column["name"] for column in inspector.get_columns("organizations")}
    if "system_notifications" in columns:
        op.drop_column("organizations", "system_notifications")
