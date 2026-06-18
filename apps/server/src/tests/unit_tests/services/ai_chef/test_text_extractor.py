from src.services.ai_chef.text_extractor import TextExtractor


class TestTextExtractorBasic:
    def test_returns_empty_before_text_key_found(self):
        extractor = TextExtractor("text")
        result = extractor.feed('{"recipeIds": null, "')
        assert result == ""

    def test_extracts_text_value_when_key_found(self):
        extractor = TextExtractor("text")
        result = extractor.feed('"text": "Hello world"')
        assert result == "Hello world"

    def test_extracts_text_from_middle_of_object(self):
        extractor = TextExtractor("text")
        result = extractor.feed('{"recipeIds": null, "text": "Found recipes!"}')
        assert result == "Found recipes!"

    def test_returns_empty_after_text_field_closed(self):
        extractor = TextExtractor("text")
        extractor.feed('"text": "Hello"')
        result = extractor.feed(', "recipeIds": null}')
        assert result == ""

    def test_handles_text_key_at_start(self):
        extractor = TextExtractor("text")
        result = extractor.feed('{"text": "First field"}')
        assert result == "First field"


class TestTextExtractorIncremental:
    def test_accumulates_across_multiple_feeds(self):
        extractor = TextExtractor("text")
        r1 = extractor.feed('{"text": "Hel')
        r2 = extractor.feed("lo ")
        r3 = extractor.feed('world"}')
        assert r1 + r2 + r3 == "Hello world"

    def test_handles_key_split_across_chunks(self):
        extractor = TextExtractor("text")
        r1 = extractor.feed('{"tex')
        r2 = extractor.feed('t": "value"}')
        assert r1 + r2 == "value"

    def test_handles_quote_after_key_split(self):
        extractor = TextExtractor("text")
        r1 = extractor.feed('{"text')
        r2 = extractor.feed('": "content"}')
        assert r1 + r2 == "content"

    def test_handles_colon_split(self):
        extractor = TextExtractor("text")
        r1 = extractor.feed('{"text"')
        r2 = extractor.feed(': "value"}')
        assert r1 + r2 == "value"

    def test_handles_value_split_across_chunks(self):
        extractor = TextExtractor("text")
        r1 = extractor.feed('{"text": "He')
        r2 = extractor.feed('llo"}')
        assert r1 + r2 == "Hello"


class TestTextExtractorEscapes:
    def test_handles_escaped_quote(self):
        extractor = TextExtractor("text")
        result = extractor.feed(r'"text": "She said \"hello\""')
        assert result == r'She said "hello"'

    def test_handles_escaped_backslash(self):
        extractor = TextExtractor("text")
        result = extractor.feed(r'"text": "path\\to\\file"')
        assert result == r"path\to\file"

    def test_handles_newline_escape(self):
        extractor = TextExtractor("text")
        result = extractor.feed(r'"text": "line1\nline2"')
        assert result == "line1\nline2"

    def test_handles_tab_escape(self):
        extractor = TextExtractor("text")
        result = extractor.feed(r'"text": "col1\tcol2"')
        assert result == "col1\tcol2"

    def test_handles_unicode_escape(self):
        extractor = TextExtractor("text")
        result = extractor.feed(r'"text": "caf\u00e9"')
        assert result == "café"

    def test_handles_split_escape_at_boundary(self):
        extractor = TextExtractor("text")
        r1 = extractor.feed(r'"text": "say \"')
        r2 = extractor.feed(r'hello\""')
        assert r1 + r2 == r'say "hello"'

    def test_handles_split_unicode_escape(self):
        extractor = TextExtractor("text")
        r1 = extractor.feed(r'"text": "caf\u00')
        r2 = extractor.feed(r'e9"')
        assert r1 + r2 == "café"

    def test_handles_escape_split_mid_sequence(self):
        extractor = TextExtractor("text")
        r1 = extractor.feed(r'"text": "a\n')
        r2 = extractor.feed(r'b"')
        assert r1 + r2 == "a\nb"


class TestTextExtractorEdgeCases:
    def test_empty_text_value(self):
        extractor = TextExtractor("text")
        result = extractor.feed('"text": ""')
        assert result == ""

    def test_text_with_spaces(self):
        extractor = TextExtractor("text")
        result = extractor.feed('"text": "  spaced  "')
        assert result == "  spaced  "

    def test_no_text_field_at_all(self):
        extractor = TextExtractor("text")
        result = extractor.feed('{"recipeIds": null, "recipePatch": null}')
        assert result == ""

    def test_null_text_value(self):
        extractor = TextExtractor("text")
        result = extractor.feed('"text": null')
        assert result == ""

    def test_whitespace_before_colon(self):
        extractor = TextExtractor("text")
        result = extractor.feed('"text" : "value"')
        assert result == "value"

    def test_no_whitespace(self):
        extractor = TextExtractor("text")
        result = extractor.feed('{"text":"value"}')
        assert result == "value"

    def test_single_char_at_a_time(self):
        extractor = TextExtractor("text")
        json_str = '{"text": "Hi"}'
        results = [extractor.feed(c) for c in json_str]
        assert "".join(results) == "Hi"

    def test_similar_key_name_not_matched(self):
        extractor = TextExtractor("text")
        result = extractor.feed('{"textContent": "wrong", "text": "right"}')
        assert result == "right"

    def test_key_as_substring_of_another(self):
        extractor = TextExtractor("text")
        result = extractor.feed('{"mytext": "no", "text": "yes"}')
        assert result == "yes"
