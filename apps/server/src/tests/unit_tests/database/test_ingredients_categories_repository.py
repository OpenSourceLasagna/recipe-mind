from src.models.ingredient_category import IngredientCategory


class TestIngredientCategoryRepository:
    async def test_create_adds_commits_and_refreshes(
        self, category_repo, mock_session, make_category
    ):
        category = make_category()

        result = await category_repo.create(category)

        mock_session.add.assert_called_once_with(category)
        mock_session.commit.assert_called_once()
        mock_session.refresh.assert_called_once_with(category)
        assert result == category

    async def test_get_by_id_returns_category(
        self, category_repo, mock_session, make_category, category_id
    ):
        expected = make_category()
        mock_session.get.return_value = expected

        result = await category_repo.get_by_id(category_id)

        mock_session.get.assert_called_once_with(IngredientCategory, category_id)
        assert result == expected

    async def test_get_by_id_returns_none(
        self, category_repo, mock_session, category_id
    ):
        mock_session.get.return_value = None

        result = await category_repo.get_by_id(category_id)

        assert result is None

    async def test_get_all_returns_all_categories(
        self, category_repo, mock_session, make_category
    ):
        expected = [
            make_category(category_name="Vegetables"),
            make_category(category_name="Fruits"),
        ]
        mock_session.exec.return_value.all.return_value = expected

        result = await category_repo.get_all()

        mock_session.exec.assert_called_once()
        assert result == expected

    async def test_get_all_empty(self, category_repo, mock_session):
        mock_session.exec.return_value.all.return_value = []

        result = await category_repo.get_all()

        assert result == []

    async def test_get_by_name_found(self, category_repo, mock_session, make_category):
        expected = make_category(category_name="Vegetables")
        mock_session.exec.return_value.one_or_none.return_value = expected

        result = await category_repo.get_by_name("Vegetables")

        mock_session.exec.assert_called_once()
        assert result == expected

    async def test_get_by_name_not_found(self, category_repo, mock_session):
        mock_session.exec.return_value.one_or_none.return_value = None

        result = await category_repo.get_by_name("NonExistent")

        assert result is None

    async def test_get_by_name_empty_string(self, category_repo, mock_session):
        mock_session.exec.return_value.one_or_none.return_value = None

        result = await category_repo.get_by_name("")

        assert result is None
