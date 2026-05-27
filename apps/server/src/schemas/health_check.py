
from pydantic import BaseModel


class HealthCheckResponse(BaseModel):
    status: str
    base_provider: bool = False
    ai: bool = False
