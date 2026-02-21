from __future__ import annotations
from flask import Blueprint, render_template, redirect, url_for, session, flash, request
from db import db
from models import User, Campaign, CampaignMembership, Character
from services.auth_service import hash_password

admin_bp = Blueprint("admin", __name__, url_prefix="/admin")

def _require_admin():
    if session.get("role") != "admin":
        flash("Admin access required.", "error")
        return False
    return True

@admin_bp.get("/")
def dashboard():
    if not _require_admin():
        return redirect(url_for("auth.login_get"))
    users = User.query.order_by(User.role, User.username).all()
    campaigns = Campaign.query.order_by(Campaign.created_at.desc()).all()
    return render_template("admin/dashboard.html",
        users=users, campaigns=campaigns,
        user_count=len(users),
        campaign_count=len(campaigns),
        char_count=Character.query.count()
    )

@admin_bp.post("/users/create")
def create_user():
    if not _require_admin():
        return redirect(url_for("auth.login_get"))
    username = (request.form.get("username") or "").strip()
    password = (request.form.get("password") or "").strip()
    role = (request.form.get("role") or "player").strip()
    display = (request.form.get("display_name") or username).strip()

    if not username or not password:
        flash("Username and password required.", "error")
        return redirect(url_for("admin.dashboard"))
    if role not in ("admin", "dm", "player"):
        flash("Invalid role.", "error")
        return redirect(url_for("admin.dashboard"))
    if len(password) < 6:
        flash("Password must be at least 6 characters.", "error")
        return redirect(url_for("admin.dashboard"))
    if User.query.filter_by(username=username).first():
        flash(f"Username '{username}' already exists.", "error")
        return redirect(url_for("admin.dashboard"))

    u = User(username=username, password_hash=hash_password(password), role=role, display_name=display)
    db.session.add(u)
    db.session.commit()
    flash(f"User '{username}' created as {role}.", "ok")
    return redirect(url_for("admin.dashboard"))

@admin_bp.post("/users/<int:uid>/set_role")
def set_role(uid: int):
    if not _require_admin():
        return redirect(url_for("auth.login_get"))
    u = User.query.get_or_404(uid)
    role = (request.form.get("role") or "").strip()
    if role not in ("admin", "dm", "player"):
        flash("Invalid role.", "error")
        return redirect(url_for("admin.dashboard"))
    # Prevent removing last admin
    if u.role == "admin" and role != "admin":
        admin_count = User.query.filter_by(role="admin").count()
        if admin_count <= 1:
            flash("Cannot demote the last admin.", "error")
            return redirect(url_for("admin.dashboard"))
    u.role = role
    db.session.commit()
    flash(f"{u.username} is now {role}.", "ok")
    return redirect(url_for("admin.dashboard"))

@admin_bp.post("/users/<int:uid>/reset_password")
def reset_password(uid: int):
    if not _require_admin():
        return redirect(url_for("auth.login_get"))
    u = User.query.get_or_404(uid)
    pw = (request.form.get("password") or "").strip()
    if not pw or len(pw) < 6:
        flash("Password must be at least 6 characters.", "error")
        return redirect(url_for("admin.dashboard"))
    u.password_hash = hash_password(pw)
    db.session.commit()
    flash(f"Password reset for {u.username}.", "ok")
    return redirect(url_for("admin.dashboard"))

@admin_bp.post("/users/<int:uid>/delete")
def delete_user(uid: int):
    if not _require_admin():
        return redirect(url_for("auth.login_get"))
    u = User.query.get_or_404(uid)
    if u.id == session.get("user_id"):
        flash("You cannot delete yourself.", "error")
        return redirect(url_for("admin.dashboard"))
    if u.role == "admin":
        admin_count = User.query.filter_by(role="admin").count()
        if admin_count <= 1:
            flash("Cannot delete the last admin.", "error")
            return redirect(url_for("admin.dashboard"))
    db.session.delete(u)
    db.session.commit()
    flash(f"User '{u.username}' deleted.", "ok")
    return redirect(url_for("admin.dashboard"))

@admin_bp.post("/campaigns/<int:cid>/delete")
def delete_campaign(cid: int):
    if not _require_admin():
        return redirect(url_for("auth.login_get"))
    c = Campaign.query.get_or_404(cid)
    db.session.delete(c)
    db.session.commit()
    flash(f"Campaign '{c.name}' deleted.", "ok")
    return redirect(url_for("admin.dashboard"))
