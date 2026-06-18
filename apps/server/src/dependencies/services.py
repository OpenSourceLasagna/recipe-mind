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
from src.services.recipe_extraction_service import RecipeExtractionService
from src.services.recipe_ingestion_service import RecipeIngestionService
from src.services.recipe_serializer import RecipeSerializerService
from src.dependencies.db import QueryCacheRepo
from src.services.ai_chef.ai_chef_service import AIChefService
from src.services.ai_chef.moderation_service import ModerationService
from src.services.ai_chef.prompt_guard_service import PromptGuardService
from src.services.ai_chef.tool_executor import ToolExecutor
from src.services.search.hybrid_search_service import HybridSearchService
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
        _local_embedding_service = LocalEmbeddingService(
            base_path=settings.local_model_path,
            model_name=settings.local_embedding_model_name,
        )
    return _local_embedding_service


LocalEmbedder = Annotated[BaseEmbeddingService, Depends(get_local_embedding_service)]


def get_normalization_service() -> NormalizationService:
    return NormalizationService()


def get_recipe_serializer_service() -> RecipeSerializerService:
    return RecipeSerializerService()


RecipeSerializer = Annotated[
    RecipeSerializerService, Depends(get_recipe_serializer_service)
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
    preprocessor: RecipeSerializer,
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
    recipe_preprocessor: RecipeSerializer, settings: EnvSettings
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


def get_moderation_service(
    openai_client: OpenAIClient, settings: EnvSettings
) -> ModerationService:
    return ModerationService(
        client=openai_client,
        threshold=settings.moderation_threshold,
        fail_open=settings.llm_guard_fail_open,
    )


ModerationSvc = Annotated[ModerationService, Depends(get_moderation_service)]


_prompt_guard_service: PromptGuardService | None = None


def get_prompt_guard_service(settings: EnvSettings) -> PromptGuardService:
    global _prompt_guard_service
    if _prompt_guard_service is None:
        _prompt_guard_service = PromptGuardService(
            model_name=settings.prompt_guard_model_name,
            threshold=settings.prompt_guard_threshold,
            base_path=settings.local_model_path,
            fail_open=settings.llm_guard_fail_open,
        )
    return _prompt_guard_service


PromptGuard = Annotated[PromptGuardService, Depends(get_prompt_guard_service)]


def get_tool_executor(
    hybrid_searcher: HybridSearcher,
    recipe_repo: RecipeRepo,
) -> ToolExecutor:
    return ToolExecutor(
        hybrid_searcher=hybrid_searcher,
        recipe_repo=recipe_repo,
    )


ToolExec = Annotated[ToolExecutor, Depends(get_tool_executor)]


def get_ai_chef_service(
    openai_client: OpenAIClient,
    prompt_guard: PromptGuard,
    moderation: ModerationSvc,
    tool_executor: ToolExec,
    settings: EnvSettings,
) -> AIChefService:
    return AIChefService(
        openai_client=openai_client,
        prompt_guard=prompt_guard,
        moderation=moderation,
        tool_executor=tool_executor,
        settings=settings,
    )


AIChefSvc = Annotated[AIChefService, Depends(get_ai_chef_service)]


def get_recipe_extraction_service(
    openai_client: OpenAIClient,
    settings: EnvSettings,
) -> RecipeExtractionService:
    return RecipeExtractionService(client=openai_client, settings=settings)


RecipeExtractor = Annotated[
    RecipeExtractionService, Depends(get_recipe_extraction_service)
]
