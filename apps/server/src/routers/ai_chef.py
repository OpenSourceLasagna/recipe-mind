from collections.abc import AsyncGenerator

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from src.dependencies.auth import CurrentUserID, current_user_id_dep
from src.dependencies.services import AIChefSvc
from src.schemas.ai_chef import AIChefChatRequest

router_v1 = APIRouter(
    prefix="/v1/ai-chef",
    tags=["v1", "ai-chef"],
    dependencies=[current_user_id_dep],
)


@router_v1.post("/chat")
async def chat(
    request: AIChefChatRequest,
    current_user_id: CurrentUserID,
    ai_chef_service: AIChefSvc,
) -> StreamingResponse:
    async def _generator() -> AsyncGenerator[str, None]:
        async for event in ai_chef_service.stream_chat(request, current_user_id):
            yield event

    return StreamingResponse(
        _generator(),
        media_type="text/event-stream",
    )
