import json
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from src.schemas.ai_chef_tools import (
    GetRecipeByIdToolParams,
    RecipePatch,
    SearchRecipesToolParams,
)
from src.schemas.recipe import RecipeResponse
from src.services.ai_chef.tool_executor import (
    ToolExecutor,
    apply_recipe_patch,
)


def _make_recipe_db_obj(**overrides) -> MagicMock:
    defaults = {
        "id": uuid4(),
        "is_public": True,
        "user_id": uuid4(),
        "title": "Test Recipe",
        "additional_information": [],
        "instruction_steps": [],
        "nutrition": {},
        "servings": 4,
        "duration_minutes": 30,
        "difficulty": "easy",
        "spice_level": 2,
        "origin": "Italian",
        "ingredients": [],
    }
    defaults.update(overrides)
    obj = MagicMock()
    for k, v in defaults.items():
        setattr(obj, k, v)
    return obj


@pytest.fixture
def tool_executor() -> ToolExecutor:
    mock_hybrid = AsyncMock()
    mock_repo = AsyncMock()
    return ToolExecutor(
        hybrid_searcher=mock_hybrid,
        recipe_repo=mock_repo,
    )


@pytest.mark.asyncio
async def test_execute_search(tool_executor: ToolExecutor):
    user_id = uuid4()
    recipe_id = uuid4()
    fake_recipe = MagicMock()
    fake_recipe.id = recipe_id
    fake_recipe.title = "Vegan Pasta"
    fake_recipe.duration_minutes = 30
    fake_recipe.difficulty = "easy"
    fake_recipe.origin = "Italian"

    tool_executor._hybrid.search.return_value = ([fake_recipe], 1)

    params = SearchRecipesToolParams(query="vegan pasta", max_results=3)
    result = await tool_executor.execute_search(user_id, params)

    assert len(result) == 1
    assert result[0]["id"] == str(recipe_id)
    assert result[0]["title"] == "Vegan Pasta"


@pytest.mark.asyncio
async def test_execute_get_by_id_public_recipe(tool_executor: ToolExecutor):
    user_id = uuid4()
    recipe_id = uuid4()
    fake_recipe = MagicMock()
    fake_recipe.id = recipe_id
    fake_recipe.is_public = True
    fake_recipe.user_id = uuid4()
    fake_recipe.title = "Test"
    fake_recipe.additional_information = []
    fake_recipe.instruction_steps = []
    fake_recipe.nutrition = {}
    fake_recipe.servings = 4
    fake_recipe.duration_minutes = 30
    fake_recipe.difficulty = "easy"
    fake_recipe.spice_level = 2
    fake_recipe.origin = "Unknown"
    fake_recipe.ingredients = []

    tool_executor._repo.get_by_id.return_value = fake_recipe

    params = GetRecipeByIdToolParams(recipe_id=str(recipe_id))
    result = await tool_executor.execute_get_by_id(user_id, params)

    assert result is not None
    assert result["id"] == str(recipe_id)


@pytest.mark.asyncio
async def test_execute_get_by_id_private_other_user(tool_executor: ToolExecutor):
    user_id = uuid4()
    other_user = uuid4()
    recipe_id = uuid4()
    fake_recipe = MagicMock()
    fake_recipe.is_public = False
    fake_recipe.user_id = other_user

    tool_executor._repo.get_by_id.return_value = fake_recipe

    params = GetRecipeByIdToolParams(recipe_id=str(recipe_id))
    result = await tool_executor.execute_get_by_id(user_id, params)

    assert result is None


@pytest.mark.asyncio
async def test_execute_get_by_id_invalid_uuid(tool_executor: ToolExecutor):
    params = GetRecipeByIdToolParams(recipe_id="not-a-uuid")
    result = await tool_executor.execute_get_by_id(uuid4(), params)
    assert result is None


@pytest.mark.asyncio
async def test_get_recipes_by_ids_filters_visibility(tool_executor: ToolExecutor):
    user_id = uuid4()
    other_user = uuid4()
    rid1 = uuid4()
    rid2 = uuid4()

    r1 = MagicMock()
    r1.id = rid1
    r1.is_public = True
    r1.user_id = other_user
    r1.title = "Public"
    r1.additional_information = []
    r1.instruction_steps = []
    r1.nutrition = {}
    r1.servings = 4
    r1.duration_minutes = 30
    r1.difficulty = "easy"
    r1.spice_level = 2
    r1.origin = "Unknown"
    r1.ingredients = []

    r2 = MagicMock()
    r2.id = rid2
    r2.is_public = False
    r2.user_id = other_user
    r2.title = "Private"
    r2.additional_information = []
    r2.instruction_steps = []
    r2.nutrition = {}
    r2.servings = 4
    r2.duration_minutes = 30
    r2.difficulty = "easy"
    r2.spice_level = 2
    r2.origin = "Unknown"
    r2.ingredients = []

    tool_executor._repo.get_by_ids.return_value = [r1, r2]

    result = await tool_executor.get_recipes_by_ids(user_id, [rid1, rid2])

    assert len(result) == 1
    assert str(result[0].id) == str(rid1)


