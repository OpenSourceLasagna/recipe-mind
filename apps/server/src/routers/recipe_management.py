
from fastapi import APIRouter, BackgroundTasks

from src.dependencies.services import RecipeIngestor
from src.models.recipe_ingredient import RecipeIngredient
from src.models.recipe import Recipe
from src.schemas.recipe import CreateRecipeRequest, RecipeResponse

from ..dependencies.auth import CurrentUserID, current_user_id_dep


router_v1 = APIRouter(prefix="/v1/recipes", tags=["v1", "recipes"], dependencies=[current_user_id_dep])

@router_v1.post("/structured", tags=["recipes"], response_model=RecipeResponse)
async def create_recipe(current_user_id: CurrentUserID, payload: CreateRecipeRequest, recipe_ingestor: RecipeIngestor, background_tasks: BackgroundTasks):
    received_recipe = Recipe(
        user_id=current_user_id,
        title=payload.title,
        additional_information=payload.additional_information,
        instruction_steps=payload.instruction_steps,
        nutrition=payload.nutrition,
        servings=payload.servings,
        duration_minutes=payload.duration_minutes,
        difficulty=payload.difficulty,
        spice_level=payload.spice_level,
        origin=payload.origin,
        is_public=payload.is_public,
    )

    received_recipe.ingredients = [
        RecipeIngredient(
            recipe_id=received_recipe.id,
            ingredient_name=ingredient.ingredient_name,
            quantity=ingredient.quantity,
            unit=ingredient.unit,
        )
        for ingredient in payload.ingredients
    ]

    saved_recipe = await recipe_ingestor.execute(recipe=received_recipe, background_tasks=background_tasks)
    return saved_recipe

@router_v1.get("/{recipe_id}", tags=["recipes"])
def get_recipe(recipe_id: str, current_user_id: CurrentUserID):
    return {"message": f"Recipe information for ID: {recipe_id}"}

@router_v1.patch("/{recipe_id}", tags=["recipes"])
def update_recipe(recipe_id: str, current_user_id: CurrentUserID):
    return {"message": f"Recipe with ID: {recipe_id} updated successfully"}

@router_v1.delete("/{recipe_id}", tags=["recipes"])
def delete_recipe(recipe_id: str, current_user_id: CurrentUserID):
    return {"message": f"Recipe with ID: {recipe_id} deleted successfully"}
