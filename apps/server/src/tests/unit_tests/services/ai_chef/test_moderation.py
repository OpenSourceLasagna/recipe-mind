from unittest.mock import AsyncMock, MagicMock

import pytest

from src.services.ai_chef.moderation_service import ModerationService


@pytest.fixture
def moderation_service() -> ModerationService:
    client = AsyncMock()
    return ModerationService(client=client, threshold=0.5)


@pytest.mark.asyncio
async def test_is_safe_clean_content(moderation_service: ModerationService):
    result = await moderation_service.is_safe("How do I make pasta?")
    assert result is True


@pytest.mark.asyncio
async def test_is_safe_flagged_content(moderation_service: ModerationService):
    flagged_result = MagicMock()
    flagged_result.flagged = True
    flagged_result.category_scores.model_dump.return_value = {}

    moderation_service._client.moderations.create.return_value = MagicMock(
        results=[flagged_result]
    )

    result = await moderation_service.is_safe("hate speech example")
    assert result is False


@pytest.mark.asyncio
async def test_is_safe_high_score(moderation_service: ModerationService):
    score_result = MagicMock()
    score_result.flagged = False
    score_result.category_scores.model_dump.return_value = {"hate": 0.9}

    moderation_service._client.moderations.create.return_value = MagicMock(
        results=[score_result]
    )

    result = await moderation_service.is_safe("borderline content")
    assert result is False


@pytest.mark.asyncio
async def test_is_safe_api_failure_fails_closed_by_default(
    moderation_service: ModerationService,
):
    moderation_service._client.moderations.create.side_effect = RuntimeError("API down")

    result = await moderation_service.is_safe("hello")
    assert result is False


@pytest.mark.asyncio
async def test_is_safe_api_failure_fails_open_when_opted_in():
    client = AsyncMock()
    client.moderations.create.side_effect = RuntimeError("API down")
    service = ModerationService(client=client, threshold=0.5, fail_open=True)

    result = await service.is_safe("hello")
    assert result is True
