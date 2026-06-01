
from typing import Protocol

class BaseEmbeddingService(Protocol):

    def embed(self, value: str) -> list[float]:
        ...

    def embed_many(self, values: list[str]) -> list[list[float]]:
        ...