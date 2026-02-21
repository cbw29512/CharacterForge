from __future__ import annotations
import json
from flask import Blueprint, render_template, redirect, url_for, session, flash, request, jsonify, current_app
from db import db
from models import Character, Campaign, CampaignMembership
from services import srd_service
from services.ollama_service import step_prompt, ollama_chat, generate_npc, ollama_health

characters_bp = Blueprint("characters", __name__, url_prefix="/characters")

def _require_login():
    if not session.get("user_id"):
        flash("Please log in.", "error")
        return False
    return True

def _can_edit_character(char):
    uid = session.get("user_id")
    role = session.get("role")
    if role == "admin": return True
    if role == "dm":
        if char.campaign_id:
            c = Campaign.query.get(char.campaign_id)
            if c and c.dm_id == uid: return True
        return char.is_npc
    return char.owner_id == uid

def _can_delete_character(char):
    uid = session.get("user_id")
    role = session.get("role")
    if role == "admin": return True
    if role == "dm":
        if char.is_npc: return True
        if char.campaign_id:
            c = Campaign.query.get(char.campaign_id)
            if c and c.dm_id == uid: return True
        return False
    return char.owner_id == uid and not char.is_npc

@characters_bp.get("/new")
def new():
    if not _require_login():
        return redirect(url_for("auth.login_get"))
    campaign_id = request.args.get("campaign_id", type=int)
    is_npc = request.args.get("npc", "false").lower() == "true"
    role = session.get("role")
    if is_npc and role not in ("dm", "admin"):
        flash("Only DMs and Admins can create NPCs.", "error")
        return redirect(url_for("auth.login_get"))
    ollama_url = current_app.config["OLLAMA_URL"]

    # Load template if requested
    preload = None
    template_id = request.args.get("template", type=int)
    if template_id:
        from models import CharacterTemplate
        tmpl = CharacterTemplate.query.get(template_id)
        if tmpl and (tmpl.owner_id == session.get("user_id") or role == "admin"):
            tmpl.times_used += 1
            from db import db
            db.session.commit()
            preload = tmpl.to_dict()

    return render_template("characters/wizard.html",
        campaign_id=campaign_id,
        is_npc=is_npc,
        races=srd_service.SRD_RACES,
        classes=srd_service.SRD_CLASSES,
        backgrounds=srd_service.SRD_BACKGROUNDS,
        alignments=srd_service.SRD_ALIGNMENTS,
        skills=srd_service.ALL_SKILLS,
        ollama_ok=ollama_health(ollama_url),
        preload=preload,
    )

