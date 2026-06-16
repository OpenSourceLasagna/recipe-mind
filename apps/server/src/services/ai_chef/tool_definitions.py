from typing import Any

from openai.types.responses.function_tool_param import FunctionToolParam

from src.schemas.ai_chef_tools import (
    GetRecipeByIdToolParams,
    SearchRecipesToolParams,
)


def _make_strict_schema(model: type) -> dict[str, Any]:
    schema = model.model_json_schema()
    if "properties" in schema:
        schema["required"] = sorted(schema["properties"].keys())
    for defn in schema.get("$defs", {}).values():
        if "properties" in defn:
            defn["required"] = sorted(defn["properties"].keys())
    return schema


def get_responses_tools() -> list[FunctionToolParam]:
    return [
        {
            "type": "function",
            "name": "search_recipes",
            "description": (
                "Search for recipes using semantic and full-text search.\n\n"
                "WHEN TO USE: The user wants to discover, find, or explore recipes. "
                "Examples: 'find vegan pasta', 'quick weeknight dinner', 'Mexican desserts'.\n\n"
                "WHEN NOT TO USE: The user already has a specific recipe and wants details or "
                "modifications — use get_recipe_by_id instead."
            ),
            "parameters": _make_strict_schema(SearchRecipesToolParams),
            "strict": True,
        },
        {
            "type": "function",
            "name": "get_recipe_by_id",
            "description": (
                "Retrieve full details of a specific recipe by its UUID.\n\n"
                "WHEN TO USE: The user refers to a specific recipe by name or ID, "
                "wants to see recipe details, or wants to modify a recipe.\n\n"
                "IMPORTANT: You MUST call this tool before modifying a recipe to "
                "ensure you have the current recipe details. Never guess or "
                "fabricate recipe content."
            ),
            "parameters": _make_strict_schema(GetRecipeByIdToolParams),
            "strict": True,
        },
    ]
