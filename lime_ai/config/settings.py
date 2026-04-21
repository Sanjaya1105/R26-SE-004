from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_NAME: str = "LIME AI Service"
    APP_VERSION: str = "0.1.0"
    API_PREFIX: str = "/api/v1"

    DB_HOST: str = "localhost"
    DB_PORT: int = 3306
    DB_USER: str = "root"
    DB_PASSWORD: str = ""
    DB_NAME: str = "lime-data"

    MODEL_API_URL: str = ""
    MODEL_API_PREDICT_PATH: str = "/predict"
    MODEL_API_TIMEOUT_SECONDS: int = 30

    LLM_PROVIDER: str = "ollama"
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "tinyllama"
    OLLAMA_TIMEOUT_SECONDS: int = 90

    GPT_API_KEY: str = ""
    GPT_MODEL: str = "gpt-4o-mini"
    GPT_TIMEOUT_SECONDS: int = 20

    @property
    def SQLALCHEMY_DATABASE_URL(self) -> str:
        return (
            f"mysql+pymysql://{self.DB_USER}:{self.DB_PASSWORD}@"
            f"{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
        )

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )


settings = Settings()
