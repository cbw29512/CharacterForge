from __future__ import annotations
from flask import Blueprint, render_template, redirect, url_for, session, flash, request, jsonify
from db import db
from models import Character, CharacterTemplate

templates_bp = Blueprint("templates", __name__, url_prefix="/templates")

def _require_login():
    if not session.get("user_id"):
        flash("Please log in.", "error")
        return False
    return True

@templates_bp.get("/")
def library():
    """Show the user's saved templates."""
    if not _require_login():
        return redirect(url_for("auth.login_get"))
    uid = session.get("user_id")
    role = session.get("role")
    if role in ("dm", "admin"):
        pc_templates = CharacterTemplate.query.filter_by(owner_id=uid, is_npc_template=False).order_by(CharacterTemplate.times_used.desc()).all()
        npc_templates = CharacterTemplate.query.filter_by(owner_id=uid, is_npc_template=True).order_by(CharacterTemplate.times_used.desc()).all()
    else:
        pc_templates = CharacterTemplate.query.filter_by(owner_id=uid, is_npc_template=False).order_by(CharacterTemplate.times_used.desc()).all()
        npc_templates = []
    return render_template("templates/library.html", pc_templates=pc_templates, npc_templates=npc_templates)

@templates_bp.post("/save_from_char/<int:char_id>")
def save_from_char(char_id: int):
    """Save an existing character as a template."""
    if not _require_login():
        return redirect(url_for("auth.login_get"))
    char = Character.query.get_or_404(char_id)
    uid = session.get("user_id")
    role = session.get("role")

    # Permission: admin can save anything, DM can save NPCs + their own chars, player can save their own chars
    if role == "admin":
        allowed = True
    elif role == "dm" and char.is_npc:
        allowed = True  # DMs can save any NPC as a template
    elif role == "dm" and char.campaign_id:
        from models import Campaign
        campaign = Campaign.query.get(char.campaign_id)
        allowed = campaign and campaign.dm_id == uid
    else:
        allowed = char.owner_id == uid
    if not allowed:
        flash("You can only save your own characters or NPCs as templates.", "error")
        return redirect(url_for("characters.sheet", cid=char_id))

    template_name = (request.form.get("template_name") or "").strip()
    description = (request.form.get("template_description") or "").strip()
    if not template_name:
        flash("Template name required.", "error")
        return redirect(url_for("characters.sheet", cid=char_id))

    # Check for duplicate name
    existing = CharacterTemplate.query.filter_by(owner_id=uid, name=template_name).first()
    if existing:
        flash(f"You already have a template named '{template_name}'. Choose a different name.", "error")
        return redirect(url_for("characters.sheet", cid=char_id))

    tmpl = char.to_template(template_name, description)
    tmpl.owner_id = uid  # Always the logged-in user, even for NPCs (owner_id on char is None for NPCs)
    db.session.add(tmpl)
    db.session.commit()
    flash(f"Saved as template '{template_name}'! Find it in your Template Library.", "ok")
    return redirect(url_for("characters.sheet", cid=char_id))

@templates_bp.get("/api/list")
def api_list():
    """Return templates as JSON for the wizard to load."""
    if not session.get("user_id"):
        return jsonify([]), 401
    uid = session.get("user_id")
    is_npc = request.args.get("npc", "false") == "true"
    tmpls = CharacterTemplate.query.filter_by(owner_id=uid, is_npc_template=is_npc)\
        .order_by(CharacterTemplate.times_used.desc()).all()
    return jsonify([t.to_dict() for t in tmpls])

@templates_bp.post("/api/use/<int:tmpl_id>")
def api_use(tmpl_id: int):
    """Mark a template as used and return its data."""
    if not session.get("user_id"):
        return jsonify({"error": "Not logged in"}), 401
    tmpl = CharacterTemplate.query.get_or_404(tmpl_id)
    if tmpl.owner_id != session.get("user_id") and session.get("role") != "admin":
        return jsonify({"error": "Forbidden"}), 403
    tmpl.times_used += 1
    db.session.commit()
    return jsonify({"ok": True, "template": tmpl.to_dict()})

@templates_bp.post("/<int:tmpl_id>/delete")
def delete(tmpl_id: int):
    uid = session.get("user_id")
    if not uid:
        return redirect(url_for("auth.login_get"))
    tmpl = CharacterTemplate.query.get_or_404(tmpl_id)
    if tmpl.owner_id != uid and session.get("role") != "admin":
        flash("You can only delete your own templates.", "error")
        return redirect(url_for("templates.library"))
    db.session.delete(tmpl)
    db.session.commit()
    flash(f"Template '{tmpl.name}' deleted.", "ok")
    return redirect(url_for("templates.library"))