@characters_bp.post("/create")
def create():
    if not _require_login():
        return redirect(url_for("auth.login_get"))
    uid = session.get("user_id")
    role = session.get("role")
    f = request.form
    campaign_id = f.get("campaign_id", type=int)
    is_npc = f.get("is_npc", "false").lower() == "true"

    if is_npc and role not in ("dm", "admin"):
        flash("Only DMs and Admins can create NPCs.", "error")
        return redirect(url_for("auth.login_get"))

    def score(key): return max(1, min(30, int(f.get(key, 10) or 10)))

    race_name = f.get("race", "Human")
    class_name = f.get("char_class", "Fighter")
    bg_name = f.get("background", "Soldier")
    level = max(1, min(30, int(f.get("level", 1) or 1)))
    alignment = f.get("alignment", "True Neutral")

    srd_class = srd_service.get_class(class_name) or {}
    hit_die = srd_class.get("hit_die", "d8")
    prof = srd_service.proficiency_bonus(min(level, 20))
    con_score = score("constitution")
    dex_score = score("dexterity")
    con_mod = srd_service.ability_modifier(con_score)
    dex_mod = srd_service.ability_modifier(dex_score)
    hit_die_val = int(hit_die[1:])
    auto_hp = max(1, hit_die_val + con_mod + (level - 1) * (hit_die_val // 2 + 1 + con_mod))
    auto_ac = 10 + dex_mod

    hp_override = f.get("hp_override", "").strip()
    ac_override = f.get("armor_class_override", "").strip()
    max_hp = int(hp_override) if hp_override and hp_override.lstrip('-').isdigit() else auto_hp
    max_hp = max(1, max_hp)
    armor_class = int(ac_override) if ac_override and ac_override.lstrip('-').isdigit() else auto_ac
    speed = max(0, int(f.get("speed", 30) or 30))

    # Personality fields
    personality_trait = f.get("personality_trait", "")
    ideal = f.get("ideal", "")
    bond = f.get("bond", "")
    flaw = f.get("flaw", "")
    traits_json = json.dumps({
        "personality": personality_trait,
        "ideal": ideal,
        "bond": bond,
        "flaw": flaw
    })

    char = Character(
        owner_id=uid if not is_npc else None,
        campaign_id=campaign_id,
        is_npc=is_npc,
        name=(f.get("name") or "(unnamed)").strip(),
        level=level,
        char_class=class_name,
        race=race_name,
        background=bg_name,
        alignment=alignment,
        strength=score("strength"),
        dexterity=dex_score,
        constitution=con_score,
        intelligence=score("intelligence"),
        wisdom=score("wisdom"),
        charisma=score("charisma"),
        max_hp=max_hp,
        current_hp=max_hp,
        armor_class=armor_class,
        speed=speed,
        proficiency_bonus=prof,
        hit_dice=f"{level}{hit_die}",
        build_complete=True,
        notes=f.get("notes", ""),
        traits_json=traits_json,
    )

    bg = srd_service.get_background(bg_name) or {}
    # Merge background skills + any class skills
    skills_dict = {s: True for s in bg.get("skill_proficiencies", [])}
    char.skills_json = json.dumps(skills_dict)
    char.equipment_json = json.dumps(bg.get("equipment", []))

    feats = []
    for lvl in range(1, min(level, 20) + 1):
        feats.extend(srd_class.get("features_by_level", {}).get(lvl, []))
    char.features_json = json.dumps(feats)

    # Saving throw proficiencies from class
    saves = srd_class.get("saving_throws", [])
    char.saving_throws_json = json.dumps({s: True for s in saves})

    db.session.add(char)
    db.session.commit()

    flash(f"{'NPC' if is_npc else 'Character'} '{char.name}' created!", "ok")
    if campaign_id:
        return redirect(url_for("campaigns.view", cid=campaign_id))
    if is_npc:
        return redirect(url_for("dm.dashboard"))
    return redirect(url_for("player.dashboard"))

@characters_bp.get("/<int:cid>/sheet")
def sheet(cid: int):
    if not _require_login():
        return redirect(url_for("auth.login_get"))
    char = Character.query.get_or_404(cid)
    return render_template("characters/sheet.html",
        char=char, data=char.to_sheet_dict(),
        can_edit=_can_edit_character(char),
        can_delete=_can_delete_character(char))

@characters_bp.post("/<int:cid>/delete")
def delete(cid: int):
    if not _require_login():
        return redirect(url_for("auth.login_get"))
    char = Character.query.get_or_404(cid)
    if not _can_delete_character(char):
        flash("You don't have permission to delete this character.", "error")
        return redirect(url_for("characters.sheet", cid=cid))
    campaign_id = char.campaign_id
    is_npc = char.is_npc
    db.session.delete(char)
    db.session.commit()
    flash("Character deleted.", "ok")
    if campaign_id:
        return redirect(url_for("campaigns.view", cid=campaign_id))
    return redirect(url_for("dm.dashboard") if is_npc else url_for("player.dashboard"))

# ─── AI ENDPOINTS ────────────────────────────────────────────────────────────

@characters_bp.post("/ai_step")
def ai_step():
    """AI guidance for each wizard step — returns contextual advice."""
    if not session.get("user_id"):
        return jsonify({"error": "Not logged in"}), 401
    data = request.json or {}
    step = data.get("step", "general")
    build = data.get("build", {})
    user_message = data.get("message", f"Tell me about the {step} step.")

    url = current_app.config["OLLAMA_URL"]
    model = current_app.config["OLLAMA_MODEL"]
    messages = step_prompt(step, build, user_message)
    reply = ollama_chat(url, model, messages)
    return jsonify({"reply": reply})

@characters_bp.post("/ai_npc")
def ai_npc():
    """AI generates a full NPC stat block from a description."""
    if not session.get("user_id"):
        return jsonify({"error": "Not logged in"}), 401
    role = session.get("role")
    if role not in ("dm", "admin"):
        return jsonify({"error": "DM access required"}), 403

    data = request.json or {}
    description = (data.get("description") or "").strip()
    if not description:
        return jsonify({"error": "Description required"}), 400

    url = current_app.config["OLLAMA_URL"]
    model = current_app.config["OLLAMA_MODEL"]
    result = generate_npc(url, model, description)

    if isinstance(result, dict):
        return jsonify({"ok": True, "npc": result})
    return jsonify({"ok": False, "error": result}), 500
