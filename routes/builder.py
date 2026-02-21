from __future__ import annotations
from pathlib import Path
from flask import Blueprint, render_template, request, redirect, url_for, flash, session, current_app
from db import db
from models.character import Character
from services.pdf_service import extract_text_from_pdf
from services.ollama_service import ollama_health

builder_bp = Blueprint("builder", __name__, url_prefix="/builder")

def _require_login():
    return bool(session.get("user_id"))

@builder_bp.get("/upload")
def upload():
    if not _require_login():
        return redirect(url_for("auth.login_form"))

    ok = ollama_health(current_app.config["OLLAMA_URL"])
    return render_template("builder/upload.html", ollama_ok=ok)

@builder_bp.post("/upload")
def upload_post():
    if not _require_login():
        return redirect(url_for("auth.login_form"))

    f = request.files.get("pdf")
    if not f or not f.filename.lower().endswith(".pdf"):
        flash("Please choose a PDF file.", "error")
        return redirect(url_for("builder.upload"))

    upload_dir = Path(current_app.config["UPLOAD_FOLDER"])
    upload_dir.mkdir(parents=True, exist_ok=True)

    safe_name = f.filename.replace("..", ".").replace("/", "_").replace("\\", "_")
    out_path = upload_dir / safe_name
    f.save(str(out_path))

    raw_text = extract_text_from_pdf(str(out_path))

    c = Character(
        owner_id=session.get("user_id"),
        source="pdf",
        pdf_filename=safe_name,
        raw_text=raw_text if raw_text else None,
        parsed=None,
        name=None,
    )
    db.session.add(c)
    db.session.commit()

    flash("PDF uploaded. Next: approval + mapping (we build next).", "ok")
    return redirect(url_for("characters.list_characters"))