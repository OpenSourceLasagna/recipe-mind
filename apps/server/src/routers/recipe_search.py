import math

from fastapi import APIRouter, Depends

from src.dependencies.auth import CurrentUserID, current_user_id_dep
from src.dependencies.db import IngredientCategoryRepo, RecipeRepo
from src.dependencies.services import HybridSearcher
from src.models.recipe import Recipe
from src.schemas.category import IngredientCategoryResponseItem
from src.schemas.recipe import RecipeResponse
from src.schemas.search import RecipeSearchQuery, RecipeSearchResponse


router_v1 = APIRouter(
    prefix="/v1/search", tags=["v1", "search"], dependencies=[current_user_id_dep]
)


def _parse_ingredient_categories(raw: str | None) -> list[str] | None:
    if not raw:
        return None
    names = [n.strip() for n in raw.split(",") if n.strip()]
    return names or None


def _build_response(
    items: list[Recipe], total: int, page: int, page_size: int
) -> RecipeSearchResponse:
    return RecipeSearchResponse(
        items=[RecipeResponse.model_validate(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )


def _normalize_sort(sort_by: str, is_hybrid: bool) -> str:
    if is_hybrid and sort_by == "created_at":
        return "relevance"
    if not is_hybrid and sort_by == "relevance":
        return "created_at"
    return sort_by


@router_v1.get("/categories", response_model=list[IngredientCategoryResponseItem])
async def list_categories(
    current_user_id: CurrentUserID,
    category_repo: IngredientCategoryRepo,
):
    return await category_repo.get_all()


@router_v1.get("/", response_model=RecipeSearchResponse)
async def search_recipes(
    current_user_id: CurrentUserID,
    recipe_repo: RecipeRepo,
    category_repo: IngredientCategoryRepo,
    hybrid_searcher: HybridSearcher,
    search_query: RecipeSearchQuery = Depends(),
):
    category_ids = None
    names = _parse_ingredient_categories(search_query.ingredient_categories)
    if names:
        categories = await category_repo.get_by_names(names)
        category_ids = [c.id for c in categories]

    if search_query.query:
        filters = search_query.to_filters(category_ids)
        effective_sort = _normalize_sort(search_query.sort_by, is_hybrid=True)

        recipes, total = await hybrid_searcher.search(
            user_id=current_user_id,
            query_text=search_query.query,
            filters=filters,
            sort_by=effective_sort,
            sort_order=search_query.sort_order,
            page=search_query.page,
            page_size=search_query.page_size,
        )

        return _build_response(
            recipes, total, search_query.page, search_query.page_size
        )

    effective_sort = _normalize_sort(search_query.sort_by, is_hybrid=False)
    browse_query = search_query.model_copy(update={"sort_by": effective_sort})

    recipes, total = await recipe_repo.search(
        user_id=current_user_id,
        query=browse_query,
        ingredient_category_ids=category_ids,
    )

    return _build_response(recipes, total, browse_query.page, browse_query.page_size)
