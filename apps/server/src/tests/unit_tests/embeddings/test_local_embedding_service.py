from pathlib import Path
from unittest.mock import MagicMock, patch

import numpy as np

from src.services.embeddings.local_embedding_service import LocalEmbeddingService


class TestLocalEmbeddingService:
    @patch("src.services.embeddings.local_embedding_service.SentenceTransformer")
    @patch(
        "src.services.embeddings.local_embedding_service.get_save_sentence_transformer_path"
    )
    def test_embed_returns_list_of_floats(
        self, mock_get_path, mock_st_cls, mock_settings
    ):
        mock_get_path.return_value = Path("/fake/models/nomic-embed-text-v1.5")
        mock_st = MagicMock()
        mock_st.encode.return_value = np.array([0.1, 0.2, 0.3])
        mock_st_cls.return_value = mock_st

        service = LocalEmbeddingService(settings=mock_settings)
        result = service.embed("test")

        assert isinstance(result, list)
        assert all(isinstance(v, float) for v in result)
        assert result == [0.1, 0.2, 0.3]

    @patch("src.services.embeddings.local_embedding_service.SentenceTransformer")
    @patch(
        "src.services.embeddings.local_embedding_service.get_save_sentence_transformer_path"
    )
    def test_embed_many_returns_list_of_lists(
        self, mock_get_path, mock_st_cls, mock_settings
    ):
        mock_get_path.return_value = Path("/fake/models/nomic-embed-text-v1.5")
        mock_st = MagicMock()
        mock_st.encode.return_value = np.array([[0.1, 0.2], [0.3, 0.4]])
        mock_st_cls.return_value = mock_st

        service = LocalEmbeddingService(settings=mock_settings)
        result = service.embed_many(["a", "b"])

        assert isinstance(result, list)
        assert len(result) == 2
        assert result == [[0.1, 0.2], [0.3, 0.4]]

    @patch("src.services.embeddings.local_embedding_service.SentenceTransformer")
    @patch(
        "src.services.embeddings.local_embedding_service.get_save_sentence_transformer_path"
    )
    def test_embed_normalizes_embeddings(
        self, mock_get_path, mock_st_cls, mock_settings
    ):
        mock_get_path.return_value = Path("/fake/models/nomic-embed-text-v1.5")
        mock_st = MagicMock()
        mock_st.encode.return_value = np.array([3.0, 4.0])
        mock_st_cls.return_value = mock_st

        service = LocalEmbeddingService(settings=mock_settings)
        service.embed("test")

        call_kwargs = mock_st.encode.call_args[1]
        assert call_kwargs.get("normalize_embeddings") is True

    @patch("src.services.embeddings.local_embedding_service.SentenceTransformer")
    @patch(
        "src.services.embeddings.local_embedding_service.get_save_sentence_transformer_path"
    )
    def test_uses_get_save_model_path(
        self, mock_get_path, mock_st_cls, mock_settings
    ):
        expected_path = Path("/fake/models/nomic-embed-text-v1.5")
        mock_get_path.return_value = expected_path
        mock_st = MagicMock()
        mock_st_cls.return_value = mock_st

        LocalEmbeddingService(settings=mock_settings)

        mock_get_path.assert_called_once_with(
            base_path=mock_settings.local_model_path,
            model_name=mock_settings.local_embedding_model_name,
        )
        mock_st_cls.assert_called_once_with(str(expected_path), device="cpu")
