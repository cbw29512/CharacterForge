from __future__ import annotations
from flask import Blueprint, render_template, request, redirect, url_for, session, flash
from db import db
from models import User
from services.auth_service import verify_password, hash_password
from sqlalchemy import func

auth_bp = Blueprint("auth", __name__, url_prefix="/auth")

# --- CHARACTERFORGE DEFAULT ACCOUNTS ---
# admin:        adminchris / 1974
# dungeon master: dmchris / 1974
# player:       playerchris / 1974
# Usernames are case-insensitive; passwords are case-sensitive.

DEFAULT_ACCOUNTS = [
    ("adminchris",  "1974", "admin",  "AdminChris"),
    ("dmchris",     "1974", "dm",     "DMChris"),
    ("playerchris", "1974", "player", "PlayerChris"),
]

def _norm_username(s: str) -> str:
    return (s or "").strip().casefold()

def _get_user_ci(username: str):
    u = _norm_username(username)
    if not u:
        return None
    exact = User.query.filter_by(username=u).first()
    if exact:
        return exact
    return User.query.filter(func.lower(User.username) == u.lower()).order_by(User.id.asc()).first()

def ensure_default_accounts() -> None:
    changed = False
    for uname, pw, role, display in DEFAULT_ACCOUNTS:
        u = _get_user_ci(uname)
        if not u:
            u_kwargs = dict(username=uname, password_hash=hash_password(pw), role=role)
            if hasattr(User, "display_name"):
                u_kwargs["display_name"] = display
            u = User(**u_kwargs)
            db.session.add(u)
            changed = True
            continue

        # enforce canonical username if safe
        if getattr(u, "username", None) != uname:
            if User.query.filter_by(username=uname).count() == 0:
                u.username = uname
                changed = True

        # enforce role
        if getattr(u, "role", None) != role:
            u.role = role
            changed = True

        # enforce password
        try:
            ok = verify_password(pw, u.password_hash)
        except Exception:
            ok = False
        if not ok:
            u.password_hash = hash_password(pw)
            changed = True

        # display_name
        if hasattr(u, "display_name") and not (u.display_name or "").strip():
            u.display_name = display
            changed = True

    if changed:
        db.session.commit()


def _first_launch() -> bool:
    return User.query.filter_by(role="admin").count() == 0

@auth_bp.get("/setup")
def setup_get():
    if not _first_launch():
        return redirect(url_for("auth.login_get"))
    return render_template("auth/setup.html")

@auth_bp.post("/setup")
def setup_post():
    if not _first_launch():
        return redirect(url_for("auth.login_get"))
    username = (request.form.get("username") or "").strip().casefold()
    password = (request.form.get("password") or "").strip()
    confirm = (request.form.get("confirm") or "").strip()
    display = (request.form.get("display_name") or username).strip()

    if not username or not password:
        flash("Username and password required.", "error")
        return redirect(url_for("auth.setup_get"))
    if password != confirm:
        flash("Passwords do not match.", "error")
        return redirect(url_for("auth.setup_get"))
    if len(password) < 6:
        flash("Password must be at least 6 characters.", "error")
        return redirect(url_for("auth.setup_get"))

    admin = User(username=username, password_hash=hash_password(password), role="admin", display_name=display)
    db.session.add(admin)
    db.session.commit()
    flash("Admin account created! Please log in.", "ok")
    return redirect(url_for("auth.login_get"))

@auth_bp.get("/login")
def login_get():
    ensure_default_accounts()
    if _first_launch():
        return redirect(url_for("auth.setup_get"))
    return render_template("auth/login.html")

@auth_bp.post("/login")
def login_post():
    ensure_default_accounts()
    username = (request.form.get("username") or "").strip().casefold()
    password = (request.form.get("password") or "").strip()
    role_hint = (request.form.get("role") or "").strip().casefold()
    if not username or not password:
        flash("Username and password required.", "error")
        return redirect(url_for("auth.login_get"))
    user = _get_user_ci(username)
    if not user or not verify_password(password, user.password_hash):
        flash("Invalid credentials.", "error")
        return redirect(url_for("auth.login_get"))

    # Role hint validation (must match actual role)
    if role_hint and role_hint != user.role:
        flash(f"This account is not registered as {role_hint}.", "error")
        return redirect(url_for("auth.login_get"))

    session["user_id"] = user.id
    session["role"] = user.role
    session["username"] = user.username
    session["display_name"] = user.display_name or user.username

    if user.role == "admin":
        return redirect(url_for("admin.dashboard"))
    elif user.role == "dm":
        return redirect(url_for("dm.dashboard"))
    else:
        return redirect(url_for("player.dashboard"))

@auth_bp.get("/logout")
def logout():
    session.clear()
    flash("You have been logged out.", "ok")
    return redirect(url_for("auth.login_get"))
