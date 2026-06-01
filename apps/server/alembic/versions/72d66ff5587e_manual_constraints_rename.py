"""centroid_relationship_and_index_naming_conventions

Revision ID: 72d66ff5587e
Revises: 251128711576
Create Date: 2026-05-30 10:06:23.232129

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes
import pgvector.sqlalchemy.vector # type: ignore
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '72d66ff5587e'
down_revision: Union[str, Sequence[str], None] = '251128711576'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - Safely shifting to Explicit Naming Conventions."""
    
    # 1. Drop old implicit Foreign Key constraints
    op.drop_constraint('recipe_ingredients_category_id_fkey', 'recipe_ingredients', type_='foreignkey')
    op.drop_constraint('recipe_ingredients_recipe_id_fkey', 'recipe_ingredients', type_='foreignkey')
    op.drop_constraint('diet_tags_recipe_id_fkey', 'diet_tags', type_='foreignkey')

    # 2. Drop old implicit Check constraints
    op.drop_constraint('recipes_difficulty_check', 'recipes', type_='check')
    op.drop_constraint('recipes_spice_level_check', 'recipes', type_='check')

    # 3. Drop old implicit Primary Key constraints
    op.drop_constraint('ingredient_categories_pkey', 'ingredient_categories', type_='primary')
    op.drop_constraint('recipe_ingredients_pkey', 'recipe_ingredients', type_='primary')
    op.drop_constraint('recipes_pkey', 'recipes', type_='primary')
    op.drop_constraint('diet_tags_pkey', 'diet_tags', type_='primary')

    # =========================================================================
    # CREATE NEW STRUCTURES WITH YOUR DENSE CONVENTIONS MATCHING THE DICTIONARY
    # =========================================================================

    # 4. Create explicitly named Primary Keys
    op.create_primary_key('pk_ingredient_categories', 'ingredient_categories', ['id'])
    op.create_primary_key('pk_recipe_ingredients', 'recipe_ingredients', ['id'])
    op.create_primary_key('pk_recipes', 'recipes', ['id'])
    op.create_primary_key('pk_diet_tags', 'diet_tags', ['id'])

    # 5. Create explicitly named Check constraints
    op.create_check_constraint(
        'ck_recipes_recipes_difficulty_check', 
        'recipes', 
        "difficulty::text = ANY (ARRAY['easy'::text, 'medium'::text, 'hard'::text])"
    )
    op.create_check_constraint(
        'ck_recipes_recipes_spice_level_check', 
        'recipes', 
        'spice_level >= 1 AND spice_level <= 5'
    )

    # 6. Create explicitly named Foreign Keys
    op.create_foreign_key(
        'fk_recipe_ingredients_category_id_ingredient_categories',
        'recipe_ingredients', 'ingredient_categories',
        ['category_id'], ['id'],
        ondelete='SET NULL'
    )
    op.create_foreign_key(
        'fk_recipe_ingredients_recipe_id_recipes',
        'recipe_ingredients', 'recipes',
        ['recipe_id'], ['id'],
        ondelete='CASCADE'
    )
    op.create_foreign_key(
        'fk_diet_tags_recipe_id_recipes',
        'diet_tags', 'recipes',
        ['recipe_id'], ['id'],
        ondelete='CASCADE'
    )


def downgrade() -> None:
    """Downgrade schema - Reverting back to original implicit Postgres names."""
    
    # 1. Drop conventional Foreign Keys
    op.drop_constraint('fk_recipe_ingredients_category_id_ingredient_categories', 'recipe_ingredients', type_='foreignkey')
    op.drop_constraint('fk_recipe_ingredients_recipe_id_recipes', 'recipe_ingredients', type_='foreignkey')
    op.drop_constraint('fk_diet_tags_recipe_id_recipes', 'diet_tags', type_='foreignkey')

    # 2. Drop conventional Check constraints
    op.drop_constraint('ck_recipes_recipes_difficulty_check', 'recipes', type_='check')
    op.drop_constraint('ck_recipes_recipes_spice_level_check', 'recipes', type_='check')

    # 3. Drop conventional Primary Keys
    op.drop_constraint('pk_ingredient_categories', 'ingredient_categories', type_='primary')
    op.drop_constraint('pk_recipe_ingredients', 'recipe_ingredients', type_='primary')
    op.drop_constraint('pk_recipes', 'recipes', type_='primary')
    op.drop_constraint('pk_diet_tags', 'diet_tags', type_='primary')

    # 4. Re-create original implicit Primary Keys
    op.create_primary_key('ingredient_categories_pkey', 'ingredient_categories', ['id'])
    op.create_primary_key('recipe_ingredients_pkey', 'recipe_ingredients', ['id'])
    op.create_primary_key('recipes_pkey', 'recipes', ['id'])
    op.create_primary_key('diet_tags_pkey', 'diet_tags', ['id'])

    # 5. Re-create original implicit Check constraints
    op.create_check_constraint("recipes_difficulty_check", "recipes", "difficulty::text = ANY (ARRAY['easy'::text, 'medium'::text, 'hard'::text])")
    op.create_check_constraint('recipes_spice_level_check', 'recipes', 'spice_level >= 1 AND spice_level <= 5')

    # 6. Re-create original implicit Foreign Keys
    op.create_foreign_key('recipe_ingredients_category_id_fkey', 'recipe_ingredients', 'ingredient_categories', ['category_id'], ['id'], ondelete='SET NULL')
    op.create_foreign_key('recipe_ingredients_recipe_id_fkey', 'recipe_ingredients', 'recipes', ['recipe_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key('diet_tags_recipe_id_fkey', 'diet_tags', 'recipes', ['recipe_id'], ['id'], ondelete='CASCADE')