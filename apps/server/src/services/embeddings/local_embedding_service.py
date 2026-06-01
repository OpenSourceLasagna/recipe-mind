
from pathlib import Path

from sentence_transformers import SentenceTransformer

from src.schemas.settings import Settings
from src.services.embeddings.base_embedding_service import BaseEmbeddingService

class LocalEmbeddingService(BaseEmbeddingService):
    def __init__(self, settings: Settings):
        model_path = Path(settings.local_embedding_model_path)

        if not model_path.exists():
            print(f"Downloading model {settings.local_embedding_model_name} to {model_path}...")
            model = SentenceTransformer(settings.local_embedding_model_name, device="cpu")
            model.save(str(model_path))
            print("Model downloaded and saved locally.")
        else:
            print(f"Loading model from {model_path}...")

        self.embedding_model = SentenceTransformer(str(model_path), device="cpu")

    def embed(self, value: str) -> list[float]:
        embedding = self.embedding_model.encode(inputs=value, normalize_embeddings=True, convert_to_numpy=True) # type: ignore
        return embedding.tolist()
    
    def embed_many(self, values: list[str]) -> list[list[float]]:
        embeddings = self.embedding_model.encode(values, normalize_embeddings=True, batch_size=32, convert_to_numpy=True) # type: ignore
        return embeddings.tolist()