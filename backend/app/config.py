from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://confiahogar:confiahogar123@localhost:5432/confiahogar"
    secret_key: str = "supersecretkey_change_in_production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 días

    minio_endpoint: str = "localhost:9000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin123"
    minio_bucket: str = "confiahogar"
    minio_secure: bool = False

    frontend_url: str = "http://localhost:3000"

    max_file_size_mb: int = 10
    min_photo_resolution: int = 400

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
