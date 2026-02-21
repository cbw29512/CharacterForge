# CharacterForge — Manual Setup Guide
## Windows 11 — Step by Step

---

## STEP 1: Install Python 3.12

1. Go to https://www.python.org/downloads/
2. Download Python 3.12.x (latest patch)
3. Run the installer
4. IMPORTANT: Check "Add Python to PATH" before clicking Install
5. Click "Install Now"
6. Verify: Open PowerShell and type:
   python --version
   Should show: Python 3.12.x

---

## STEP 2: Install Git

1. Go to https://git-scm.com/download/win
2. Download and run the installer
3. Accept all defaults
4. Verify: Open PowerShell and type:
   git --version

---

## STEP 3: Install PostgreSQL 16

1. Go to https://www.postgresql.org/download/windows/
2. Click "Download the installer" (EDB installer)
3. Select version 16.x for Windows x86-64
4. Run the installer
5. When asked for a password for the postgres superuser, use:
   CharForge2026!
   WRITE THIS DOWN — you will need it
6. Leave the port as 5432 (default)
7. Finish the install
8. Verify: Open PowerShell and type:
   psql --version
   If not found, add to PATH manually:
   C:\Program Files\PostgreSQL\16\bin

---

## STEP 4: Create the Database

1. Open PowerShell as Administrator
2. Connect to PostgreSQL:
   psql -U postgres
3. Enter your password: CharForge2026!
4. Run these commands one at a time:

   CREATE USER charforgeuser WITH PASSWORD 'CharForge2026!';
   CREATE DATABASE characterforge OWNER charforgeuser;
   GRANT ALL PRIVILEGES ON DATABASE characterforge TO charforgeuser;
   \q

---

## STEP 5: Install Ollama

1. Go to https://ollama.ai
2. Download the Windows installer
3. Run it and follow prompts
4. After install, open PowerShell and pull a model:
   ollama pull mistral
5. To run Ollama on port 4242:
   set OLLAMA_HOST=0.0.0.0:4242
   ollama serve
   Leave this window open while using CharacterForge

---

## STEP 6: Create Project Folder Structure

Open PowerShell and run these commands:

   mkdir C:\Users\dmchris\Desktop\CharacterForge
   cd C:\Users\dmchris\Desktop\CharacterForge
   mkdir models routes services srd_data migrations pdfs
   mkdir static\css static\js
   mkdir templates\auth templates\admin templates\builder templates\characters

---

## STEP 7: Create requirements.txt

In the CharacterForge folder, create a file called requirements.txt with this content:

   flask==3.1.0
   flask-sqlalchemy==3.1.1
   flask-session==0.8.0
   psycopg2-binary==2.9.9
   bcrypt==4.1.2
   itsdangerous==2.2.0
   python-dotenv==1.0.1
   requests==2.31.0
   reportlab==4.1.0
   flask-mail==0.10.0

---

## STEP 8: Install Python Packages

In PowerShell, from the CharacterForge folder:

   pip install -r requirements.txt

Wait for all packages to install. You should see "Successfully installed" at the end.

---

## STEP 9: Create .env File

In the CharacterForge folder, create a file called .env with this content:

   SECRET_KEY=change-this-to-a-long-random-string
   DATABASE_URL=postgresql://charforgeuser:CharForge2026!@localhost/characterforge
   OLLAMA_URL=http://localhost:4242
   ADMIN_EMAIL=admin@characterforge.local
   FLASK_ENV=development
   FLASK_PORT=5050

---

## STEP 10: Verify Everything Works

Run these checks in PowerShell:

   python --version          # Should show Python 3.12.x
   pip --version             # Should show pip version
   psql --version            # Should show psql version
   git --version             # Should show git version
   python -c "import flask; print('Flask OK')"
   python -c "import sqlalchemy; print('SQLAlchemy OK')"
   python -c "import bcrypt; print('bcrypt OK')"
   python -c "import reportlab; print('ReportLab OK')"

All should return OK. If any fail, run:
   pip install <package-name>

---

## WHAT'S NEXT

Once setup is verified, Claude will provide the Phase 1 code:
- app.py (Flask entry point)
- config.py
- models/ (User, Character, BuildSession)
- routes/ (auth, admin, builder)
- services/ (auth, SRD validation)
- migrations/init_db.sql (full schema)
- srd_data/ (SRD seed data + seed script)

You will run the seed script once to populate the database with all
SRD races, classes, backgrounds, equipment, spells, and feats.