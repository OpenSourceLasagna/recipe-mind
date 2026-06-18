import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from openai import AsyncOpenAI

from src.schemas.recipe import CreateRecipeRequest
from src.schemas.recipe_extraction import ExtractRecipeRequest
from src.schemas.settings import Settings
from src.services.recipe_extraction_service import (
    ExtractionError,
    RecipeExtractionService,
    UrlValidationError,
    assert_safe_url,
)


def _make_mock_openai_response(content: str) -> MagicMock:
    choice = MagicMock()
    choice.message.content = content
    completion = MagicMock()
    completion.choices = [choice]
    return completion


def _full_recipe_json() -> dict:
    return {
        "title": "Grandma's Chocolate Chip Cookies",
        "ingredients": [
            {"ingredientName": "flour", "quantity": 2.0, "unit": "cups"},
            {"ingredientName": "sugar", "quantity": 1.0, "unit": "cup"},
            {"ingredientName": "butter", "quantity": 0.5, "unit": "cup"},
            {"ingredientName": "chocolate chips", "quantity": 1.5, "unit": "cups"},
            {"ingredientName": "eggs", "quantity": 2.0, "unit": ""},
        ],
        "additionalInformation": ["Best served warm"],
        "instructionSteps": [
            "Preheat oven to 350F",
            "Mix flour and sugar",
            "Add butter and eggs",
            "Fold in chocolate chips",
            "Bake for 12 minutes",
        ],
        "nutrition": {"calories": 250, "protein": 3.0, "carbs": 35.0, "fat": 12.0},
        "servings": 24,
        "durationMinutes": 30,
        "difficulty": "easy",
        "spiceLevel": 1,
        "origin": "American",
        "isPublic": False,
    }


def _make_mock_scraper(
    title: str = "Test Recipe",
    ingredients: list[str] | None = None,
    instructions: list[str] | None = None,
    yields: str = "4 servings",
    total_time: int = 30,
    nutrients: dict | None = None,
    description: str = "",
) -> MagicMock:
    scraper = MagicMock()
    scraper.title.return_value = title
    scraper.ingredients.return_value = ingredients or ["2 cups flour", "1 cup sugar"]
    scraper.instructions_list.return_value = instructions or [
        "Preheat oven to 350F",
        "Mix ingredients",
        "Bake for 30 minutes",
    ]
    scraper.yields.return_value = yields
    scraper.total_time.return_value = total_time
    scraper.nutrients.return_value = nutrients or {}
    scraper.description.return_value = description
    return scraper


@pytest.fixture
def mock_settings() -> Settings:
    return Settings(
        supabase_url="https://example.supabase.co",
        supabase_key="test-key",
        database_url="postgresql+asyncpg://user:pass@localhost:5432/db",
        openai_api_key="sk-test",
        embedding_model_name="text-embedding-3-small",
        embedding_size=1536,
        local_embedding_model_name="nomic-embed-text-v1.5",
        local_embedding_size=768,
        extraction_text_model_name="gpt-4o-mini",
        extraction_image_model_name="gpt-4o",
        extraction_max_tokens=2048,
    )


@pytest.fixture
def mock_openai() -> MagicMock:
    return MagicMock(spec=AsyncOpenAI)


@pytest.fixture
def service(mock_openai: MagicMock, mock_settings: Settings) -> RecipeExtractionService:
    return RecipeExtractionService(client=mock_openai, settings=mock_settings)


