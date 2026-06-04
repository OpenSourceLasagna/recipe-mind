from sentence_transformers import SentenceTransformer

from src.services.embeddings.base_embedding_service import BaseEmbeddingService
from src.utils.get_save_model import get_save_sentence_transformer_path


class LocalEmbeddingService(BaseEmbeddingService):
    def __init__(self, base_path: str, model_name: str):
        saved_path = get_save_sentence_transformer_path(
            base_path=base_path,
            model_name=model_name,
        )

        self.embedding_model = SentenceTransformer(str(saved_path), device="cpu")

    def embed(self, value: str) -> list[float]:
        embedding = self.embedding_model.encode(inputs=value, normalize_embeddings=True, convert_to_numpy=True) # type: ignore
        return embedding.tolist()

    def embed_many(self, values: list[str]) -> list[list[float]]:
        embeddings = self.embedding_model.encode(values, normalize_embeddings=True, batch_size=32, convert_to_numpy=True) # type: ignore
        return embeddings.tolist()