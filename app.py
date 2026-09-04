from __future__ import annotations
import logging
import os
from flask import Flask, redirect, url_for, session
from flask_session import Session
from flask_wtf.csrf import CSRFProtect
from config import Config
from db import db

logger = logging.getLogger(__name__)
csrf = CSRFProtect()


def _env_flag(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def create_app() -> Flask:
    """Create and configure the CharacterForge Flask application."""
    app = Flask(__name__)
    app.config.from_object(Config)

    os.makedirs(app.config["SESSION_FILE_DIR"], exist_ok=True)
    os.makedirs(app.config.get("UPLOAD_FOLDER", "uploads"), exist_ok=True)
    os.makedirs("data", exist_ok=True)

    Session(app)
    db.init_app(app)
    csrf.init_app(app)

    from routes.auth import auth_bp
    from routes.admin import admin_bp
    from routes.dm import dm_bp
    from routes.player import player_bp
    from routes.campaigns import campaigns_bp
    from routes.characters import characters_bp
    from routes.templates import templates_bp
    from routes.character_fixes import character_fixes_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(dm_bp)
    app.register_blueprint(player_bp)
    app.register_blueprint(campaigns_bp)
    app.register_blueprint(characters_bp)
    app.register_blueprint(templates_bp)
    # New character-creation endpoint is isolated from the legacy endpoint so
    # the existing application remains available while the wizard is hardened.
    app.register_blueprint(character_fixes_bp)

    @app.after_request
    def add_security_headers(response):
        """Apply non-breaking browser hardening headers to every response."""
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault("Permissions-Policy", "camera=(), geolocation=(), microphone=()")
        return response

    @app.get("/")
    def home():
        if not session.get("user_id"):
            return redirect(url_for("auth.login_get"))
        role = session.get("role")
        if role == "admin":
            return redirect(url_for("admin.dashboard"))
        if role == "dm":
            return redirect(url_for("dm.dashboard"))
        return redirect(url_for("player.dashboard"))

    return app


if __name__ == "__main__":
    app = create_app()
    port = int(os.getenv("FLASK_PORT", "5050"))
    with app.app_context():
        try:
            db.create_all()
        except Exception:
            logger.exception("Failed to initialize database tables")
            raise
    app.run(host="127.0.0.1", port=port, debug=_env_flag("FLASK_DEBUG", default=False))
