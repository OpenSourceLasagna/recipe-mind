from uuid import UUID

from fastapi import BackgroundTasks, HTTPException

from src.database.repositories.recipe_repository import RecipeRepository
from src.models.recipe import Recipe
from src.models.recipe_ingredient import RecipeIngredient
from src.schemas.recipe import UpdateRecipeRequest
from src.services.category_matching_service import CategoryMatchingService
from src.services.embeddings.base_embedding_service import BaseEmbeddingService
from src.services.normalization_service import NormalizationService
from src.services.recipe_serializer import RecipeSerializerService

RECIPE_SCALAR_FIELDS = (
    "title",
    "additional_information",
    "instruction_steps",
    "nutrition",
    "servings",
    "duration_minutes",
    "difficulty",
    "spice_level",
    "origin",
    "is_public",
)


class RecipeIngestionService:
    def __init__(
        self,
        repo: RecipeRepository,
        embedder: BaseEmbeddingService,
        small_embedder: BaseEmbeddingService,
        preprocessor: RecipeSerializerService,
        category_matcher: CategoryMatchingService,
        normalizer: NormalizationService,
    ):
        self.repo = repo
        self.embedder = embedder
        self.small_embedder = small_embedder
        self.preprocessor = preprocessor
        self.ingredient_category_matcher = category_matcher
        self.normalizer = normalizer

    async def execute(
        self, recipe: Recipe, background_tasks: BackgroundTasks
    ) -> Recipe:
        recipe.ingredients = self._normalize_ingredients(recipe.ingredients)
        recipe.ingredients = await self._embed_ingredients(recipe.ingredients)

        md_text = self.preprocessor.to_vector_markdown(recipe)
        recipe.embedding = await self.embedder.embed(md_text)
        saved_recipe = await self.repo.create(recipe)

        background_tasks.add_task(
            self.ingredient_category_matcher.categorize_uncategorized_ingredients
        )

        return saved_recipe

    async def update(
        self,
        recipe_id: UUID,
        user_id: UUID,
        payload: UpdateRecipeRequest,
        background_tasks: BackgroundTasks,
    ) -> Recipe:
        recipe = await self.repo.get_by_id(recipe_id)
        if recipe is None:
            raise HTTPException(status_code=404, detail="Recipe not found")
        if recipe.user_id != user_id:
            raise HTTPException(status_code=403, detail="Not authorized")

        for field in RECIPE_SCALAR_FIELDS:
            val = getattr(payload, field, None)
            if val is not None:
                setattr(recipe, field, val)

        if payload.ingredients is not None:
            existing_map = {str(ing.id): ing for ing in recipe.ingredients if ing.id}
            kept: list[RecipeIngredient] = []

            for item in payload.ingredients:
                if item.id and str(item.id) in existing_map:
                    ing = existing_map.pop(str(item.id))
                    ing.ingredient_name = item.ingredient_name
                    ing.quantity = item.quantity
                    ing.unit = item.unit
                    kept.append(ing)
                else:
                    ri = RecipeIngredient(
                        recipe_id=recipe.id,
                        ingredient_name=item.ingredient_name,
                        quantity=item.quantity,
                        unit=item.unit,
                    )
                    self.repo.a_session.add(ri)
                    kept.append(ri)

            for ing in existing_map.values():
                await self.repo.a_session.delete(ing)

            recipe.ingredients = kept

        recipe.ingredients = self._normalize_ingredients(recipe.ingredients)
        recipe.ingredients = await self._embed_ingredients(recipe.ingredients)

        md_text = self.preprocessor.to_vector_markdown(recipe)
        recipe.embedding = await self.embedder.embed(md_text)

        saved = await self.repo.update(recipe)

        background_tasks.add_task(
            self.ingredient_category_matcher.categorize_uncategorized_ingredients
        )

        return saved

    async def _embed_ingredients(
        self, ingredients: list[RecipeIngredient]
    ) -> list[RecipeIngredient]:
        if not ingredients:
            return ingredients
        names = [i.normalized_name or i.ingredient_name for i in ingredients]
        embeddings = await self.small_embedder.embed_many(values=names)
        for ingredient, embedding in zip(ingredients, embeddings):
            ingredient.embedding = embedding
        return ingredients

    def _normalize_ingredients(
        self, ingredients: list[RecipeIngredient]
    ) -> list[RecipeIngredient]:
        if not ingredients:
            return ingredients
        for ingredient in ingredients:
            ingredient.normalized_name = self.normalizer.normalize_word(
                ingredient.ingredient_name
            )
        return ingredients
