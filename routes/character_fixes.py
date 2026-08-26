from __future__ import annotations

import json
import logging

from flask import Blueprint, current_app, flash, redirect, request, session, url_for

from db import db
from models import Campaign, CampaignMembership, Character
from services import srd_service

logger = logging.getLogger(__name__)

character_fixes_bp = Blueprint("character_fixes", __name__)


def _score(form, key: str) -> int:
    """Parse and constrain an ability score supplied by the wizard."""
    try:
        return max(1, min(20, int(form.get(key, 10) or 10)))
    except (TypeError, ValueError):
        logger.warning("Invalid ability score for %s; using 10", key)
        return 10


def _authorized_for_campaign(campaign_id: int | None, user_id: int, role: str) -> bool:
    """Prevent a character from being silently attached to an unrelated campaign."""
    if campaign_id is None or role in ("admin", "dm"):
        return True

    membership = CampaignMembership.query.filter_by(
        campaign_id=campaign_id,
        user_id=user_id,
        approved=True,
    ).first()
    return membership is not None


def _class_skill_names(class_info: dict) -> list[str]:
    return list(class_info.get("skill_choices", []))


@character_fixes_bp.post("/characters/create_v2")
def create_v2():
    """Create a character with validated race bonuses and class skill choices.

    This endpoint deliberately lives beside the legacy creator. That lets us
    harden the wizard without replacing the working legacy route in-place.
    """
    if not session.get("user_id"):
        flash("Please log in.", "error")
        return redirect(url_for("auth.login_get"))

    try:
        uid = int(session["user_id"])
        role = session.get("role", "player")
        form = request.form

        campaign_id = form.get("campaign_id", type=int)
        if not _authorized_for_campaign(campaign_id, uid, role):
            flash("You are not approved to place a character in that campaign.", "error")
            return redirect(url_for("player.dashboard"))

        is_npc = (form.get("is_npc", "false").lower() == "true")
        if is_npc and role not in ("dm", "admin"):
            flash("Only DMs and Admins can create NPCs.", "error")
            return redirect(url_for("auth.login_get"))

        race_name = form.get("race", "Human")
        class_name = form.get("char_class", "Fighter")
        background_name = form.get("background", "Soldier")
        alignment = form.get("alignment", "True Neutral")
        level = max(1, min(20, int(form.get("level", 1) or 1)))

        race = srd_service.get_race(race_name)
        class_info = srd_service.get_class(class_name)
        background = srd_service.get_background(background_name)
        if not race or not class_info or not background:
            raise ValueError("The selected race, class, or background is not in the SRD data set.")

        # Start from the values entered in the wizard, then apply the selected
        # race's 2014-style ability bonuses exactly once.
        scores = {
            "strength": _score(form, "strength"),
            "dexterity": _score(form, "dexterity"),
            "constitution": _score(form, "constitution"),
            "intelligence": _score(form, "intelligence"),
            "wisdom": _score(form, "wisdom"),
            "charisma": _score(form, "charisma"),
        }
        for ability, bonus in race.get("ability_bonuses", {}).items():
            if ability in scores:
                scores[ability] = min(20, scores[ability] + int(bonus))

        hit_die = class_info.get("hit_die", "d8")
        hit_die_value = int(hit_die[1:])
        con_mod = srd_service.ability_modifier(scores["constitution"])
        dex_mod = srd_service.ability_modifier(scores["dexterity"])
        proficiency = srd_service.proficiency_bonus(level)

        # Standard 5e hit-point progression: maximum hit die + CON at level 1,
        # then the class's fixed average + CON for each later level.
        max_hp = max(1, hit_die_value + con_mod)
        if level > 1:
            max_hp += (level - 1) * (hit_die_value // 2 + 1 + con_mod)

        hp_override = (form.get("hp_override") or "").strip()
        if hp_override:
            try:
                max_hp = max(1, int(hp_override))
            except ValueError:
                raise ValueError("Hit point override must be a whole number.")

        armor_override = (form.get("armor_class_override") or "").strip()
        if armor_override:
            try:
                armor_class = max(1, int(armor_override))
            except ValueError:
                raise ValueError("Armor Class override must be a whole number.")
        else:
            # The wizard does not currently model equipped armor selection, so
            # this is intentionally the unarmored baseline rather than invented gear.
            armor_class = 10 + dex_mod

        speed = max(0, min(120, int(form.get("speed", race.get("speed", 30)) or race.get("speed", 30))))

        allowed_skills = _class_skill_names(class_info)
        selected_raw = [s.strip() for s in form.get("class_skills", "").split(",") if s.strip()]
        selected = list(dict.fromkeys(selected_raw))
        if "Any" not in allowed_skills:
            invalid = [s for s in selected if s not in allowed_skills]
            if invalid:
                raise ValueError("One or more selected class skills are not valid for this class.")
        if len(selected) != int(class_info.get("num_skills", 0)):
            raise ValueError(
                f"{class_name} requires exactly {class_info.get('num_skills', 0)} class skill choices."
            )

        background_skills = set(background.get("skill_proficiencies", []))
        skill_names = {entry["name"] for entry in srd_service.ALL_SKILLS}
        skill_names.update(background_skills)
        skills = {name: True for name in background_skills | set(selected) if name in skill_names}

        features: list[str] = []
        for current_level in range(1, level + 1):
            features.extend(class_info.get("features_by_level", {}).get(current_level, []))
        features.append(f"Armor Proficiencies: {', '.join(class_info.get('armor_proficiencies', [])) or 'None'}")
        features.append(f"Weapon Proficiencies: {', '.join(class_info.get('weapon_proficiencies', [])) or 'None'}")

        traits_json = json.dumps({
            "personality": form.get("personality_trait", "").strip(),
            "ideal": form.get("ideal", "").strip(),
            "bond": form.get("bond", "").strip(),
            "flaw": form.get("flaw", "").strip(),
        })

        char = Character(
            owner_id=None if is_npc else uid,
            campaign_id=campaign_id,
            is_npc=is_npc,
            name=(form.get("name") or "(unnamed)").strip(),
            level=level,
            char_class=class_name,
            race=race_name,
            background=background_name,
            alignment=alignment,
            strength=scores["strength"],
            dexterity=scores["dexterity"],
            constitution=scores["constitution"],
            intelligence=scores["intelligence"],
            wisdom=scores["wisdom"],
            charisma=scores["charisma"],
            max_hp=max_hp,
            current_hp=max_hp,
            armor_class=armor_class,
            speed=speed,
            proficiency_bonus=proficiency,
            hit_dice=f"{level}{hit_die}",
            build_complete=True,
            build_step=6,
            notes=form.get("notes", "").strip(),
            traits_json=traits_json,
            skills_json=json.dumps(skills),
            saving_throws_json=json.dumps({s: True for s in class_info.get("saving_throws", [])}),
            equipment_json=json.dumps(background.get("equipment", [])),
            features_json=json.dumps(features),
            spells_json=json.dumps({}),
        )

        db.session.add(char)
        db.session.commit()

        flash(f"{'NPC' if is_npc else 'Character'} '{char.name}' created!", "ok")
        if campaign_id:
            return redirect(url_for("campaigns.view", cid=campaign_id))
        if is_npc:
            return redirect(url_for("dm.dashboard"))
        return redirect(url_for("player.dashboard"))

    except (ValueError, TypeError) as exc:
        db.session.rollback()
        logger.warning("Character creation validation failed: %s", exc)
        flash(str(exc), "error")
        return redirect(request.referrer or url_for("player.dashboard"))
    except Exception:
        db.session.rollback()
        logger.exception("Unexpected character creation failure")
        flash("Character creation failed. Nothing was saved.", "error")
        return redirect(request.referrer or url_for("player.dashboard"))
