"""enforce username and optional email across database dialects

Revision ID: 0008_sqlite_optional_email
Revises: 0007_users_dashboards_notifications
"""

import sqlalchemy as sa
from alembic import op

revision = "0008_sqlite_optional_email"
down_revision = "0007_users_dashboards_notifications"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("users") as batch:
        batch.alter_column("username", existing_type=sa.String(80), nullable=False)
        batch.alter_column("email", existing_type=sa.String(254), nullable=True)


def downgrade():
    connection = op.get_bind()
    connection.execute(sa.text("UPDATE users SET email = username || '@migration.invalid' WHERE email IS NULL"))
    with op.batch_alter_table("users") as batch:
        batch.alter_column("email", existing_type=sa.String(254), nullable=False)
        batch.alter_column("username", existing_type=sa.String(80), nullable=True)