class TestParseToolArguments:
    def test_parses_valid_search_recipes_arguments(self):
        arguments = json.dumps({"query": "pasta", "max_results": 5})

        params, error = ToolExecutor.parse_tool_arguments("search_recipes", arguments)

        assert error is None
        assert isinstance(params, SearchRecipesToolParams)
        assert params.query == "pasta"
        assert params.max_results == 5

    def test_parses_valid_get_recipe_by_id_arguments(self):
        rid = str(uuid4())
        arguments = json.dumps({"recipe_id": rid})

        params, error = ToolExecutor.parse_tool_arguments("get_recipe_by_id", arguments)

        assert error is None
        assert isinstance(params, GetRecipeByIdToolParams)
        assert params.recipe_id == rid

    def test_returns_error_for_invalid_json(self):
        params, error = ToolExecutor.parse_tool_arguments(
            "search_recipes", "{not valid json"
        )

        assert params is None
        assert "Invalid JSON" in error
        assert "search_recipes" in error

    def test_returns_error_for_unknown_tool(self):
        arguments = json.dumps({"query": "x"})

        params, error = ToolExecutor.parse_tool_arguments("nonexistent_tool", arguments)

        assert params is None
        assert "Unknown tool" in error

    def test_returns_error_for_invalid_arguments(self):
        arguments = json.dumps({"wrong_field": "x"})

        params, error = ToolExecutor.parse_tool_arguments("search_recipes", arguments)

        assert params is None
        assert "Invalid arguments" in error


class TestExecuteTool:
    @pytest.mark.asyncio
    async def test_dispatches_to_execute_search(self, tool_executor: ToolExecutor):
        tool_executor.execute_search = AsyncMock(
            return_value=[{"id": "abc", "title": "x"}]
        )

        result = await tool_executor.execute_tool(
            name="search_recipes",
            arguments=json.dumps({"query": "pasta", "max_results": 3}),
            user_id=uuid4(),
        )

        assert json.loads(result) == [{"id": "abc", "title": "x"}]
        tool_executor.execute_search.assert_called_once()

    @pytest.mark.asyncio
    async def test_dispatches_to_execute_get_by_id(self, tool_executor: ToolExecutor):
        rid = str(uuid4())
        tool_executor.execute_get_by_id = AsyncMock(return_value={"id": rid})

        result = await tool_executor.execute_tool(
            name="get_recipe_by_id",
            arguments=json.dumps({"recipe_id": rid}),
            user_id=uuid4(),
        )

        assert json.loads(result) == {"id": rid}
        tool_executor.execute_get_by_id.assert_called_once()

    @pytest.mark.asyncio
    async def test_returns_error_json_for_unknown_tool(
        self, tool_executor: ToolExecutor
    ):
        result = await tool_executor.execute_tool(
            name="nonexistent",
            arguments=json.dumps({}),
            user_id=uuid4(),
        )

        assert "error" in json.loads(result)

    @pytest.mark.asyncio
    async def test_returns_error_json_for_parse_failure(
        self, tool_executor: ToolExecutor
    ):
        result = await tool_executor.execute_tool(
            name="search_recipes",
            arguments="not json",
            user_id=uuid4(),
        )

        parsed = json.loads(result)
        assert "error" in parsed
        assert "search_recipes" in parsed["error"]

    @pytest.mark.asyncio
    async def test_returns_error_json_for_not_found_recipe(
        self, tool_executor: ToolExecutor
    ):
        tool_executor.execute_get_by_id = AsyncMock(return_value=None)

        result = await tool_executor.execute_tool(
            name="get_recipe_by_id",
            arguments=json.dumps({"recipe_id": str(uuid4())}),
            user_id=uuid4(),
        )

        parsed = json.loads(result)
        assert parsed == {"error": "Recipe not found"}


