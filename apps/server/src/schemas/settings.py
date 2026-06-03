from pydantic import PostgresDsn
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    supabase_url: str
    supabase_key: str
    database_url: PostgresDsn
    openai_api_key: str
    embedding_model_name: str
    embedding_size: int
    local_model_path: str = "./models"
    local_embedding_model_name: str
    local_embedding_size: int
    reranking_model_name: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"
    debug: bool = False
    log_level: str = "INFO"
    cors_origins: set[str] = set()


    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_ignore_empty=True,
        extra="ignore",
    )