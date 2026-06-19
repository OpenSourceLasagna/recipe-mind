import asyncio

from sentence_transformers import SentenceTransformer

from src.services.embeddings.base_embedding_service import BaseEmbeddingService
from src.utils.get_save_model import get_save_sentence_transformer_path


class LocalEmbeddingService(BaseEmbeddingService):
    def __init__(self, base_path: str, model_name: str):
        saved_path = get_save_sentence_transformer_path(
            base_path=base_path,
            model_name=model_name,
        )

        self.embedding_model = SentenceTransformer(
            str(saved_path), device="cpu", trust_remote_code=True
        )

    async def embed(self, value: str) -> list[float]:
        embedding = await asyncio.to_thread(
            self.embedding_model.encode,  # type: ignore
            inputs=value,
            normalize_embeddings=True,
            convert_to_numpy=True,
        )
        return embedding.tolist()

    async def embed_many(self, values: list[str]) -> list[list[float]]:
        embeddings = await asyncio.to_thread(
            self.embedding_model.encode,  # type: ignore
            values,
            normalize_embeddings=True,
            batch_size=32,
            convert_to_numpy=True,
        )
        return embeddings.tolist()
