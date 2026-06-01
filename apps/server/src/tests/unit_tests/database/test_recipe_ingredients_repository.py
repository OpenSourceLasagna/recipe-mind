from uuid import uuid4

from src.models.recipe_ingredient import RecipeIngredient


class TestRecipeIngredientRepository:
    async def test_create_adds_commits_and_refreshes(
        self, ingredient_repo, mock_session, make_ingredient
    ):
        ingredient = make_ingredient()

        result = await ingredient_repo.create(ingredient)

        mock_session.add.assert_called_once_with(ingredient)
        mock_session.commit.assert_called_once()
        mock_session.refresh.assert_called_once_with(ingredient)
        assert result == ingredient

    async def test_get_by_id_returns_ingredient(
        self, ingredient_repo, mock_session, make_ingredient, ingredient_id
    ):
        expected = make_ingredient()
        mock_session.get.return_value = expected

        result = await ingredient_repo.get_by_id(ingredient_id)

        mock_session.get.assert_called_once_with(RecipeIngredient, ingredient_id)
        assert result == expected

    async def test_get_uncategorized(
        self, ingredient_repo, mock_session, make_ingredient
    ):
        expected = [make_ingredient()]
        mock_session.exec.return_value.all.return_value = expected

        result = await ingredient_repo.get_uncategorized()

        mock_session.exec.assert_called_once()
        assert result == expected

    async def test_get_categorized_by_normalized_names(
        self, ingredient_repo, mock_session, make_ingredient
    ):
        expected = [make_ingredient(category_id=uuid4())]
        mock_session.exec.return_value.all.return_value = expected
        names = ["tomato", "onion"]

        result = await ingredient_repo.get_categorized_by_normalized_names(names)

        mock_session.exec.assert_called_once()
        assert result == expected

    async def test_get_centroids(
        self, ingredient_repo, mock_session, make_ingredient
    ):
        expected = [make_ingredient(category_id=uuid4())]
        mock_session.exec.return_value.all.return_value = expected

        result = await ingredient_repo.get_centroids()

        mock_session.exec.assert_called_once()
        assert result == expected

    async def test_bulk_update_categories(
        self, ingredient_repo, mock_session
    ):
        ing_id_1, cat_id_1 = uuid4(), uuid4()
        ing_id_2, cat_id_2 = uuid4(), uuid4()
        mappings = [(ing_id_1, cat_id_1), (ing_id_2, cat_id_2)]

        await ingredient_repo.bulk_update_categories(mappings)

        assert mock_session.exec.call_count == 2

    async def test_bulk_update_categories_empty_list(
        self, ingredient_repo, mock_session
    ):
        await ingredient_repo.bulk_update_categories([])
        mock_session.exec.assert_not_called()

    async def test_get_uncategorized_empty(
        self, ingredient_repo, mock_session
    ):
        mock_session.exec.return_value.all.return_value = []

        result = await ingredient_repo.get_uncategorized()

        assert result == []

    async def test_get_categorized_by_normalized_names_empty(
        self, ingredient_repo, mock_session
    ):
        mock_session.exec.return_value.all.return_value = []

        result = await ingredient_repo.get_categorized_by_normalized_names([])

        assert result == []

    async def test_get_centroids_empty(
        self, ingredient_repo, mock_session
    ):
        mock_session.exec.return_value.all.return_value = []

        result = await ingredient_repo.get_centroids()

        assert result == []
