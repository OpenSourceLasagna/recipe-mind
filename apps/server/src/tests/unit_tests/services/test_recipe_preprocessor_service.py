import pytest

from src.services.recipe_serializer import RecipeSerializerService


class TestRecipePreprocessorService:
    @pytest.fixture
    def service(self) -> RecipeSerializerService:
        return RecipeSerializerService()

    def test_to_markdown_full_recipe(self, service, make_recipe):
        recipe = make_recipe()
        result = service.to_markdown(recipe)

        assert "# Recipe: Test Recipe" in result
        assert "medium difficulty dish" in result
        assert "Italian" in result
        assert "30 minutes" in result
        assert "4 servings" in result
        assert "Spiciness level: 2 out of 5" in result
        assert "Calories: 500" in result
        assert "gluten-free" in result
        assert "Step 1: Step one" in result
        assert "Step 2: Step two" in result

    def test_to_markdown_minimal_recipe(self, service, make_recipe):
        recipe = make_recipe(
            title="Plain",
            origin="Unknown",
            duration_minutes=0,
            nutrition={},
            additional_information=[],
            instruction_steps=[],
        )
        result = service.to_markdown(recipe)

        assert "# Recipe: Plain" in result
        assert "Unknown" not in result
        assert "minutes" not in result
        assert "Nutritional Information" not in result
        assert "Additional Details" not in result
        assert "Cooking Instructions" not in result

    def test_to_markdown_unknown_origin_excluded(self, service, make_recipe):
        recipe = make_recipe(origin="Unknown")
        result = service.to_markdown(recipe)

        assert "with origins" not in result

    def test_to_markdown_zero_duration(self, service, make_recipe):
        recipe = make_recipe(duration_minutes=0)
        result = service.to_markdown(recipe)

        assert "minutes" not in result

    def test_to_markdown_with_nutrition(self, service, make_recipe):
        recipe = make_recipe(nutrition={"calories": 350, "protein": 20, "fat": None})
        result = service.to_markdown(recipe)

        assert "Calories: 350" in result
        assert "Protein: 20" in result
        assert "Fat" not in result

    def test_to_markdown_with_additional_info(self, service, make_recipe):
        info = ["Dairy-free", " high protein "]
        recipe = make_recipe(additional_information=info)
        result = service.to_markdown(recipe)

        assert "Dairy-free" in result
        assert "high protein" in result

    def test_to_markdown_filters_empty_additional_info(self, service, make_recipe):
        info = ["Valid info", "", "  "]
        recipe = make_recipe(additional_information=info)
        result = service.to_markdown(recipe)

        assert "Valid info" in result
        assert "  " not in result

    def test_to_markdown_with_instruction_steps(self, service, make_recipe):
        steps = ["Preheat oven", "Bake for 30min", "Serve"]
        recipe = make_recipe(instruction_steps=steps)
        result = service.to_markdown(recipe)

        assert "Step 1: Preheat oven" in result
        assert "Step 2: Bake for 30min" in result
        assert "Step 3: Serve" in result

    def test_to_markdown_filters_empty_steps(self, service, make_recipe):
        steps = ["Valid step", "", "  "]
        recipe = make_recipe(instruction_steps=steps)
        result = service.to_markdown(recipe)

        assert "Step 1: Valid step" in result
        assert "Step 2:" not in result

    def test_to_markdown_title_stripped(self, service, make_recipe):
        recipe = make_recipe(title="  My Recipe  ")
        result = service.to_markdown(recipe)

        assert "# Recipe: My Recipe" in result

    def test_to_markdown_origin_stripped(self, service, make_recipe):
        recipe = make_recipe(origin="  French  ")
        result = service.to_markdown(recipe)

        assert "French" in result

    def test_to_markdown_difficulty_stripped(self, service, make_recipe):
        recipe = make_recipe(difficulty="  hard  ")
        result = service.to_markdown(recipe)

        assert "hard difficulty dish" in result

    def test_to_markdown_spice_level_boundary(self, service, make_recipe):
        recipe = make_recipe(spice_level=5)
        result = service.to_markdown(recipe)

        assert "Spiciness level: 5 out of 5" in result

    def test_to_markdown_no_nutrition_when_empty(self, service, make_recipe):
        recipe = make_recipe(nutrition={})
        result = service.to_markdown(recipe)

        assert "Nutritional Information" not in result

    def test_to_markdown_multiline_output_structure(self, service, make_recipe):
        recipe = make_recipe()
        result = service.to_markdown(recipe)

        sections = result.split("\n\n")
        assert len(sections) >= 4
        assert sections[0].startswith("# Recipe:")

    def test_to_markdown_preserves_section_order(self, service, make_recipe):
        recipe = make_recipe(
            nutrition={"calories": 100},
            additional_information=["note"],
            instruction_steps=["do it"],
        )
        result = service.to_markdown(recipe)

        title_idx = result.index("# Recipe:")
        profile_idx = result.index("difficulty dish")
        nutrition_idx = result.index("Calories")
        details_idx = result.index("note")
        steps_idx = result.index("Step 1")

        assert profile_idx > title_idx
        assert nutrition_idx > profile_idx
        assert details_idx > nutrition_idx
        assert steps_idx > details_idx
