import pytest


class TestEmbeddingService:
    @pytest.mark.asyncio
    async def test_embed_calls_openai_and_returns_embedding(
        self, embedding_service, mock_openai_embedding_client
    ):
        result = await embedding_service.embed("test text")

        mock_openai_embedding_client.embeddings.create.assert_called_once_with(
            input="test text", model="text-embedding-3-small"
        )
        assert result == [0.1, 0.2, 0.3]

    @pytest.mark.asyncio
    async def test_embed_many_calls_openai_with_list(
        self, embedding_service, mock_openai_embedding_client
    ):
        texts = ["first", "second"]
        result = await embedding_service.embed_many(texts)

        mock_openai_embedding_client.embeddings.create.assert_called_once_with(
            input=texts, model="text-embedding-3-small"
        )
        assert result == [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]]

    @pytest.mark.asyncio
    async def test_embed_empty_string(
        self, embedding_service, mock_openai_embedding_client
    ):
        await embedding_service.embed("")
        mock_openai_embedding_client.embeddings.create.assert_called_once_with(
            input="", model="text-embedding-3-small"
        )

    @pytest.mark.asyncio
    async def test_embed_many_empty_list(
        self, embedding_service, mock_openai_embedding_client
    ):
        mock_openai_embedding_client.embeddings.create.return_value.data = []
        result = await embedding_service.embed_many([])
        assert result == []

    @pytest.mark.asyncio
    async def test_embed_uses_correct_model_from_settings(
        self, embedding_service, mock_openai_embedding_client, mock_settings
    ):
        await embedding_service.embed("test")
        call_kwargs = mock_openai_embedding_client.embeddings.create.call_args[1]
        assert call_kwargs["model"] == mock_settings.embedding_model_name
