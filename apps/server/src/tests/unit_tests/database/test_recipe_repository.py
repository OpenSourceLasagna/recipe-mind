from src.models.recipe import Recipe


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
