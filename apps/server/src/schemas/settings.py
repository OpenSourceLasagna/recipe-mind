from pydantic import PostgresDsn
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    supabase_url: str
    supabase_key: str
    database_url: PostgresDsn
    openai_api_key: str
    debug: bool = False
    log_level: str = "INFO"
    cors_origins: set[str] = set()

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"