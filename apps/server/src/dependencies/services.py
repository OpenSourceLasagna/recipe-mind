from typing import Annotated

from fastapi import Depends

from src.database.db import AsyncSessionLocal
from src.dependencies.clients import OpenAIClient
from src.dependencies.db import RecipeRepo
from src.dependencies.settings import EnvSettings
from src.services.category_matching_service import CategoryMatchingService
from src.services.embeddings.base_embedding_service import BaseEmbeddingService
from src.services.embeddings.embedding_service import EmbeddingService
from src.services.embeddings.local_embedding_service import LocalEmbeddingService
from src.services.normalization_service import NormalizationService
from src.services.recipe_ingestion_service import RecipeIngestionService
from src.services.recipe_preprocessor_service import RecipePreprocessorService
from src.services.search.hybrid_search_service import HybridSearchService
from src.dependencies.db import QueryCacheRepo
from src.services.search.reranking_service import RerankingService


def get_embedding_service(
    embedding_client: OpenAIClient, settings: EnvSettings
) -> BaseEmbeddingService:
    return EmbeddingService(client=embedding_client, settings=settings)


Embedder = Annotated[EmbeddingService, Depends(get_embedding_service)]


_local_embedding_service: BaseEmbeddingService | None = None


def get_local_embedding_service(settings: EnvSettings) -> BaseEmbeddingService:
    global _local_embedding_service
    if _local_embedding_service is None:
        _local_embedding_service = LocalEmbeddingService(settings=settings)
    return _local_embedding_service


LocalEmbedder = Annotated[BaseEmbeddingService, Depends(get_local_embedding_service)]


def get_normalization_service() -> NormalizationService:
    return NormalizationService()


def get_recipe_preprocessor_service() -> RecipePreprocessorService:
    return RecipePreprocessorService()


RecipePreprocessor = Annotated[
    RecipePreprocessorService, Depends(get_recipe_preprocessor_service)
]


def get_category_matching_service(
    local_embedder: LocalEmbedder,
    openai_client: OpenAIClient,
) -> CategoryMatchingService:
    return CategoryMatchingService(
        embedding_model=local_embedder,
        session_factory=AsyncSessionLocal,
        openai_client=openai_client,
    )


CategoryMatcher = Annotated[
    CategoryMatchingService, Depends(get_category_matching_service)
]


def get_recipe_ingestion_service(
    recipe_repository: RecipeRepo,
    embedder: Embedder,
    local_embedder: LocalEmbedder,
    preprocessor: RecipePreprocessor,
    category_matcher: CategoryMatcher,
) -> RecipeIngestionService:
    return RecipeIngestionService(
        repo=recipe_repository,
        embedder=embedder,
        small_embedder=local_embedder,
        preprocessor=preprocessor,
        category_matcher=category_matcher,
        normalizer=get_normalization_service(),
    )


RecipeIngestor = Annotated[
    RecipeIngestionService, Depends(get_recipe_ingestion_service)
]


_reranking_service: RerankingService | None = None


def get_reranking_service(
    recipe_preprocessor: RecipePreprocessor, settings: EnvSettings
) -> RerankingService:
    global _reranking_service
    if _reranking_service is None:
        _reranking_service = RerankingService(
            recipe_preprocessor=recipe_preprocessor,
            model_name=settings.reranking_model_name,
            model_base_path=settings.local_model_path,
        )
    return _reranking_service


Reranker = Annotated[RerankingService, Depends(get_reranking_service)]


def get_hybrid_search_service(
    recipe_repo: RecipeRepo,
    embedder: Embedder,
    reranker: Reranker,
    cache_repo: QueryCacheRepo,
) -> HybridSearchService:
    return HybridSearchService(
        recipe_repo=recipe_repo,
        embedder=embedder,
        reranker=reranker,
        cache_repo=cache_repo,
    )


HybridSearcher = Annotated[HybridSearchService, Depends(get_hybrid_search_service)]
