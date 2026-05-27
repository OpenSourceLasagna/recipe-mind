
from ..schemas.settings import Settings

settings = Settings() # type: ignore

def get_settings() -> Settings:
    return settings