import pytest

from src.services.recipe_serializer import RecipeSerializerService


class TestRecipePreprocessorService:
    @pytest.fixture
    def service(self) -> RecipeSerializerService:
        return RecipeSerializerService()

    def test_to_vector_markdown_full_recipe(self, service, make_recipe):
        recipe = make_recipe()
        result = service.to_vector_markdown(recipe)

        assert "# Test Recipe" in result
        assert "Keywords:" in result
        assert "italian" in result.lower() or "Italian" in result
        assert "medium" in result

    def test_to_vector_markdown_minimal_recipe(self, service, make_recipe):
        recipe = make_recipe(
            title="Plain",
            origin="Unknown",
            duration_minutes=0,
            nutrition={},
            additional_information=[],
            instruction_steps=[],
        )
        result = service.to_vector_markdown(recipe)

        assert "# Plain" in result
        assert "Unknown" not in result

    def test_to_vector_markdown_unknown_origin_excluded(self, service, make_recipe):
        recipe = make_recipe(origin="Unknown")
        result = service.to_vector_markdown(recipe)

        assert "unknown" not in result.lower()

    def test_to_vector_markdown_title_stripped(self, service, make_recipe):
        recipe = make_recipe(title="  My Recipe  ")
        result = service.to_vector_markdown(recipe)

        assert "# My Recipe" in result

    def test_to_vector_markdown_includes_ingredients(self, service, make_recipe):
        recipe = make_recipe()
        result = service.to_vector_markdown(recipe)

        assert "Keywords:" in result

    def test_to_rerank_markdown_full_recipe(self, service, make_recipe):
        recipe = make_recipe()
        result = service.to_rerank_markdown(recipe)

        assert "# Recipe: Test Recipe" in result
        assert "medium" in result.lower() or "Difficulty=medium" in result
        assert "Italian" in result

    def test_to_rerank_markdown_minimal_recipe(self, service, make_recipe):
        recipe = make_recipe(
            title="Plain",
            origin="Unknown",
            duration_minutes=0,
            nutrition={},
            additional_information=[],
            instruction_steps=[],
        )
        result = service.to_rerank_markdown(recipe)

        assert "# Recipe: Plain" in result

    def test_to_rerank_markdown_with_instruction_steps(self, service, make_recipe):
        steps = ["Preheat oven", "Bake for 30min", "Serve"]
        recipe = make_recipe(instruction_steps=steps)
        result = service.to_rerank_markdown(recipe)

        assert "Step 1: Preheat oven" in result
        assert "Step 2: Bake for 30min" in result
        assert "Step 3: Serve" in result

    def test_to_rerank_markdown_filters_empty_steps(self, service, make_recipe):
        steps = ["Valid step", "", "  "]
        recipe = make_recipe(instruction_steps=steps)
        result = service.to_rerank_markdown(recipe)

        assert "Step 1: Valid step" in result
        assert "Step 2:" not in result

    def test_to_rerank_markdown_title_stripped(self, service, make_recipe):
        recipe = make_recipe(title="  My Recipe  ")
        result = service.to_rerank_markdown(recipe)

        assert "# Recipe: My Recipe" in result

    def test_to_rerank_markdown_with_ingredients(self, service, make_recipe):
        from src.models.recipe_ingredient import RecipeIngredient
        from uuid import uuid4

        recipe = make_recipe()
        ingredients = [
            RecipeIngredient(
                id=uuid4(),
                recipe_id=recipe.id,
                ingredient_name="Tomato",
                quantity=2.0,
                unit="cups",
            ),
        ]
        recipe = make_recipe(ingredients=ingredients)
        result = service.to_rerank_markdown(recipe)

        assert "Ingredients" in result
        assert "Tomato" in result

    def test_to_rerank_markdown_preserves_section_order(self, service, make_recipe):
        steps = ["do it"]
        recipe = make_recipe(instruction_steps=steps)
        result = service.to_rerank_markdown(recipe)

        title_idx = result.index("# Recipe:")
        attr_idx = result.index("Attributes:")
        steps_idx = result.index("Step 1")

        assert attr_idx > title_idx
        assert steps_idx > attr_idx