class TestGetRecipeByIdRaw:
    @pytest.mark.asyncio
    async def test_returns_recipe_response_for_public_recipe(
        self, tool_executor: ToolExecutor
    ):
        user_id = uuid4()
        rid = uuid4()
        recipe = _make_recipe_db_obj()
        tool_executor._repo.get_by_id.return_value = recipe

        result = await tool_executor.get_recipe_by_id_raw(user_id, rid)

        assert result is not None
        assert isinstance(result, RecipeResponse)

    @pytest.mark.asyncio
    async def test_returns_none_for_private_other_user(
        self, tool_executor: ToolExecutor
    ):
        tool_executor._repo.get_by_id.return_value = MagicMock(
            is_public=False, user_id=uuid4()
        )

        result = await tool_executor.get_recipe_by_id_raw(uuid4(), uuid4())

        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_when_recipe_not_found(
        self, tool_executor: ToolExecutor
    ):
        tool_executor._repo.get_by_id.return_value = None

        result = await tool_executor.get_recipe_by_id_raw(uuid4(), uuid4())

        assert result is None


def _make_recipe_response(**overrides) -> RecipeResponse:
    rid = uuid4()
    defaults = {
        "id": rid,
        "title": "Original Title",
        "additional_information": [],
        "instruction_steps": ["Step 1"],
        "nutrition": {"calories": 300, "protein": 20},
        "servings": 4,
        "duration_minutes": 30,
        "difficulty": "easy",
        "spice_level": 2,
        "origin": "Italian",
        "is_public": False,
        "ingredients": [],
        "created_at": "2024-01-01T00:00:00",
        "updated_at": "2024-01-01T00:00:00",
    }
    defaults.update(overrides)
    return RecipeResponse(**defaults)


class TestApplyRecipePatch:
    def test_returns_original_when_patch_is_empty(self):
        original = _make_recipe_response()
        patch = RecipePatch()

        result, changed = apply_recipe_patch(original, patch)

        assert result.title == original.title
        assert changed == []

    def test_applies_scalar_field_changes(self):
        original = _make_recipe_response()
        patch = RecipePatch(title="New Title", servings=8, duration_minutes=45)

        result, changed = apply_recipe_patch(original, patch)

        assert result.title == "New Title"
        assert result.servings == 8
        assert result.duration_minutes == 45
        assert set(changed) == {"title", "servings", "duration_minutes"}

    def test_merges_nutrition_dict(self):
        original = _make_recipe_response(nutrition={"calories": 300, "protein": 20})
        patch = RecipePatch(nutrition={"protein": 25, "fat": 10})

        result, changed = apply_recipe_patch(original, patch)

        assert result.nutrition.calories == 300
        assert result.nutrition.protein == 25
        assert result.nutrition.fat == 10
        assert result.nutrition.carbs is None
        assert changed == ["nutrition"]

    def test_replaces_ingredients_list(self):
        from src.schemas.ai_chef_tools import RecipeIngredientPatch
        from src.schemas.ingredient import RecipeIngredientResponse

        orig_ing1 = RecipeIngredientResponse(
            id=uuid4(),
            ingredient_name="flour",
            quantity=2.0,
            unit="cups",
        )
        orig_ing2 = RecipeIngredientResponse(
            id=uuid4(),
            ingredient_name="sugar",
            quantity=1.0,
            unit="cups",
        )
        original = _make_recipe_response(ingredients=[orig_ing1, orig_ing2])
        patch = RecipePatch(
            ingredients=[
                RecipeIngredientPatch(
                    ingredient_name="tomato", quantity=2.0, unit="cups"
                ),
                RecipeIngredientPatch(
                    ingredient_name="basil", quantity=1.0, unit="tbsp"
                ),
            ]
        )

        result, changed = apply_recipe_patch(original, patch)

        assert len(result.ingredients) == 2
        assert result.ingredients[0].ingredient_name == "tomato"
        assert result.ingredients[1].unit == "tbsp"
        assert changed == ["ingredients"]

    def test_replaces_instruction_steps_list(self):
        original = _make_recipe_response(instruction_steps=["old step"])
        patch = RecipePatch(instruction_steps=["new step 1", "new step 2"])

        result, changed = apply_recipe_patch(original, patch)

        assert result.instruction_steps == ["new step 1", "new step 2"]
        assert changed == ["instruction_steps"]

    def test_preserves_unpatched_fields(self):
        original = _make_recipe_response(title="Keep", difficulty="hard", spice_level=4)
        patch = RecipePatch(servings=10)

        result, _ = apply_recipe_patch(original, patch)

        assert result.title == "Keep"
        assert result.difficulty == "hard"
        assert result.spice_level == 4
        assert result.servings == 10
