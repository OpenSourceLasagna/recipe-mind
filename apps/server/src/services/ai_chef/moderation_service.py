import logging

from openai import AsyncOpenAI

logger = logging.getLogger(__name__)


class ModerationService:
    def __init__(self, client: AsyncOpenAI, threshold: float):
        self._client = client
        self._threshold = threshold

    async def is_safe(self, text: str) -> bool:
        try:
            response = await self._client.moderations.create(input=text)
        except Exception:
            logger.exception("OpenAI moderation call failed; failing open")
            return True

        for result in response.results:
            if result.flagged:
                logger.warning("OpenAI moderation flagged content")
                return False

            scores = result.category_scores.model_dump()
            if any(score > self._threshold for score in scores.values()):
                logger.warning("OpenAI moderation score exceeded threshold")
                return False

        return True
