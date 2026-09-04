from __future__ import annotations
import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

_FORBIDDEN_SECRET_KEYS = {
    "dev-secret-change-me-in-production",
    "change-me",
    "changeme",
}


def resolve_secret_key() -> str:
    """Return a configured application secret or fail closed.

    CharacterForge uses server-side sessions, so silently falling back to a
    predictable key is unsafe even for a public beta. Local development should
    use a developer-generated value in .env; deployments must inject a unique
    value through the environment.
    """
    secret = os.getenv("SECRET_KEY", "").strip()
    if not secret:
        raise RuntimeError("SECRET_KEY is required. Set a unique value in the environment or .env file.")
    if secret.lower() in _FORBIDDEN_SECRET_KEYS or len(secret) < 32:
        raise RuntimeError("SECRET_KEY must be a unique value of at least 32 characters and must not use an example default.")
    return secret


class Config:
    SECRET_KEY = resolve_secret_key()
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL",
        f"sqlite:///{BASE_DIR / 'data' / 'characterforge.sqlite3'}"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SESSION_TYPE = "filesystem"
    SESSION_FILE_DIR = str(BASE_DIR / "data" / "sessions")
    SESSION_PERMANENT = False
    UPLOAD_FOLDER = str(BASE_DIR / "uploads")
    MAX_CONTENT_LENGTH = 20 * 1024 * 1024
    OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:4242")
    OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "mistral")
