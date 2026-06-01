from openai import OpenAI

from src.schemas.settings import Settings
from src.services.embeddings.base_embedding_service import BaseEmbeddingService

class EmbeddingService(BaseEmbeddingService):
    def __init__(self, client: OpenAI, settings: Settings):
        self.embedding_model = client.embeddings
        self.model_name = settings.embedding_model_name

    def embed(self, value: str) -> list[float]:
        response = self.embedding_model.create(input=value, model=self.model_name)
        embedding = response.data[0].embedding
        return embedding    
    
    def embed_many(self, values: list[str]) -> list[list[float]]:
        response = self.embedding_model.create(input=values, model=self.model_name)
        embeddings = [data.embedding for data in response.data]
        return embeddings
    
