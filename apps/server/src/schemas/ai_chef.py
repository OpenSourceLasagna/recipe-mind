from typing import Literal
from uuid import UUID

from pydantic import ConfigDict, Field

from src.schemas.ai_chef_tools import RecipePatch
from src.schemas.camel_model import CamelModel


class AIChefMessage(CamelModel):
    model_config = ConfigDict(extra="allow")

    role: Literal["user", "assistant"] = Field(..., pattern="^(user|assistant)$")
    content: str


class AIChefChatRequest(CamelModel):
    message: str = Field(..., min_length=1, max_length=2000)
    conversation_history: list[AIChefMessage] = Field(
        default_factory=list[AIChefMessage]
    )
    current_recipe_id: UUID | None = None


class AIChefStructuredOutput(CamelModel):
    model_config = ConfigDict(extra="forbid")

    text: str = Field(description="Friendly conversational explanation for the user.")
    recipe_ids: list[str] | None = Field(
        default=None,
        description="UUIDs of recipes to recommend, if any.",
    )
    recipe_patch: RecipePatch | None = Field(
        default=None,
        description=(
            "Modifications to apply to the current recipe. "
            "Only include fields you want to change; "
            "set all other fields to null. "
            "MUST call get_recipe_by_id before using this field."
        ),
    )
