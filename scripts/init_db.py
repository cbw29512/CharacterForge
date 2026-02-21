from __future__ import annotations
from flask import current_app
from models.user import User
from services.auth_service import hash_password

def ensure_seed_users(db):
    cfg = current_app.config
    admin_user = cfg.get("CF_ADMIN_USER", "dm")
    admin_pass = cfg.get("CF_ADMIN_PASS", "DM1974")
    player_user = cfg.get("CF_PLAYER_USER", "player")
    player_pass = cfg.get("CF_PLAYER_PASS", "player1974")

    if not User.query.filter_by(username=admin_user).first():
        db.session.add(User(username=admin_user, password_hash=hash_password(admin_pass), role="admin"))

    if not User.query.filter_by(username=player_user).first():
        db.session.add(User(username=player_user, password_hash=hash_password(player_pass), role="player"))

    db.session.commit()