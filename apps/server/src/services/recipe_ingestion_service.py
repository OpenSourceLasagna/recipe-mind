from src.services.normalization_service import NormalizationService
from src.database.repositories.recipe_repository import RecipeRepository
from src.models.recipe import Recipe
from src.models.recipe_ingredient import RecipeIngredient
from src.services.category_matching_service import CategoryMatchingService
from src.services.embeddings.base_embedding_service import BaseEmbeddingService
from src.services.recipe_serializer import RecipeSerializerService
from fastapi import BackgroundTasks

class RecipeIngestionService:
    def __init__(
        self,
        repo: RecipeRepository,
        embedder: BaseEmbeddingService,
        small_embedder: BaseEmbeddingService,
        preprocessor: RecipeSerializerService,
        category_matcher: CategoryMatchingService,
        normalizer: NormalizationService
    ):
        self.repo = repo
        self.embedder = embedder
        self.small_embedder = small_embedder
        self.preprocessor = preprocessor
        self.ingredient_category_matcher = category_matcher
        self.normalizer = normalizer

    async def execute(self, recipe: Recipe, background_tasks: BackgroundTasks) -> Recipe:
        recipe.ingredients = self._normalize_ingredients(recipe.ingredients)
        recipe.ingredients = self._embed_ingredients(recipe.ingredients)

        md_text = self.preprocessor.to_vector_markdown(recipe)
        recipe.embedding = self.embedder.embed(md_text)
        saved_recipe = await self.repo.create(recipe)

        background_tasks.add_task(self.ingredient_category_matcher.categorize_uncategorized_ingredients)

        return saved_recipe
    
    def _embed_ingredients(self, ingredients: list[RecipeIngredient]) -> list[RecipeIngredient]:
        if not ingredients:
            return ingredients
        names = [i.normalized_name or i.ingredient_name for i in ingredients]
        embeddings = self.small_embedder.embed_many(values=names)
        for ingredient, embedding in zip(ingredients, embeddings):
            ingredient.embedding = embedding
        return ingredients
    
    def _normalize_ingredients(self, ingredients: list[RecipeIngredient]) -> list[RecipeIngredient]:
        if not ingredients:
            return ingredients
        for ingredient in ingredients:
            ingredient.normalized_name = self.normalizer.normalize_word(ingredient.ingredient_name)
        return ingredients