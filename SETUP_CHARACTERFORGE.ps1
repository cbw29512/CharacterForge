$ErrorActionPreference = "Stop"

function Ensure-Dir($p) { if (-not (Test-Path $p)) { New-Item -ItemType Directory -Force -Path $p | Out-Null } }
function Write-FileUtf8NoBom($Path, $Content) {
  $dir = Split-Path -Parent $Path
  if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
}
function Backup-IfExists($Path) {
  if (Test-Path $Path) {
    $stamp = Get-Date -Format "yyyyMMdd_HHmmss"
    Copy-Item -LiteralPath $Path -Destination ($Path + ".bak." + $stamp) -Force
  }
}

$Root = "C:\Users\dmchris\Desktop\CharacterForge"
Ensure-Dir $Root
Set-Location $Root

# Folders (everything inside this folder)
$dirs = @(
  "models","routes","services","scripts","migrations","pdfs","srd_data","data\sessions",
  "static\css","static\js",
  "templates","templates\auth","templates\admin","templates\builder","templates\characters"
)
foreach ($d in $dirs) { Ensure-Dir (Join-Path $Root $d) }

# Requirements (venv-based install; no global pip)
Backup-IfExists "$Root\requirements.txt"
Write-FileUtf8NoBom "$Root\requirements.txt" @"
flask==3.1.0
flask-sqlalchemy==3.1.1
flask-session==0.8.0
psycopg2-binary==2.9.9
bcrypt==4.1.2
python-dotenv==1.0.1
requests==2.31.0
reportlab==4.1.0
flask-mail==0.10.0
pypdf>=4.0.0
"@

# .env (kept inside folder)
Backup-IfExists "$Root\.env"
Write-FileUtf8NoBom "$Root\.env" @"
SECRET_KEY=change-this-to-a-long-random-string
DATABASE_URL=postgresql://charforgeuser:CharForge2026!@localhost/characterforge
OLLAMA_URL=http://localhost:4242
ADMIN_EMAIL=admin@characterforge.local
FLASK_ENV=development
FLASK_PORT=5050

# Seed users (matches your “DM + shared player login” requirement)
CF_ADMIN_USER=dm
CF_ADMIN_PASS=DM1974
CF_PLAYER_USER=player
CF_PLAYER_PASS=player1974
"@

# --- Core app files ---
Write-FileUtf8NoBom "$Root\config.py" @"
from __future__ import annotations

import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me")
    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR/'data'/'dev.sqlite3'}")
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    SESSION_TYPE = "filesystem"
    SESSION_FILE_DIR = str(BASE_DIR / "data" / "sessions")
    SESSION_PERMANENT = False

    UPLOAD_FOLDER = str(BASE_DIR / "pdfs")
    MAX_CONTENT_LENGTH = 20 * 1024 * 1024  # 20MB

    OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:4242")
    ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@characterforge.local")

    CF_ADMIN_USER = os.getenv("CF_ADMIN_USER", "dm")
    CF_ADMIN_PASS = os.getenv("CF_ADMIN_PASS", "DM1974")
    CF_PLAYER_USER = os.getenv("CF_PLAYER_USER", "player")
    CF_PLAYER_PASS = os.getenv("CF_PLAYER_PASS", "player1974")
"@

Write-FileUtf8NoBom "$Root\db.py" @"
from flask_sqlalchemy import SQLAlchemy
db = SQLAlchemy()
"@

Write-FileUtf8NoBom "$Root\app.py" @"
from __future__ import annotations

import os
from flask import Flask, redirect, url_for
from flask_session import Session

from config import Config
from db import db

def create_app() -> Flask:
    app = Flask(__name__)
    app.config.from_object(Config)

    os.makedirs(app.config["SESSION_FILE_DIR"], exist_ok=True)
    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

    Session(app)
    db.init_app(app)

    from routes.auth import auth_bp
    from routes.admin import admin_bp
    from routes.builder import builder_bp
    from routes.characters import characters_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(builder_bp)
    app.register_blueprint(characters_bp)

    @app.get("/")
    def home():
        return redirect(url_for("builder.upload"))

    return app