class TestRecipeExtractionService:
    async def test_extract_full_text_recipe(
        self, service: RecipeExtractionService, mock_openai: MagicMock
    ):
        response = _make_mock_openai_response(json.dumps(_full_recipe_json()))
        mock_openai.chat.completions.create = AsyncMock(return_value=response)

        request = ExtractRecipeRequest(
            source="text",
            content="Grandma's Chocolate Chip Cookies\nIngredients:\n- 2 cups flour\n...",
        )
        result = await service.extract(request)

        assert isinstance(result, CreateRecipeRequest)
        assert result.title == "Grandma's Chocolate Chip Cookies"
        assert len(result.ingredients) == 5
        assert result.ingredients[0].ingredient_name == "flour"
        assert result.ingredients[0].quantity == 2.0
        assert result.ingredients[0].unit == "cups"
        assert len(result.instruction_steps) == 5
        assert result.servings == 24
        assert result.difficulty == "easy"
        assert result.spice_level == 1
        assert result.origin == "American"
        assert result.nutrition.calories == 250
        assert result.nutrition.protein == 3.0
        assert result.nutrition.carbs == 35.0
        assert result.nutrition.fat == 12.0
        assert result.additional_information == ["Best served warm"]

    async def test_extract_uses_text_model_for_text_source(
        self, service: RecipeExtractionService, mock_openai: MagicMock
    ):
        response = _make_mock_openai_response(json.dumps(_full_recipe_json()))
        mock_openai.chat.completions.create = AsyncMock(return_value=response)

        request = ExtractRecipeRequest(source="text", content="Some recipe text")
        await service.extract(request)

        call_kwargs = mock_openai.chat.completions.create.call_args.kwargs
        assert call_kwargs["model"] == "gpt-4o-mini"
        assert call_kwargs["max_completion_tokens"] == 2048
        assert "response_format" in call_kwargs
        rf = call_kwargs["response_format"]
        assert rf["type"] == "json_schema"
        assert rf["json_schema"]["name"] == "recipe_extraction"
        assert rf["json_schema"]["strict"] is True

    async def test_extract_uses_vision_model_for_image_source(
        self, service: RecipeExtractionService, mock_openai: MagicMock
    ):
        response = _make_mock_openai_response(json.dumps(_full_recipe_json()))
        mock_openai.chat.completions.create = AsyncMock(return_value=response)

        request = ExtractRecipeRequest(source="image", content="iVBORw0KGgo...")
        await service.extract(request)

        call_kwargs = mock_openai.chat.completions.create.call_args.kwargs
        assert call_kwargs["model"] == "gpt-4o"
        messages = call_kwargs["messages"]
        user_content = messages[1]["content"]
        assert isinstance(user_content, list)
        assert user_content[0]["type"] == "image_url"
        assert user_content[0]["image_url"]["url"].startswith("data:image/jpeg;base64,")
        assert user_content[0]["image_url"]["detail"] == "high"

    async def test_extract_text_llm_empty_response(
        self, service: RecipeExtractionService, mock_openai: MagicMock
    ):
        choice = MagicMock()
        choice.message.content = ""
        completion = MagicMock()
        completion.choices = [choice]
        mock_openai.chat.completions.create = AsyncMock(return_value=completion)

        request = ExtractRecipeRequest(source="text", content="Some recipe")
        with pytest.raises(ExtractionError, match="empty response"):
            await service.extract(request)

    async def test_extract_text_llm_malformed_json(
        self, service: RecipeExtractionService, mock_openai: MagicMock
    ):
        response = _make_mock_openai_response("not valid json {{{")
        mock_openai.chat.completions.create = AsyncMock(return_value=response)

        request = ExtractRecipeRequest(source="text", content="Some recipe")
        with pytest.raises(ExtractionError, match="Failed to parse"):
            await service.extract(request)

    async def test_extract_text_minimal_recipe(
        self, service: RecipeExtractionService, mock_openai: MagicMock
    ):
        minimal = {
            "title": "Toast",
            "ingredients": [
                {"ingredientName": "bread", "quantity": 1.0, "unit": "slice"}
            ],
            "additionalInformation": [],
            "instructionSteps": ["Toast bread"],
            "nutrition": {},
            "servings": 1,
            "durationMinutes": 5,
            "difficulty": "easy",
            "spiceLevel": 1,
            "origin": "Unknown",
            "isPublic": False,
        }
        response = _make_mock_openai_response(json.dumps(minimal))
        mock_openai.chat.completions.create = AsyncMock(return_value=response)

        request = ExtractRecipeRequest(source="text", content="Toast")
        result = await service.extract(request)

        assert result.title == "Toast"
        assert len(result.ingredients) == 1
        assert result.servings == 1

    async def test_extract_image_passes_base64_as_jpeg(
        self, service: RecipeExtractionService, mock_openai: MagicMock
    ):
        response = _make_mock_openai_response(json.dumps(_full_recipe_json()))
        mock_openai.chat.completions.create = AsyncMock(return_value=response)

        base64_content = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABC..."
        request = ExtractRecipeRequest(source="image", content=base64_content)
        await service.extract(request)

        messages = mock_openai.chat.completions.create.call_args.kwargs["messages"]
        user_content = messages[1]["content"]
        image_url = user_content[0]["image_url"]["url"]
        assert image_url == f"data:image/jpeg;base64,{base64_content}"

    async def test_extract_text_non_recipe_returns_valid_schema(
        self, service: RecipeExtractionService, mock_openai: MagicMock
    ):
        response = _make_mock_openai_response(json.dumps(_full_recipe_json()))
        mock_openai.chat.completions.create = AsyncMock(return_value=response)

        request = ExtractRecipeRequest(
            source="text", content="Hello world, this is not a recipe"
        )
        result = await service.extract(request)
        assert isinstance(result, CreateRecipeRequest)

    async def test_reuses_cached_schema(self, service: RecipeExtractionService):
        from src.services.recipe_extraction_service import _get_strict_schema

        schema1 = _get_strict_schema()
        schema2 = _get_strict_schema()
        assert schema1 is schema2


