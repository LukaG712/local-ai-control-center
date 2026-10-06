from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Local AI Control Center"
    ollama_base_url: str = "http://127.0.0.1:11434"
    database_url: str = "sqlite:///./data/local-ai-control-center.db"
    host: str = "127.0.0.1"
    port: int = 8000
    request_timeout_seconds: float = 10.0

    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[3] / ".env",
        env_prefix="LACC_",
        extra="ignore",
    )


settings = Settings()
