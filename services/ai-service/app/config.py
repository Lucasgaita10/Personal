from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Postgres
    database_url: str = "postgresql://stonegate:change_me_local_only@localhost:5432/stonegate"

    # Redis
    redis_url: str = "redis://localhost:6379"

    # ChromaDB
    chroma_host: str = "localhost"
    chroma_port: int = 8002

    # Anthropic
    anthropic_api_key: str | None = None
    anthropic_default_model: str = "claude-sonnet-4-6"
    anthropic_reasoning_model: str = "claude-opus-4-7"
    anthropic_fast_model: str = "claude-haiku-4-5-20251001"

    # Voyage / embeddings
    voyage_api_key: str | None = None
    embedding_provider: str = "voyage"
    embedding_model: str = "voyage-3-large"
    embedding_dim: int = 1024

    # Feature flags
    enable_prompt_caching: bool = True
    enable_hybrid_retrieval: bool = True

    blob_storage_dir: str = "/app/data/blobs"


@lru_cache
def get_settings() -> Settings:
    return Settings()
