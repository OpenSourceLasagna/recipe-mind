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

    async def test_update_commits_and_refreshes(
        self, recipe_repo, mock_session, make_recipe
    ):
        recipe = make_recipe()

        result = await recipe_repo.update(recipe)

        mock_session.commit.assert_called_once()
        mock_session.refresh.assert_called_once_with(recipe)
        assert result == recipe

    async def test_delete_removes_ingredients_and_recipe(
        self, recipe_repo, mock_session, make_recipe, make_ingredient
    ):
        ingredient_a = make_ingredient(ingredient_name="a")
        ingredient_b = make_ingredient(ingredient_name="b")
        recipe = make_recipe(ingredients=[ingredient_a, ingredient_b])

        await recipe_repo.delete(recipe)

        assert mock_session.delete.call_count == 3
        mock_session.delete.assert_any_call(ingredient_a)
        mock_session.delete.assert_any_call(ingredient_b)
        mock_session.delete.assert_any_call(recipe)
        mock_session.commit.assert_called_once()

    async def test_delete_with_no_ingredients(
        self, recipe_repo, mock_session, make_recipe
    ):
        recipe = make_recipe(ingredients=[])

        await recipe_repo.delete(recipe)

        mock_session.delete.assert_called_once_with(recipe)
        mock_session.commit.assert_called_once()

    async def test_search_returns_paginated_results(
        self, recipe_repo, mock_session, user_id, make_recipe
    ):
        recipes = [make_recipe(title=f"Recipe {i}") for i in range(3)]
        mock_session.exec.return_value.all.return_value = recipes
        mock_session.exec.return_value.one.return_value = 3

        from src.schemas.search import RecipeSearchQuery

        query = RecipeSearchQuery(query="pasta", page=1, page_size=10)
        result_recipes, total = await recipe_repo.search(user_id=user_id, query=query)

        assert total == 3
        assert result_recipes == recipes

    async def test_search_without_text_query(self, recipe_repo, mock_session, user_id):
        mock_session.exec.return_value.all.return_value = []
        mock_session.exec.return_value.one.return_value = 0

        from src.schemas.search import RecipeSearchQuery

        query = RecipeSearchQuery()
        recipes, total = await recipe_repo.search(user_id=user_id, query=query)

        assert recipes == []
        assert total == 0

    async def test_search_with_category_ids(self, recipe_repo, mock_session, user_id):
        mock_session.exec.return_value.all.return_value = []
        mock_session.exec.return_value.one.return_value = 0
        cat_id = uuid4()

        from src.schemas.search import RecipeSearchQuery

        query = RecipeSearchQuery()
        recipes, total = await recipe_repo.search(
            user_id=user_id,
            query=query,
            ingredient_category_ids=[cat_id],
        )

        assert recipes == []

    async def test_search_by_vector_returns_scored_pairs(
        self, recipe_repo, mock_session, user_id
    ):
        recipe_a, recipe_b = uuid4(), uuid4()
        mock_session.exec.return_value.all.return_value = [
            (recipe_a, 0.9),
            (recipe_b, 0.7),
        ]

        results = await recipe_repo.search_by_vector(
            embedding=[0.1, 0.2, 0.3],
            user_id=user_id,
            filters=SearchFilters(),
        )

        assert results == [(recipe_a, 0.9), (recipe_b, 0.7)]

    async def test_search_by_vector_empty_results(
        self, recipe_repo, mock_session, user_id
    ):
        mock_session.exec.return_value.all.return_value = []

        results = await recipe_repo.search_by_vector(
            embedding=[0.1, 0.2, 0.3],
            user_id=user_id,
            filters=SearchFilters(),
        )

        assert results == []

    async def test_search_by_fulltext_returns_scored_pairs(
        self, recipe_repo, mock_session, user_id
    ):
        recipe_a, recipe_b = uuid4(), uuid4()
        mock_session.exec.return_value.all.return_value = [
            (recipe_a, 0.85),
            (recipe_b, 0.42),
        ]

        results = await recipe_repo.search_by_fulltext(
            query_text="creamy tomato",
            user_id=user_id,
            filters=SearchFilters(),
        )

        assert results == [(recipe_a, 0.85), (recipe_b, 0.42)]

    async def test_search_by_fulltext_empty_results(
        self, recipe_repo, mock_session, user_id
    ):
        mock_session.exec.return_value.all.return_value = []

        results = await recipe_repo.search_by_fulltext(
            query_text="nothing matches",
            user_id=user_id,
            filters=SearchFilters(),
        )

        assert results == []