class TestRecipeExtractionServiceUrl:
    @pytest.fixture(autouse=True)
    def _mock_dns(self, monkeypatch):
        monkeypatch.setattr(
            "src.services.recipe_extraction_service._resolve_hostname",
            lambda h: ["93.184.216.34"],
        )

    async def test_extract_from_url_happy_path(
        self, service: RecipeExtractionService, mock_openai: MagicMock
    ):
        response = _make_mock_openai_response(json.dumps(_full_recipe_json()))
        mock_openai.chat.completions.create = AsyncMock(return_value=response)

        with patch(
            "src.services.recipe_extraction_service._scrape_url",
            return_value="scraped text",
        ):
            request = ExtractRecipeRequest(
                source="url",
                content="https://www.example.com/recipes/cookies",
            )
            result = await service.extract(request)

        assert isinstance(result, CreateRecipeRequest)
        assert result.title == "Grandma's Chocolate Chip Cookies"

    async def test_extract_from_url_passes_scraped_text_to_llm(
        self, service: RecipeExtractionService, mock_openai: MagicMock
    ):
        response = _make_mock_openai_response(json.dumps(_full_recipe_json()))
        mock_openai.chat.completions.create = AsyncMock(return_value=response)

        with patch(
            "src.services.recipe_extraction_service._scrape_url",
            return_value="Title: My Cookies\nIngredients:\n- 2 cups flour",
        ):
            request = ExtractRecipeRequest(
                source="url",
                content="https://www.example.com/recipes/cookies",
            )
            await service.extract(request)

        call_kwargs = mock_openai.chat.completions.create.call_args.kwargs
        messages = call_kwargs["messages"]
        content = messages[1]["content"]
        assert "Title: My Cookies" in content
        assert "2 cups flour" in content
        assert "BEGIN SCRAPED RECIPE CONTENT" in content
        assert call_kwargs["model"] == "gpt-4o-mini"

    async def test_extract_from_url_wraps_scraped_text_in_delimiters(
        self, service: RecipeExtractionService, mock_openai: MagicMock
    ):
        response = _make_mock_openai_response(json.dumps(_full_recipe_json()))
        mock_openai.chat.completions.create = AsyncMock(return_value=response)

        with patch(
            "src.services.recipe_extraction_service._scrape_url",
            return_value="Title: X\nIngredients: a, b",
        ):
            request = ExtractRecipeRequest(
                source="url",
                content="https://example.com/recipe",
            )
            await service.extract(request)

        call_kwargs = mock_openai.chat.completions.create.call_args.kwargs
        content = call_kwargs["messages"][1]["content"]
        assert "BEGIN SCRAPED RECIPE CONTENT" in content
        assert "END SCRAPED RECIPE CONTENT" in content
        assert "Title: X" in content

    async def test_extraction_prompt_instructs_ignore_non_recipe_content(
        self, service: RecipeExtractionService, mock_openai: MagicMock
    ):
        response = _make_mock_openai_response(json.dumps(_full_recipe_json()))
        mock_openai.chat.completions.create = AsyncMock(return_value=response)

        request = ExtractRecipeRequest(
            source="text",
            content="Some recipe text",
        )
        await service.extract(request)

        call_kwargs = mock_openai.chat.completions.create.call_args.kwargs
        system_prompt = call_kwargs["messages"][0]["content"]
        assert "DATA" in system_prompt or "instructions" in system_prompt.lower()

    async def test_extract_from_url_blocks_non_http_scheme(
        self, service: RecipeExtractionService
    ):
        request = ExtractRecipeRequest(
            source="url",
            content="ftp://example.com/recipes/cookies",
        )
        with pytest.raises(UrlValidationError, match="Only http and https"):
            await service.extract(request)

    async def test_extract_from_url_blocks_localhost(
        self, service: RecipeExtractionService
    ):
        request = ExtractRecipeRequest(
            source="url",
            content="http://localhost/recipes/cookies",
        )
        with pytest.raises(UrlValidationError, match="cannot be accessed"):
            await service.extract(request)

    async def test_extract_from_url_blocks_loopback_ip(
        self, service: RecipeExtractionService
    ):
        request = ExtractRecipeRequest(
            source="url",
            content="http://127.0.0.1/recipes/cookies",
        )
        with pytest.raises(UrlValidationError, match="cannot be accessed"):
            await service.extract(request)

    async def test_extract_from_url_blocks_private_ip(
        self, service: RecipeExtractionService
    ):
        request = ExtractRecipeRequest(
            source="url",
            content="http://10.0.0.1/recipes/cookies",
        )
        with pytest.raises(UrlValidationError, match="cannot be accessed"):
            await service.extract(request)

    async def test_extract_from_url_blocks_192_168(
        self, service: RecipeExtractionService
    ):
        request = ExtractRecipeRequest(
            source="url",
            content="http://192.168.1.1/recipes/cookies",
        )
        with pytest.raises(UrlValidationError, match="cannot be accessed"):
            await service.extract(request)

    async def test_extract_from_url_website_not_supported(
        self, service: RecipeExtractionService
    ):
        from recipe_scrapers import WebsiteNotImplementedError

        def raise_website_not_implemented(_url: str) -> str:
            raise WebsiteNotImplementedError("not-supported.example.com")

        with patch(
            "src.services.recipe_extraction_service._scrape_url",
            side_effect=raise_website_not_implemented,
        ):
            request = ExtractRecipeRequest(
                source="url",
                content="https://not-supported.example.com/recipe",
            )
            with pytest.raises(ExtractionError, match="not supported"):
                await service.extract(request)

    async def test_extract_from_url_connection_error(
        self, service: RecipeExtractionService
    ):
        def raise_connection_error(_url: str) -> str:
            raise ExtractionError("Could not reach the URL: Connection refused")

        with patch(
            "src.services.recipe_extraction_service._scrape_url",
            side_effect=raise_connection_error,
        ):
            request = ExtractRecipeRequest(
                source="url",
                content="https://down.example.com/recipe",
            )
            with pytest.raises(ExtractionError, match="Could not reach the URL"):
                await service.extract(request)

    async def test_extract_from_url_empty_scraped_content(
        self, service: RecipeExtractionService
    ):
        with patch(
            "src.services.recipe_extraction_service._scrape_url",
            return_value="",
        ):
            request = ExtractRecipeRequest(
                source="url",
                content="https://empty.example.com/recipe",
            )
            with pytest.raises(ExtractionError, match="No recipe content found"):
                await service.extract(request)

    async def test_extract_from_url_whitespace_only_scraped_content(
        self, service: RecipeExtractionService
    ):
        with patch(
            "src.services.recipe_extraction_service._scrape_url",
            return_value="   \n  \t  ",
        ):
            request = ExtractRecipeRequest(
                source="url",
                content="https://blank.example.com/recipe",
            )
            with pytest.raises(ExtractionError, match="No recipe content found"):
                await service.extract(request)

    async def test_extract_from_url_llm_empty_response(
        self, service: RecipeExtractionService, mock_openai: MagicMock
    ):
        choice = MagicMock()
        choice.message.content = ""
        completion = MagicMock()
        completion.choices = [choice]
        mock_openai.chat.completions.create = AsyncMock(return_value=completion)

        with patch(
            "src.services.recipe_extraction_service._scrape_url",
            return_value="Title: Test\nIngredients:\n- 1 cup flour",
        ):
            request = ExtractRecipeRequest(
                source="url",
                content="https://example.com/recipe",
            )
            with pytest.raises(ExtractionError, match="empty response"):
                await service.extract(request)

    async def test_extract_from_url_unexpected_scrape_exception(
        self, service: RecipeExtractionService
    ):
        def raise_unexpected(_url: str) -> str:
            raise OSError("something went wrong")

        with patch(
            "src.services.recipe_extraction_service._scrape_url",
            side_effect=raise_unexpected,
        ):
            request = ExtractRecipeRequest(
                source="url",
                content="https://broken.example.com/recipe",
            )
            with pytest.raises(ExtractionError, match="Failed to extract"):
                await service.extract(request)

    async def test_extract_from_url_missing_hostname(
        self, service: RecipeExtractionService
    ):
        request = ExtractRecipeRequest(
            source="url",
            content="http:///path/to/recipe",
        )
        with pytest.raises(UrlValidationError, match="missing hostname"):
            await service.extract(request)


