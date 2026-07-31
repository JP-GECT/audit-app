from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    anthropic_api_key: str = ""
    risk_threshold: float = 0.6
    chroma_dir: str = "./chroma_data"

    class Config:
        env_file = ".env"


settings = Settings()
