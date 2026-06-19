from typing import Literal

from pydantic import BaseModel


class HealthCheckResponse(BaseModel):
    status: str
    base_provider: bool = False
    ai: bool = False


class LivenessResponse(BaseModel):
    status: Literal["alive"] = "alive"


class ReadinessResponse(BaseModel):
    status: Literal["ready", "not_ready"]
    database: Literal["healthy", "unhealthy"]
    ai: Literal["healthy", "unhealthy"]
    supabase: Literal["healthy", "unhealthy"]
