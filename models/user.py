from __future__ import annotations
from datetime import datetime
from db import db

class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False, default="player")  # admin | player
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)