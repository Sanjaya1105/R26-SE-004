from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_NAME: str = "Cognitive Style Explainability Service"
    APP_VERSION: str = "0.1.0"
    API_PREFIX: str = "/api/v1"

    DB_HOST: str = "localhost"
    DB_PORT: int = 3306
    DB_USER: str = "root"
    DB_PASSWORD: str = ""
    DB_NAME: str = "cognitive-style-explanations"

    MONGO_URL: str = "mongodb://localhost:27017"
    MONGO_DB_NAME: str = "cognitive_style_db"
    MONGO_CURSOR_COLLECTION: str = "visual_verbal_cursor_collection"
    MONGO_GAZE_COLLECTION: str = "visual_verbal_gaze_collection"
    MONGO_SYNC_INTERVAL_SECONDS: float = 2.0

    COGNITIVE_STYLE_MODEL_PATH: str = "../CognitiveStyleBackend/aiModel2/cognitive_style_rf_model.pkl"
    COGNITIVE_STYLE_LABEL_ENCODER_PATH: str = "../CognitiveStyleBackend/aiModel2/label_encoder.pkl"

    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "gemma3:12b"
    OLLAMA_MODEL_FALLBACKS: str = "tinyllama:latest"
    OLLAMA_TIMEOUT_SECONDS: int = 180
    OLLAMA_TEMPERATURE: float = 0.2
    OLLAMA_NUM_PREDICT: int = 180
    OLLAMA_KEEP_ALIVE: str = "10m"

    @property
    def SQLALCHEMY_DATABASE_URL(self) -> str:
        return (
            f"mysql+pymysql://{self.DB_USER}:{self.DB_PASSWORD}@"
            f"{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
        )

    model_config = SettingsConfigDict(
        env_file=("../CognitiveStyleBackend/.env", ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


settings = Settings()
