"""workspace install prompt placements

Revision ID: 0012_install_prompt
Revises: 0011_booking_links
"""

import sqlalchemy as sa
from alembic import op

revision = "0012_install_prompt"
down_revision = "0011_booking_links"
branch_labels = None
depends_on = None


def upgrade():
    inspector = sa.inspect(op.get_bind())
    columns = {column["name"] for column in inspector.get_columns("organizations")}
    if "install_prompt" not in columns:
        op.add_column("organizations", sa.Column("install_prompt", sa.JSON(), nullable=True))


def downgrade():
    inspector = sa.inspect(op.get_bind())
    columns = {column["name"] for column in inspector.get_columns("organizations")}
    if "install_prompt" in columns:
        op.drop_column("organizations", "install_prompt")
