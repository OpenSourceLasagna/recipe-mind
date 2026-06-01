
from functools import lru_cache

from ..schemas.settings import Settings

settings = Settings() # type: ignore

@lru_cache
def get_settings() -> Settings:
    return settings