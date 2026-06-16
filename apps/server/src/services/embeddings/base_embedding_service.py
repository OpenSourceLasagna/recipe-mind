from typing import Protocol


class BaseEmbeddingService(Protocol):
    async def embed(self, value: str) -> list[float]: ...

    async def embed_many(self, values: list[str]) -> list[list[float]]: ...
