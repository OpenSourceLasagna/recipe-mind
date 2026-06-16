import json
import logging
from typing import Any
from uuid import UUID

from pydantic import ValidationError

from src.database.repositories.recipe_repository import RecipeRepository
from src.schemas.ai_chef_tools import (
    GetRecipeByIdToolParams,
    RecipePatch,
    SearchRecipesToolParams,
)
from src.schemas.recipe import RecipeResponse
from src.schemas.search import SearchFilters
from src.services.search.hybrid_search_service import HybridSearchService

logger = logging.getLogger(__name__)


class ToolExecutor:
    def __init__(
        self,
        hybrid_searcher: HybridSearchService,
        recipe_repo: RecipeRepository,
    ):
        self._hybrid = hybrid_searcher
        self._repo = recipe_repo

    async def execute_search(
        self,
        user_id: UUID,
        params: SearchRecipesToolParams,
    ) -> list[dict[str, str | int]]:
        filters = SearchFilters()
        recipes, _ = await self._hybrid.search(
            user_id=user_id,
            query_text=params.query,
            filters=filters,
            sort_by="relevance",
            sort_order="desc",
            page=1,
            page_size=params.max_results,
        )

        return [
            {
                "id": str(r.id),
                "title": r.title,
                "duration_minutes": r.duration_minutes,
                "difficulty": r.difficulty,
                "origin": r.origin,
            }
            for r in recipes
        ]

    async def execute_get_by_id(
        self,
        user_id: UUID,
        params: GetRecipeByIdToolParams,
    ) -> dict[str, Any] | None:
        try:
            recipe_id = UUID(params.recipe_id)
        except ValueError:
            logger.warning("Invalid recipe_id from tool call: %s", params.recipe_id)
            return None

        recipe = await self._repo.get_by_id(recipe_id)
        if recipe is None:
            return None

        if not recipe.is_public and recipe.user_id != user_id:
            logger.warning(
                "Unauthorized recipe access: user=%s recipe=%s",
                user_id,
                recipe_id,
            )
            return None

        return RecipeResponse.model_validate(recipe).model_dump(mode="json")

    async def get_recipes_by_ids(
        self,
        user_id: UUID,
        ids: list[UUID],
    ) -> list[RecipeResponse]:
        if not ids:
            return []

        recipes = await self._repo.get_by_ids(ids)
        visible = [r for r in recipes if r.is_public or r.user_id == user_id]
        return [RecipeResponse.model_validate(r) for r in visible]

    async def get_recipe_by_id_raw(
        self,
        user_id: UUID,
        recipe_id: UUID,
    ) -> RecipeResponse | None:
        recipe = await self._repo.get_by_id(recipe_id)
        if recipe is None:
            return None
        if not recipe.is_public and recipe.user_id != user_id:
            return None
        return RecipeResponse.model_validate(recipe)

    @staticmethod
    def parse_tool_arguments(
        name: str,
        arguments: str,
    ) -> tuple[SearchRecipesToolParams | GetRecipeByIdToolParams | None, str | None]:
        try:
            args_dict = json.loads(arguments)
        except (json.JSONDecodeError, TypeError):
            return None, f"Invalid JSON in arguments for {name}"

        model_map: dict[
            str, type[SearchRecipesToolParams | GetRecipeByIdToolParams]
        ] = {
            "search_recipes": SearchRecipesToolParams,
            "get_recipe_by_id": GetRecipeByIdToolParams,
        }
        model_cls = model_map.get(name)
        if model_cls is None:
            return None, f"Unknown tool: {name}"

        try:
            params = model_cls.model_validate(args_dict)
        except ValidationError as exc:
            return None, f"Invalid arguments for {name}: {exc}"

        return params, None

    async def execute_tool(
        self,
        name: str,
        arguments: str,
        user_id: UUID,
    ) -> str:
        params, error = self.parse_tool_arguments(name, arguments)
        if error:
            return json.dumps({"error": error})
        assert params is not None

        try:
            if name == "search_recipes" and isinstance(params, SearchRecipesToolParams):
                result = await self.execute_search(user_id, params)
                return json.dumps(result)
            elif name == "get_recipe_by_id" and isinstance(
                params, GetRecipeByIdToolParams
            ):
                result = await self.execute_get_by_id(user_id, params)
                return (
                    json.dumps(result)
                    if result is not None
                    else json.dumps({"error": "Recipe not found"})
                )
            else:
                return json.dumps({"error": f"Unknown tool: {name}"})
        except Exception:
            logger.exception("Tool execution failed: %s", name)
            return json.dumps({"error": f"Tool execution failed for {name}"})


def apply_recipe_patch(
    original: RecipeResponse,
    patch: RecipePatch,
) -> tuple[RecipeResponse, list[str]]:
    data = original.model_dump()
    original_ingredients = data.get("ingredients", [])
    changed_fields: list[str] = []

    patch_data = patch.model_dump(exclude_none=True)
    for field, value in patch_data.items():
        if field == "nutrition":
            merged = {**data.get("nutrition", {}), **value}
            data[field] = merged
        elif field == "ingredients":
            new_ingredients = []
            for idx, ing in enumerate(value):
                if idx < len(original_ingredients):
                    orig = original_ingredients[idx]
                    if isinstance(orig, dict):
                        new_ingredients.append(
                            {
                                "id": orig.get("id"),
                                "ingredient_name": ing["ingredient_name"],
                                "quantity": ing["quantity"],
                                "unit": ing["unit"],
                                "category_id": orig.get("category_id"),
                            }
                        )
                        continue
                new_ingredients.append(
                    {
                        "ingredient_name": ing["ingredient_name"],
                        "quantity": ing["quantity"],
                        "unit": ing["unit"],
                    }
                )
            data[field] = new_ingredients
        else:
            data[field] = value
        changed_fields.append(field)

    return RecipeResponse.model_validate(data), changed_fields