class TestAssertSafeUrlScheme:
    @pytest.mark.parametrize("scheme", ["ftp", "file", "javascript", "data"])
    def test_rejects_non_http_scheme(self, scheme: str):
        with pytest.raises(UrlValidationError, match="Only http and https"):
            assert_safe_url(f"{scheme}://example.com/")

    @pytest.mark.parametrize("scheme", ["http", "https"])
    def test_accepts_http_schemes_when_dns_returns_public_ip(
        self, scheme: str, monkeypatch
    ):
        monkeypatch.setattr(
            "src.services.recipe_extraction_service._resolve_hostname",
            lambda h: ["93.184.216.34"],
        )
        assert_safe_url(f"{scheme}://example.com/")


class TestAssertSafeUrlLocalhost:
    @pytest.mark.parametrize(
        "host",
        ["localhost", "LOCALHOST", "LocalHost", "localhost.localdomain"],
    )
    def test_blocks_localhost_aliases(self, host: str):
        with pytest.raises(UrlValidationError, match="cannot be accessed"):
            assert_safe_url(f"http://{host}/path")

    def test_blocks_localhost_with_trailing_dot(self):
        with pytest.raises(UrlValidationError, match="cannot be accessed"):
            assert_safe_url("http://localhost./path")


class TestAssertSafeUrlIPv4:
    @pytest.mark.parametrize(
        "host",
        [
            "127.0.0.1",
            "127.1.2.3",
            "127.255.255.254",
            "10.0.0.1",
            "10.255.255.255",
            "172.16.0.1",
            "172.31.255.255",
            "192.168.0.1",
            "192.168.255.255",
            "169.254.169.254",
            "169.254.0.1",
            "0.0.0.0",
            "255.255.255.255",
            "224.0.0.1",
            "240.0.0.1",
        ],
    )
    def test_blocks_unsafe_ipv4(self, host: str):
        with pytest.raises(UrlValidationError, match="cannot be accessed"):
            assert_safe_url(f"http://{host}/path")

    def test_blocks_decimal_ipv4(self, monkeypatch):
        monkeypatch.setattr(
            "src.services.recipe_extraction_service._resolve_hostname",
            lambda h: ["127.0.0.1"],
        )
        with pytest.raises(UrlValidationError, match="cannot be accessed"):
            assert_safe_url("http://2130706433/path")

    def test_blocks_octal_ipv4(self, monkeypatch):
        monkeypatch.setattr(
            "src.services.recipe_extraction_service._resolve_hostname",
            lambda h: ["127.0.0.1"],
        )
        with pytest.raises(UrlValidationError, match="cannot be accessed"):
            assert_safe_url("http://0177.0.0.1/path")