if __name__ == "__main__":
    app = create_app()
    port = int(os.getenv("FLASK_PORT", "5050"))

    with app.app_context():
        from scripts.init_db import ensure_seed_users
        db.create_all()
        ensure_seed_users(db)

    app.run(host="127.0.0.1", port=port, debug=True)
"@

# --- Models ---
Write-FileUtf8NoBom "$Root\models\__init__.py" @"
from .user import User
from .character import Character
"@

Write-FileUtf8NoBom "$Root\models\user.py" @"
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
"@

Write-FileUtf8NoBom "$Root\models\character.py" @"
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
"@

# --- Services ---
Write-FileUtf8NoBom "$Root\services\auth_service.py" @"
from __future__ import annotations
import bcrypt

def hash_password(plain: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(plain.encode("utf-8"), salt).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False
"@

Write-FileUtf8NoBom "$Root\services\pdf_service.py" @"
from __future__ import annotations
from pathlib import Path

def extract_text_from_pdf(pdf_path: str) -> str:
    p = Path(pdf_path)
    if not p.exists():
        return ""

    try:
        from pypdf import PdfReader  # type: ignore
        reader = PdfReader(str(p))
        parts = []
        for page in reader.pages:
            parts.append(page.extract_text() or "")
        return "\n\n".join(parts).strip()
    except Exception:
        return ""
"@

Write-FileUtf8NoBom "$Root\services\ollama_service.py" @"
from __future__ import annotations
import requests

def ollama_health(ollama_url: str) -> bool:
    try:
        r = requests.get(ollama_url.rstrip("/") + "/api/tags", timeout=2)
        return r.status_code == 200
    except Exception:
        return False
"@

# --- Routes ---
Write-FileUtf8NoBom "$Root\routes\__init__.py" @"
# Blueprints defined per module.
"@

Write-FileUtf8NoBom "$Root\routes\auth.py" @"
from __future__ import annotations
from flask import Blueprint, render_template, request, redirect, url_for, session, flash
from models.user import User
from services.auth_service import verify_password

auth_bp = Blueprint("auth", __name__, url_prefix="/auth")

@auth_bp.get("/login")
def login_form():
    return render_template("auth/login.html")

@auth_bp.post("/login")
def login_submit():
    username = (request.form.get("username") or "").strip()
    password = (request.form.get("password") or "").strip()

    if not username or not password:
        flash("Username and password required.", "error")
        return redirect(url_for("auth.login_form"))

    user = User.query.filter_by(username=username).first()
    if not user or not verify_password(password, user.password_hash):
        flash("Invalid credentials.", "error")
        return redirect(url_for("auth.login_form"))

    session["user_id"] = user.id
    session["role"] = user.role
    flash("Logged in.", "ok")
    return redirect(url_for("builder.upload"))

@auth_bp.get("/logout")
def logout():
    session.clear()
    flash("Logged out.", "ok")
    return redirect(url_for("auth.login_form"))
"@

Write-FileUtf8NoBom "$Root\routes\admin.py" @"
from __future__ import annotations
from flask import Blueprint, render_template, redirect, url_for, session, flash
from models.user import User
from models.character import Character

admin_bp = Blueprint("admin", __name__, url_prefix="/admin")

def _require_admin():
    if session.get("role") != "admin":
        flash("Admin access required.", "error")
        return False
    return True

@admin_bp.get("")
@admin_bp.get("/")
def dashboard():
    if not _require_admin():
        return redirect(url_for("auth.login_form"))

    return render_template(
        "admin/dashboard.html",
        user_count=User.query.count(),
        character_count=Character.query.count(),
        admins=User.query.filter_by(role="admin").all(),
    )
"@

Write-FileUtf8NoBom "$Root\routes\builder.py" @"
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
"@

Write-FileUtf8NoBom "$Root\routes\characters.py" @"
from __future__ import annotations
from flask import Blueprint, render_template, redirect, url_for, session
from models.character import Character

characters_bp = Blueprint("characters", __name__, url_prefix="/characters")

def _require_login():
    return bool(session.get("user_id"))

@characters_bp.get("")
@characters_bp.get("/")
def list_characters():
    if not _require_login():
        return redirect(url_for("auth.login_form"))

    rows = Character.query.order_by(Character.created_at.desc()).limit(100).all()
    return render_template("characters/list.html", rows=rows)
"@

# --- scripts package (fixes the “scripts import” bug) ---
Write-FileUtf8NoBom "$Root\scripts\__init__.py" @"
# Makes scripts importable
"@

Write-FileUtf8NoBom "$Root\scripts\init_db.py" @"
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
"@

# --- Minimal UI ---
Write-FileUtf8NoBom "$Root\templates\base.html" @"
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>CharacterForge</title>
  <link rel="stylesheet" href="/static/css/app.css">
</head>
<body>
  <div class="topbar">
    <div class="brand">CharacterForge</div>
    <div class="nav">
      <a href="/builder/upload">Upload</a>
      <a href="/characters">Characters</a>
      <a href="/admin">Admin</a>
      <a href="/auth/logout">Logout</a>
    </div>
  </div>

  <div class="container">
    {% with msgs = get_flashed_messages(with_categories=true) %}
      {% if msgs %}
        <div class="flashwrap">
          {% for cat, msg in msgs %}
            <div class="flash {{cat}}">{{ msg }}</div>
          {% endfor %}
        </div>
      {% endif %}
    {% endwith %}
    {% block content %}{% endblock %}
  </div>
</body>
</html>
"@

Write-FileUtf8NoBom "$Root\templates\auth\login.html" @"
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Login — CharacterForge</title>
  <link rel="stylesheet" href="/static/css/app.css">
</head>
<body>
  <div class="container">
    <h1>Login</h1>
    {% with msgs = get_flashed_messages(with_categories=true) %}
      {% if msgs %}
        <div class="flashwrap">
          {% for cat, msg in msgs %}
            <div class="flash {{cat}}">{{ msg }}</div>
          {% endfor %}
        </div>
      {% endif %}
    {% endwith %}

    <form method="post" action="/auth/login" class="card">
      <label>Username</label>
      <input name="username" autocomplete="username" />
      <label>Password</label>
      <input name="password" type="password" autocomplete="current-password" />
      <button type="submit">Sign in</button>
    </form>

    <p class="hint">Seeded users are in .env (CF_ADMIN_* and CF_PLAYER_*).</p>
  </div>
</body>
</html>
"@

Write-FileUtf8NoBom "$Root\templates\admin\dashboard.html" @"
{% extends "base.html" %}
{% block content %}
  <h1>Admin</h1>
  <div class="grid">
    <div class="card"><div class="k">Users</div><div class="v">{{ user_count }}</div></div>
    <div class="card"><div class="k">Characters</div><div class="v">{{ character_count }}</div></div>
  </div>

  <h2>Admins</h2>
  <div class="card">
    {% for a in admins %}
      <div>{{ a.username }}</div>
    {% endfor %}
  </div>
{% endblock %}
"@

Write-FileUtf8NoBom "$Root\templates\builder\upload.html" @"
{% extends "base.html" %}
{% block content %}
  <h1>Upload D&D Beyond PDF</h1>

  <div class="card">
    <div>Ollama status: <b>{{ "OK" if ollama_ok else "Not reachable" }}</b></div>
    <div class="hint">Upload works even if Ollama is down.</div>
  </div>

  <form method="post" enctype="multipart/form-data" class="card">
    <input type="file" name="pdf" accept="application/pdf" />
    <button type="submit">Upload</button>
  </form>

  <div class="hint">Next: approval screen + field mapping (we implement next).</div>
{% endblock %}
"@

Write-FileUtf8NoBom "$Root\templates\characters\list.html" @"
{% extends "base.html" %}
{% block content %}
  <h1>Characters</h1>

  <div class="card">
    <table class="table">
      <tr>
        <th>ID</th>
        <th>PDF</th>
        <th>Created</th>
        <th>Has Text</th>
      </tr>
      {% for c in rows %}
        <tr>
          <td>{{ c.id }}</td>
          <td>{{ c.pdf_filename or "—" }}</td>
          <td>{{ c.created_at }}</td>
          <td>{{ "yes" if c.raw_text else "no" }}</td>
        </tr>
      {% endfor %}
    </table>
  </div>
{% endblock %}
"@

Write-FileUtf8NoBom "$Root\static\css\app.css" @"
body { font-family: Segoe UI, Arial, sans-serif; margin:0; background:#0b0f14; color:#e8eef6; }
a { color:#9dd1ff; text-decoration:none; margin-right:12px; }
.container { max-width: 980px; margin: 26px auto; padding: 0 16px; }
.topbar { display:flex; justify-content:space-between; align-items:center; padding:14px 16px; background:#111826; border-bottom:1px solid #223049; }
.brand { font-weight:700; letter-spacing:0.2px; }
.card { background:#0f1623; border:1px solid #223049; border-radius:12px; padding:14px; margin: 12px 0; }
.grid { display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.k { opacity:.75; font-size: 12px; }
.v { font-size: 26px; font-weight: 700; margin-top: 4px; }
label { display:block; margin-top:10px; opacity:.85; }
input { width:100%; padding:10px; margin-top:6px; border-radius:10px; border:1px solid #223049; background:#0b1220; color:#e8eef6; }
button { margin-top:12px; padding:10px 14px; border-radius:10px; border:1px solid #2b3b5a; background:#14233a; color:#e8eef6; cursor:pointer; }
.flashwrap { margin: 10px 0; }
.flash { padding:10px; border-radius:10px; margin:8px 0; border:1px solid #223049; background:#101a2a; }
.flash.ok { border-color:#2e6b3a; }
.flash.error { border-color:#7a2d2d; }
.hint { opacity:.75; font-size: 12px; margin-top: 10px; }
.table { width:100%; border-collapse: collapse; }
.table th, .table td { text-align:left; padding:8px; border-bottom:1px solid #223049; }
"@

# --- Helper scripts (venv + run) ---
Write-FileUtf8NoBom "$Root\scripts\01_create_venv.ps1" @"
`$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent `$PSScriptRoot)
py -m venv .venv
Write-Host 'Venv created: .\.venv' -ForegroundColor Green
"@

Write-FileUtf8NoBom "$Root\scripts\02_install_deps.ps1" @"
`$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent `$PSScriptRoot)
& .\.venv\Scripts\python.exe -m pip install --upgrade pip
& .\.venv\Scripts\python.exe -m pip install -r requirements.txt
Write-Host 'Deps installed into venv.' -ForegroundColor Green
"@

Write-FileUtf8NoBom "$Root\scripts\03_run_dev.ps1" @"
`$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent `$PSScriptRoot)
& .\.venv\Scripts\python.exe .\app.py
"@

Write-Host ""
Write-Host "=== Flask codebase generated inside: $Root ===" -ForegroundColor Green
Write-Host "Next run:" -ForegroundColor Yellow
Write-Host "  cd $Root"
Write-Host "  .\scripts\01_create_venv.ps1"
Write-Host "  .\scripts\02_install_deps.ps1"
Write-Host "  .\scripts\03_run_dev.ps1"
Write-Host ""
Write-Host "Then open: http://127.0.0.1:5050/auth/login" -ForegroundColor Cyan