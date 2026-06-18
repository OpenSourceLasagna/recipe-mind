from typing import Literal

from pydantic import ConfigDict, Field

from src.schemas.camel_model import CamelModel


class ExtractRecipeRequest(CamelModel):
    source: Literal["text", "image", "url"] = Field(
        description="The type of unstructured input to extract a recipe from"
    )
    content: str = Field(
        min_length=1,
        description=(
            "Raw recipe text, base64-encoded image (jpeg/png), or a recipe website URL"
        ),
    )

    model_config = ConfigDict(
        extra="forbid",
        json_schema_extra={
            "examples": [
                {
                    "source": "text",
                    "content": "Grandma's Cookies\n2 cups flour\n1 cup sugar\n...",
                },
                {
                    "source": "image",
                    "content": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk...",
                },
                {
                    "source": "url",
                    "content": "https://www.example.com/recipes/chocolate-chip-cookies",
                },
            ]
        },
    )
