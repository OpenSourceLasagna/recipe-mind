from unittest.mock import AsyncMock

from src.models.recipe_ingredient import RecipeIngredient


class TestRecipeIngestionService:
    async def test_execute_full_flow(
        self,
        ingestion_service,
        mock_embedder,
        mock_small_embedder,
        preprocessor,
        mock_normalizer,
        recipe_repo,
        mock_session,
        make_recipe,
        make_ingredient,
        background_tasks,
    ):
        ingredients = [
            make_ingredient(ingredient_name="Tomato", normalized_name=None),
            make_ingredient(ingredient_name="Onion", normalized_name=None),
        ]
        recipe = make_recipe(ingredients=ingredients)
        recipe_repo.create = AsyncMock(return_value=recipe)

        result = await ingestion_service.execute(recipe, background_tasks)

        mock_embedder.embed.assert_called_once()
        assert mock_small_embedder.embed_many.call_count == 1
        assert mock_normalizer.normalize_word.call_count == 2
        recipe_repo.create.assert_called_once_with(recipe)
        background_tasks.add_task.assert_called_once()
        assert result == recipe

    async def test_execute_embeds_recipe_text(
        self,
        ingestion_service,
        mock_embedder,
        make_recipe,
        make_ingredient,
        recipe_repo,
        mock_session,
        background_tasks,
    ):
        ingredient = make_ingredient(ingredient_name="Salt")
        recipe = make_recipe(ingredients=[ingredient])
        recipe_repo.create = AsyncMock(return_value=recipe)

        await ingestion_service.execute(recipe, background_tasks)

        call_arg = mock_embedder.embed.call_args[0][0]
        assert "# Recipe: Test Recipe" in call_arg

    async def test_execute_normalizes_all_ingredients(
        self,
        ingestion_service,
        mock_normalizer,
        make_recipe,
        make_ingredient,
        recipe_repo,
        mock_session,
        background_tasks,
    ):
        ingredients = [
            make_ingredient(ingredient_name="  Tomato  ", normalized_name=None),
            make_ingredient(ingredient_name="  Onion  ", normalized_name=None),
        ]
        recipe = make_recipe(ingredients=ingredients)
        recipe_repo.create = AsyncMock(return_value=recipe)

        await ingestion_service.execute(recipe, background_tasks)

        assert mock_normalizer.normalize_word.call_count == 2
        mock_normalizer.normalize_word.assert_any_call("  Tomato  ")
        mock_normalizer.normalize_word.assert_any_call("  Onion  ")

    async def test_execute_embeds_ingredients_with_small_embedder(
        self,
        ingestion_service,
        mock_small_embedder,
        make_recipe,
        make_ingredient,
        recipe_repo,
        mock_session,
        background_tasks,
    ):
        ingredients = [
            make_ingredient(ingredient_name="Tomato", normalized_name=None),
            make_ingredient(ingredient_name="Onion", normalized_name=None),
        ]
        recipe = make_recipe(ingredients=ingredients)
        recipe_repo.create = AsyncMock(return_value=recipe)

        await ingestion_service.execute(recipe, background_tasks)

        mock_small_embedder.embed_many.assert_called_once()
        call_args = mock_small_embedder.embed_many.call_args[1]["values"]
        assert "tomato" in call_args
        assert "onion" in call_args

    async def test_execute_saves_recipe_and_schedules_background(
        self,
        ingestion_service,
        recipe_repo,
        mock_session,
        make_recipe,
        make_ingredient,
        background_tasks,
    ):
        ingredient = make_ingredient()
        recipe = make_recipe(ingredients=[ingredient])
        recipe_repo.create = AsyncMock(return_value=recipe)

        result = await ingestion_service.execute(recipe, background_tasks)

        recipe_repo.create.assert_called_once_with(recipe)
        background_tasks.add_task.assert_called_once_with(
            ingestion_service.ingredient_category_matcher.categorize_uncategorized_ingredients
        )
        assert result == recipe

    def test_embed_ingredients_empty_list(self, ingestion_service, mock_small_embedder):
        result = ingestion_service._embed_ingredients([])
        assert result == []
        mock_small_embedder.embed_many.assert_not_called()

    def test_embed_ingredients_uses_normalized_name_when_available(
        self,
        ingestion_service,
        mock_small_embedder,
        make_ingredient,
        recipe_id,
    ):
        ingredients = [
            RecipeIngredient(
                id=recipe_id,  # not ideal but works for mock
                recipe_id=recipe_id,
                ingredient_name="Raw Tomato",
                normalized_name="tomato",
            )
        ]
        ingestion_service._embed_ingredients(ingredients)

        call_args = mock_small_embedder.embed_many.call_args[1]["values"]
        assert call_args == ["tomato"]

    def test_embed_ingredients_falls_back_to_ingredient_name(
        self,
        ingestion_service,
        mock_small_embedder,
        make_ingredient,
    ):
        ingredient = make_ingredient(
            ingredient_name="Raw Tomato",
            normalized_name=None,
        )
        ingestion_service._embed_ingredients([ingredient])

        call_args = mock_small_embedder.embed_many.call_args[1]["values"]
        assert call_args == ["Raw Tomato"]

    def test_embed_ingredients_sets_embedding_on_each(
        self,
        ingestion_service,
        mock_small_embedder,
        make_ingredient,
    ):
        ingredients = [
            make_ingredient(ingredient_name="Tomato", embedding=None),
            make_ingredient(ingredient_name="Onion", embedding=None),
        ]
        mock_small_embedder.embed_many.return_value = [[0.1], [0.2]]

        result = ingestion_service._embed_ingredients(ingredients)

        assert result[0].embedding == [0.1]
        assert result[1].embedding == [0.2]

    def test_normalize_ingredients_empty_list(self, ingestion_service, mock_normalizer):
        result = ingestion_service._normalize_ingredients([])
        assert result == []
        mock_normalizer.normalize_word.assert_not_called()

    def test_normalize_ingredients_sets_normalized_name(
        self,
        ingestion_service,
        mock_normalizer,
        make_ingredient,
    ):
        mock_normalizer.normalize_word.side_effect = lambda w: w.strip().lower()
        ingredients = [
            make_ingredient(ingredient_name="  Tomato  ", normalized_name=None),
            make_ingredient(ingredient_name="  Onion  ", normalized_name=None),
        ]

        result = ingestion_service._normalize_ingredients(ingredients)

        assert result[0].normalized_name == "tomato"
        assert result[1].normalized_name == "onion"

    def test_normalize_ingredients_preserves_other_fields(
        self,
        ingestion_service,
        mock_normalizer,
        make_ingredient,
    ):
        mock_normalizer.normalize_word.side_effect = lambda w: w.strip().lower()
        ingredients = [
            make_ingredient(
                ingredient_name="Tomato",
                normalized_name=None,
                quantity=3.0,
                unit="pieces",
            )
        ]

        result = ingestion_service._normalize_ingredients(ingredients)

        assert result[0].quantity == 3.0
        assert result[0].unit == "pieces"
