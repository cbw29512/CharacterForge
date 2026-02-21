from __future__ import annotations
import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me-in-production")
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
