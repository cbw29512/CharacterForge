from __future__ import annotations
import os
from flask import Flask, redirect, url_for, session
from flask_session import Session
from config import Config
from db import db

def create_app() -> Flask:
    app = Flask(__name__)
    app.config.from_object(Config)

    os.makedirs(app.config["SESSION_FILE_DIR"], exist_ok=True)
    os.makedirs(app.config.get("UPLOAD_FOLDER", "uploads"), exist_ok=True)
    os.makedirs("data", exist_ok=True)

    Session(app)
    db.init_app(app)

    from routes.auth import auth_bp
    from routes.admin import admin_bp
    from routes.dm import dm_bp
    from routes.player import player_bp
    from routes.campaigns import campaigns_bp
    from routes.characters import characters_bp
    from routes.templates import templates_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(dm_bp)
    app.register_blueprint(player_bp)
    app.register_blueprint(campaigns_bp)
    app.register_blueprint(characters_bp)
    app.register_blueprint(templates_bp)

    @app.get("/")
    def home():
        if not session.get("user_id"):
            return redirect(url_for("auth.login_get"))
        role = session.get("role")
        if role == "admin":
            return redirect(url_for("admin.dashboard"))
        elif role == "dm":
            return redirect(url_for("dm.dashboard"))
        return redirect(url_for("player.dashboard"))

    return app

if __name__ == "__main__":
    app = create_app()
    port = int(os.getenv("FLASK_PORT", "5050"))
    with app.app_context():
        db.create_all()
    app.run(host="127.0.0.1", port=port, debug=True)
