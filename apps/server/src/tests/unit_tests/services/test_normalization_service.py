from unittest.mock import patch

import pytest

from src.services.normalization_service import NormalizationService


class TestNormalizationService:
    def test_normalize_word_strips_whitespace(self):
        service = NormalizationService()
        result = service.normalize_word("  Hello World  ")
        assert result == "hello world"

    def test_normalize_word_lowercases(self):
        service = NormalizationService()
        result = service.normalize_word("RUNNING")
        assert result == "running"

    def test_normalize_word_handles_empty_string(self):
        service = NormalizationService()
        result = service.normalize_word("")
        assert result == ""

    def test_normalize_word_handles_special_characters(self):
        service = NormalizationService()
        result = service.normalize_word("  MIXED-CASE_String!  ")
        assert result == "mixed-case_string!"

    @patch("src.services.normalization_service.WordNetLemmatizer")
    def test_normalize_word_delegates_to_lemmatizer(self, mock_lemmatizer_cls):
        mock_lemmatizer = mock_lemmatizer_cls.return_value
        mock_lemmatizer.lemmatize.return_value = "improved"

        service = NormalizationService()
        result = service.normalize_word("improving")

        mock_lemmatizer.lemmatize.assert_called_once_with("improving")
        assert result == "improved"

    @patch("src.services.normalization_service.WordNetLemmatizer")
    def test_normalize_word_multiple_calls(self, mock_lemmatizer_cls):
        mock_lemmatizer = mock_lemmatizer_cls.return_value
        mock_lemmatizer.lemmatize.side_effect = lambda w: w

        service = NormalizationService()
        result1 = service.normalize_word("  Apples  ")
        result2 = service.normalize_word("  Oranges  ")

        assert result1 == "apples"
        assert result2 == "oranges"
        assert mock_lemmatizer.lemmatize.call_count == 2

    @patch("src.services.normalization_service.WordNetLemmatizer")
    @pytest.mark.parametrize(
        "input_word,expected_after_strip_lower",
        [
            ("\tTomato\n", "tomato"),
            ("  Olive Oil  ", "olive oil"),
            ("SALT", "salt"),
            ("  ground black pepper  ", "ground black pepper"),
        ],
    )
    def test_normalize_word_whitespace_variations(
        self, mock_lemmatizer_cls, input_word, expected_after_strip_lower
    ):
        mock_lemmatizer = mock_lemmatizer_cls.return_value
        mock_lemmatizer.lemmatize.side_effect = lambda w: w

        service = NormalizationService()
        result = service.normalize_word(input_word)

        mock_lemmatizer.lemmatize.assert_called_once_with(expected_after_strip_lower)
        assert result == expected_after_strip_lower
