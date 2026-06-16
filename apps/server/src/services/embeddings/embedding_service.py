from openai import AsyncOpenAI

from src.schemas.settings import Settings
from src.services.embeddings.base_embedding_service import BaseEmbeddingService


class EmbeddingService(BaseEmbeddingService):
    def __init__(self, client: AsyncOpenAI, settings: Settings):
        self.embedding_model = client.embeddings
        self.model_name = settings.embedding_model_name

    async def embed(self, value: str) -> list[float]:
        response = await self.embedding_model.create(input=value, model=self.model_name)
        return response.data[0].embedding

    async def embed_many(self, values: list[str]) -> list[list[float]]:
        response = await self.embedding_model.create(
            input=values, model=self.model_name
        )
        return [data.embedding for data in response.data]
