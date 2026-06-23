"""allow_spice_level_zero

Revision ID: a2b3c4d5e6f7
Revises: 1b9727068322
Create Date: 2026-06-23 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "a2b3c4d5e6f7"
down_revision: Union[str, Sequence[str], None] = "1b9727068322"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Allow spice_level to be 0 instead of minimum 1."""
    op.drop_constraint("ck_recipes_recipes_spice_level_check", "recipes", type_="check")
    op.create_check_constraint(
        "check_recipe_spice_level",
        "recipes",
        "spice_level >= 0 AND spice_level <= 5",
    )


def downgrade() -> None:
    """Revert spice_level minimum back to 1."""
    op.drop_constraint("check_recipe_spice_level", "recipes", type_="check")
    op.create_check_constraint(
        "ck_recipes_recipes_spice_level_check",
        "recipes",
        "spice_level >= 1 AND spice_level <= 5",
    )
