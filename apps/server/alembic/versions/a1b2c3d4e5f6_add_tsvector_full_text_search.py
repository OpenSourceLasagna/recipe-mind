"""add tsvector full text search

Revision ID: a1b2c3d4e5f6
Revises: 6574e342312b
Create Date: 2026-06-02 12:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import TSVECTOR


revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "6574e342312b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "recipes",
        sa.Column("search_vector", TSVECTOR, nullable=True),
    )

    op.execute(
        """
        CREATE OR REPLACE FUNCTION generate_recipe_search_vector(
            p_title TEXT,
            p_origin TEXT,
            p_difficulty TEXT,
            p_additional_information TEXT[],
            p_ingredient_names TEXT[]
        ) RETURNS tsvector AS $$
            SELECT
                setweight(to_tsvector('english', COALESCE(p_title, '')), 'A') ||
                setweight(to_tsvector('english', COALESCE(array_to_string(p_ingredient_names, ' '), '')), 'B') ||
                setweight(to_tsvector('english',
                    COALESCE(p_origin, '') || ' ' ||
                    COALESCE(p_difficulty, '') || ' ' ||
                    COALESCE(array_to_string(p_additional_information, ' '), '')
                ), 'C');
        $$ LANGUAGE SQL IMMUTABLE;
        """
    )

    op.execute(
        """
        CREATE OR REPLACE FUNCTION recipe_search_vector_trigger() RETURNS trigger AS $$
        BEGIN
            NEW.search_vector := generate_recipe_search_vector(
                NEW.title,
                NEW.origin,
                NEW.difficulty,
                NEW.additional_information,
                COALESCE(
                    (SELECT array_agg(ri.ingredient_name)
                     FROM recipe_ingredients ri
                     WHERE ri.recipe_id = NEW.id),
                    '{}'
                )
            );
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        """
    )

    op.execute(
        """
        CREATE OR REPLACE FUNCTION ingredient_search_vector_trigger() RETURNS trigger AS $$
        DECLARE
            target_recipe_id UUID;
        BEGIN
            IF TG_OP = 'DELETE' THEN
                target_recipe_id := OLD.recipe_id;
            ELSE
                target_recipe_id := NEW.recipe_id;
            END IF;

            UPDATE recipes
            SET search_vector = generate_recipe_search_vector(
                title, origin, difficulty, additional_information,
                COALESCE(
                    (SELECT array_agg(ri.ingredient_name)
                     FROM recipe_ingredients ri
                     WHERE ri.recipe_id = target_recipe_id),
                    '{}'
                )
            )
            WHERE id = target_recipe_id;

            IF TG_OP = 'DELETE' THEN
                RETURN OLD;
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        """
    )

    op.execute(
        """
        CREATE TRIGGER trg_recipes_search_vector
            BEFORE INSERT OR UPDATE ON recipes
            FOR EACH ROW
            EXECUTE FUNCTION recipe_search_vector_trigger();
        """
    )

    op.execute(
        """
        CREATE TRIGGER trg_ingredients_search_vector
            AFTER INSERT OR UPDATE OR DELETE ON recipe_ingredients
            FOR EACH ROW
            EXECUTE FUNCTION ingredient_search_vector_trigger();
        """
    )

    op.execute(
        """
        UPDATE recipes r
        SET search_vector = generate_recipe_search_vector(
            r.title, r.origin, r.difficulty, r.additional_information,
            COALESCE(
                (SELECT array_agg(ri.ingredient_name)
                 FROM recipe_ingredients ri
                 WHERE ri.recipe_id = r.id),
                '{}'
            )
        );
        """
    )

    op.create_index(
        "idx_recipes_search_vector",
        "recipes",
        ["search_vector"],
        postgresql_using="gin",
    )


def downgrade() -> None:
    op.drop_index("idx_recipes_search_vector", table_name="recipes")

    op.execute("DROP TRIGGER trg_ingredients_search_vector ON recipe_ingredients")
    op.execute("DROP TRIGGER trg_recipes_search_vector ON recipes")
    op.execute("DROP FUNCTION ingredient_search_vector_trigger()")
    op.execute("DROP FUNCTION recipe_search_vector_trigger()")
    op.execute(
        "DROP FUNCTION generate_recipe_search_vector(TEXT, TEXT, TEXT, TEXT[], TEXT[])"
    )

    op.drop_column("recipes", "search_vector")
