from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    database_url: str = "postgresql://stonegate:change_me_local_only@localhost:5432/stonegate"
    redis_url: str = "redis://localhost:6379"
    chroma_host: str = "localhost"
    chroma_port: int = 8002
    voyage_api_key: str | None = None
    embedding_provider: str = "voyage"
    embedding_model: str = "voyage-3-large"
    embedding_dim: int = 1024
    anthropic_api_key: str | None = None
    anthropic_fast_model: str = "claude-haiku-4-5-20251001"
    blob_storage_dir: str = "/app/data/blobs"
    master_encryption_key: str | None = None


@lru_cache
def get_settings() -> Settings:
    return Settings()
