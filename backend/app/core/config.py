from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    app_name: str = "Marketing LLM API"
    debug: bool = False

    database_url: str = "postgresql://marketing:marketing@localhost:5432/marketing_llm"
    redis_url: str = "redis://localhost:6379/0"
    qdrant_url: str = "http://localhost:6333"

    secret_key: str = "change-me-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24

    anthropic_api_key: str = ""
    openai_api_key: str = ""

    brand_voice_min_score: int = 75
    lora_update_schedule: str = "0 2 * * *"

    celery_broker_url: str = "redis://localhost:6379/1"
    celery_result_backend: str = "redis://localhost:6379/2"

    class Config:
        env_file = ".env"


@lru_cache
def get_settings() -> Settings:
    return Settings()
