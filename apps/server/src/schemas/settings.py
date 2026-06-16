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

    ai_chef_model_name: str = "gpt-5.4-nano"
    ai_chef_max_tokens: int = 800
    ai_chef_temperature: float = 0.3
    prompt_guard_model_name: str = "gravitee-io/Llama-Prompt-Guard-2-86M-onnx"
    prompt_guard_threshold: float = 0.6
    moderation_threshold: float = 0.5
    ai_chef_rate_limit_rpm: int = 10
    ai_chef_max_iterations: int = 5
    max_history_messages: int = 10

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_ignore_empty=True,
        extra="ignore",
    )