class TestAssertSafeUrlIPv6:
    @pytest.mark.parametrize(
        "url",
        [
            "http://[::1]/path",
            "http://[::]/path",
            "http://[fe80::1]/path",
            "http://[fc00::1]/path",
            "http://[fd00::1]/path",
            "http://[::ffff:127.0.0.1]/path",
        ],
    )
    def test_blocks_unsafe_ipv6(self, url: str):
        with pytest.raises(UrlValidationError, match="cannot be accessed"):
            assert_safe_url(url)


class TestAssertSafeUrlDNS:
    def test_blocks_when_dns_resolves_to_private_ip(self, monkeypatch):
        monkeypatch.setattr(
            "src.services.recipe_extraction_service._resolve_hostname",
            lambda h: ["192.168.1.1"],
        )
        with pytest.raises(UrlValidationError, match="cannot be accessed"):
            assert_safe_url("http://attacker-controlled.com/path")

    def test_blocks_when_dns_resolves_to_loopback(self, monkeypatch):
        monkeypatch.setattr(
            "src.services.recipe_extraction_service._resolve_hostname",
            lambda h: ["127.0.0.1"],
        )
        with pytest.raises(UrlValidationError, match="cannot be accessed"):
            assert_safe_url("http://attacker-controlled.com/path")

    def test_blocks_when_dns_resolves_to_link_local(self, monkeypatch):
        monkeypatch.setattr(
            "src.services.recipe_extraction_service._resolve_hostname",
            lambda h: ["169.254.169.254"],
        )
        with pytest.raises(UrlValidationError, match="cannot be accessed"):
            assert_safe_url("http://metadata.aws/")

    def test_blocks_when_any_resolved_ip_is_unsafe(self, monkeypatch):
        monkeypatch.setattr(
            "src.services.recipe_extraction_service._resolve_hostname",
            lambda h: ["93.184.216.34", "10.0.0.1"],
        )
        with pytest.raises(UrlValidationError, match="cannot be accessed"):
            assert_safe_url("http://multi-hosted.com/")

    def test_blocks_when_dns_cannot_resolve(self, monkeypatch):
        monkeypatch.setattr(
            "src.services.recipe_extraction_service._resolve_hostname",
            lambda h: [],
        )
        with pytest.raises(UrlValidationError, match="Could not resolve"):
            assert_safe_url("http://nonexistent.invalid/")

    def test_accepts_when_dns_resolves_to_public_ip(self, monkeypatch):
        monkeypatch.setattr(
            "src.services.recipe_extraction_service._resolve_hostname",
            lambda h: ["93.184.216.34"],
        )
        assert_safe_url("http://example.com/recipe")


class TestAssertSafeUrlFalsePositives:
    def test_does_not_block_hostname_ending_in_zero(self, monkeypatch):
        monkeypatch.setattr(
            "src.services.recipe_extraction_service._resolve_hostname",
            lambda h: ["93.184.216.34"],
        )
        assert_safe_url("http://example0.com/")

    def test_does_not_block_public_hostname(self, monkeypatch):
        monkeypatch.setattr(
            "src.services.recipe_extraction_service._resolve_hostname",
            lambda h: ["93.184.216.34"],
        )
        assert_safe_url("https://www.allrecipes.com/recipe/12345/")
