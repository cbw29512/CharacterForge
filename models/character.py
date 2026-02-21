from __future__ import annotations
from datetime import datetime
from db import db

class Character(db.Model):
    __tablename__ = "characters"

    id = db.Column(db.Integer, primary_key=True)
    owner_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)

    name = db.Column(db.String(200), nullable=True)
    source = db.Column(db.String(50), nullable=False, default="pdf")
    pdf_filename = db.Column(db.String(500), nullable=True)

    raw_text = db.Column(db.Text, nullable=True)
    parsed = db.Column(db.JSON, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)