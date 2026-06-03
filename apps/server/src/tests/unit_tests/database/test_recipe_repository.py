from uuid import uuid4

from src.models.recipe import Recipe
from src.schemas.search import SearchFilters


def _compile_conditions(conditions):
    compiled = []
    for c in conditions:
        compiled.append(str(c.compile(compile_kwargs={"literal_binds": True})))
    return compiled


class TestRecipeRepository:
    async def test_create_adds_commits_and_refreshes(
        self, recipe_repo, mock_session, make_recipe
    ):
        recipe = make_recipe()

        result = await recipe_repo.create(recipe)

        mock_session.add.assert_called_once_with(recipe)
        mock_session.commit.assert_called_once()
        mock_session.refresh.assert_called_once_with(recipe)
        assert result == recipe

    async def test_get_by_id_returns_recipe(
        self, recipe_repo, mock_session, make_recipe, recipe_id
    ):
        expected = make_recipe()
        mock_session.get.return_value = expected

        result = await recipe_repo.get_by_id(recipe_id)

        mock_session.get.assert_called_once_with(Recipe, recipe_id)
        assert result == expected

    async def test_get_by_id_returns_none_when_not_found(
        self, recipe_repo, mock_session, recipe_id
    ):
        mock_session.get.return_value = None

        result = await recipe_repo.get_by_id(recipe_id)

        assert result is None

    async def test_create_with_minimal_recipe(self, recipe_repo, mock_session, user_id):
        recipe = Recipe(title="Minimal", user_id=user_id)
        mock_session.refresh.return_value = recipe

        result = await recipe_repo.create(recipe)

        mock_session.add.assert_called_once_with(recipe)
        assert result == recipe

    async def test_get_by_ids_returns_empty_for_empty_list(self, recipe_repo):
        result = await recipe_repo.get_by_ids([])

        assert result == []

    async def test_get_by_ids_queries_by_ids(self, recipe_repo, mock_session):
        uid1, uid2 = uuid4(), uuid4()
        mock_result = mock_session.exec.return_value
        mock_result.all.return_value = []

        await recipe_repo.get_by_ids([uid1, uid2])

        mock_session.exec.assert_called_once()

    def test_build_filter_conditions_default_visibility(self, recipe_repo):
        user_id = uuid4()
        filters = SearchFilters()

        conditions = recipe_repo._build_filter_conditions(user_id, filters)

        assert len(conditions) == 1
        sql = _compile_conditions(conditions)[0]
        assert "recipes.is_public" in sql
        assert "recipes.user_id" in sql

    def test_build_filter_conditions_with_difficulty(self, recipe_repo):
        user_id = uuid4()
        filters = SearchFilters(difficulty="easy")

        conditions = recipe_repo._build_filter_conditions(user_id, filters)

        sqls = _compile_conditions(conditions)
        assert any("recipes.difficulty" in s and "easy" in s for s in sqls)

    def test_build_filter_conditions_with_range_filters(self, recipe_repo):
        user_id = uuid4()
        filters = SearchFilters(
            spice_level_min=2,
            spice_level_max=4,
            duration_min=10,
            duration_max=60,
            servings_min=2,
            servings_max=8,
        )

        conditions = recipe_repo._build_filter_conditions(user_id, filters)

        sqls = _compile_conditions(conditions)
        assert any("recipes.spice_level >=" in s for s in sqls)
        assert any("recipes.spice_level <=" in s for s in sqls)
        assert any("recipes.duration_minutes >=" in s for s in sqls)
        assert any("recipes.duration_minutes <=" in s for s in sqls)
        assert any("recipes.servings >=" in s for s in sqls)
        assert any("recipes.servings <=" in s for s in sqls)

    def test_build_filter_conditions_with_origin(self, recipe_repo):
        user_id = uuid4()
        filters = SearchFilters(origin="Italian")

        conditions = recipe_repo._build_filter_conditions(user_id, filters)

        sqls = _compile_conditions(conditions)
        assert any("recipes.origin" in s and "Italian" in s for s in sqls)

    def test_build_filter_conditions_with_category_ids(self, recipe_repo):
        user_id = uuid4()
        cat_id1, cat_id2 = uuid4(), uuid4()
        filters = SearchFilters(ingredient_category_ids=[cat_id1, cat_id2])

        conditions = recipe_repo._build_filter_conditions(user_id, filters)

        sqls = _compile_conditions(conditions)
        assert any("recipe_ingredients" in s and "category_id" in s for s in sqls)

    def test_build_filter_conditions_empty_filters(self, recipe_repo):
        user_id = uuid4()
        filters = SearchFilters()

        conditions = recipe_repo._build_filter_conditions(user_id, filters)

        assert len(conditions) == 1
