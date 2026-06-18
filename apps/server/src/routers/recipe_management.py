from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, HTTPException, status

from src.dependencies.auth import CurrentUserID, current_user_id_dep
from src.dependencies.db import RecipeRepo
from src.dependencies.services import RecipeExtractor, RecipeIngestor
from src.middleware.rate_limit import _ExtractRateLimit, _StructuredRateLimit
from src.models.recipe import Recipe
from src.models.recipe_ingredient import RecipeIngredient
from src.schemas.recipe import (
    CreateRecipeRequest,
    RecipeDetailResponse,
    RecipeResponse,
    UpdateRecipeRequest,
)
from src.schemas.recipe_extraction import ExtractRecipeRequest
from src.services.recipe_extraction_service import ExtractionError, UrlValidationError


router_v1 = APIRouter(
    prefix="/v1/recipes", tags=["v1", "recipes"], dependencies=[current_user_id_dep]
)


@router_v1.post(
    "/structured",
    tags=["recipes"],
    response_model=RecipeResponse,
    dependencies=[_StructuredRateLimit],
)
async def create_recipe(
    current_user_id: CurrentUserID,
    payload: CreateRecipeRequest,
    recipe_ingestor: RecipeIngestor,
    background_tasks: BackgroundTasks,
):
    received_recipe = Recipe(
        user_id=current_user_id,
        title=payload.title,
        additional_information=payload.additional_information,
        instruction_steps=payload.instruction_steps,
        nutrition=payload.nutrition.model_dump(exclude_none=True),
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

    saved_recipe = await recipe_ingestor.execute(
        recipe=received_recipe, background_tasks=background_tasks
    )
    return saved_recipe


@router_v1.get("/{recipe_id}", response_model=RecipeDetailResponse)
async def get_recipe(
    recipe_id: UUID,
    current_user_id: CurrentUserID,
    recipe_repo: RecipeRepo,
):
    recipe = await recipe_repo.get_by_id(recipe_id)
    if recipe is None:
        raise HTTPException(status_code=404, detail="Recipe not found")
    if not recipe.is_public and recipe.user_id != current_user_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    resp = RecipeDetailResponse.model_validate(recipe)
    resp.is_owner = recipe.user_id == current_user_id
    return resp


@router_v1.patch("/{recipe_id}", response_model=RecipeDetailResponse)
async def update_recipe(
    recipe_id: UUID,
    current_user_id: CurrentUserID,
    payload: UpdateRecipeRequest,
    recipe_ingestor: RecipeIngestor,
    background_tasks: BackgroundTasks,
):
    updated = await recipe_ingestor.update(
        recipe_id=recipe_id,
        user_id=current_user_id,
        payload=payload,
        background_tasks=background_tasks,
    )

    resp = RecipeDetailResponse.model_validate(updated)
    resp.is_owner = True
    return resp


@router_v1.delete("/{recipe_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_recipe(
    recipe_id: UUID,
    current_user_id: CurrentUserID,
    recipe_repo: RecipeRepo,
):
    recipe = await recipe_repo.get_by_id(recipe_id)
    if recipe is None:
        raise HTTPException(status_code=404, detail="Recipe not found")
    if recipe.user_id != current_user_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    await recipe_repo.delete(recipe)


@router_v1.post(
    "/extract", response_model=CreateRecipeRequest, dependencies=[_ExtractRateLimit]
)
async def extract_recipe(
    current_user_id: CurrentUserID,
    payload: ExtractRecipeRequest,
    extractor: RecipeExtractor,
):
    try:
        return await extractor.extract(payload)
    except UrlValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except ExtractionError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc
