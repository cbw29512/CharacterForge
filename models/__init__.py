from __future__ import annotations
from datetime import datetime
from db import db


class User(db.Model):
    __tablename__ = "users"
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False, default="player")
    display_name = db.Column(db.String(120), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    characters = db.relationship("Character", backref="owner", lazy=True, foreign_keys="Character.owner_id")
    memberships = db.relationship("CampaignMembership", backref="user", lazy=True)
    templates = db.relationship("CharacterTemplate", backref="creator", lazy=True, cascade="all, delete-orphan")

    def to_dict(self):
        return {"id": self.id, "username": self.username, "role": self.role, "display_name": self.display_name or self.username}


class Campaign(db.Model):
    __tablename__ = "campaigns"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    dm_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    dm = db.relationship("User", foreign_keys=[dm_id])
    memberships = db.relationship("CampaignMembership", backref="campaign", lazy=True, cascade="all, delete-orphan")
    characters = db.relationship("Character", backref="campaign", lazy=True, cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id, "name": self.name, "description": self.description,
            "dm_id": self.dm_id,
            "dm_name": self.dm.display_name or self.dm.username if self.dm else "Unknown",
            "player_count": len([m for m in self.memberships if m.role == "player" and m.approved]),
            "character_count": len([c for c in self.characters if not c.is_npc]),
            "created_at": self.created_at.isoformat(),
        }


class CampaignMembership(db.Model):
    __tablename__ = "campaign_memberships"
    id = db.Column(db.Integer, primary_key=True)
    campaign_id = db.Column(db.Integer, db.ForeignKey("campaigns.id"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    role = db.Column(db.String(20), nullable=False, default="player")
    approved = db.Column(db.Boolean, default=False, nullable=False)
    joined_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (db.UniqueConstraint("campaign_id", "user_id"),)


class CharacterTemplate(db.Model):
    """
    Saved character builds that can be quickly reused.
    Stores the full build config — players save their own, DMs save NPC archetypes.
    """
    __tablename__ = "character_templates"
    id = db.Column(db.Integer, primary_key=True)
    owner_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    name = db.Column(db.String(200), nullable=False)           # Template label, e.g. "Tank Fighter Build"
    is_npc_template = db.Column(db.Boolean, default=False)    # True = NPC archetype, False = PC template
    description = db.Column(db.Text, nullable=True)            # Short description of the template

    # Core build data
    race = db.Column(db.String(80), nullable=True)
    char_class = db.Column(db.String(80), nullable=True)
    background = db.Column(db.String(80), nullable=True)
    alignment = db.Column(db.String(40), nullable=True)
    level = db.Column(db.Integer, default=1)

    # Ability scores
    strength = db.Column(db.Integer, default=10)
    dexterity = db.Column(db.Integer, default=10)
    constitution = db.Column(db.Integer, default=10)
    intelligence = db.Column(db.Integer, default=10)
    wisdom = db.Column(db.Integer, default=10)
    charisma = db.Column(db.Integer, default=10)

    # Personality
    traits_json = db.Column(db.Text, default="{}")
    notes = db.Column(db.Text, nullable=True)

    times_used = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    def to_dict(self):
        import json
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "is_npc_template": self.is_npc_template,
            "race": self.race,
            "char_class": self.char_class,
            "background": self.background,
            "alignment": self.alignment,
            "level": self.level,
            "strength": self.strength,
            "dexterity": self.dexterity,
            "constitution": self.constitution,
            "intelligence": self.intelligence,
            "wisdom": self.wisdom,
            "charisma": self.charisma,
            "traits": json.loads(self.traits_json or "{}"),
            "notes": self.notes,
            "times_used": self.times_used,
        }


class Character(db.Model):
    __tablename__ = "characters"
    id = db.Column(db.Integer, primary_key=True)
    owner_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    campaign_id = db.Column(db.Integer, db.ForeignKey("campaigns.id"), nullable=True)
    is_npc = db.Column(db.Boolean, default=False, nullable=False)

    name = db.Column(db.String(200), nullable=False, default="(unnamed)")
    level = db.Column(db.Integer, default=1, nullable=False)
    char_class = db.Column(db.String(80), nullable=True)
    subclass = db.Column(db.String(80), nullable=True)
    race = db.Column(db.String(80), nullable=True)
    background = db.Column(db.String(80), nullable=True)
    alignment = db.Column(db.String(40), nullable=True)
    experience_points = db.Column(db.Integer, default=0)

    strength = db.Column(db.Integer, default=10)
    dexterity = db.Column(db.Integer, default=10)
    constitution = db.Column(db.Integer, default=10)
    intelligence = db.Column(db.Integer, default=10)
    wisdom = db.Column(db.Integer, default=10)
    charisma = db.Column(db.Integer, default=10)

    max_hp = db.Column(db.Integer, default=0)
    current_hp = db.Column(db.Integer, default=0)
    temp_hp = db.Column(db.Integer, default=0)
    armor_class = db.Column(db.Integer, default=10)
    initiative = db.Column(db.Integer, default=0)
    speed = db.Column(db.Integer, default=30)
    proficiency_bonus = db.Column(db.Integer, default=2)
    hit_dice = db.Column(db.String(20), nullable=True)

    skills_json = db.Column(db.Text, default="{}")
    saving_throws_json = db.Column(db.Text, default="{}")
    equipment_json = db.Column(db.Text, default="[]")
    spells_json = db.Column(db.Text, default="{}")
    features_json = db.Column(db.Text, default="[]")
    traits_json = db.Column(db.Text, default="{}")
    attacks_json = db.Column(db.Text, default="[]")
    notes = db.Column(db.Text, nullable=True)

    build_step = db.Column(db.Integer, default=0)
    build_complete = db.Column(db.Boolean, default=False)

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def ability_modifier(self, score: int) -> int:
        return (score - 10) // 2

    def to_card_dict(self):
        return {
            "id": self.id, "name": self.name, "level": self.level,
            "char_class": self.char_class or "—", "race": self.race or "—",
            "background": self.background or "—",
            "current_hp": self.current_hp, "max_hp": self.max_hp,
            "armor_class": self.armor_class, "is_npc": self.is_npc,
            "build_complete": self.build_complete, "owner_id": self.owner_id,
        }

    def to_sheet_dict(self):
        import json
        d = self.to_card_dict()
        d.update({
            "strength": self.strength, "dexterity": self.dexterity,
            "constitution": self.constitution, "intelligence": self.intelligence,
            "wisdom": self.wisdom, "charisma": self.charisma,
            "str_mod": self.ability_modifier(self.strength),
            "dex_mod": self.ability_modifier(self.dexterity),
            "con_mod": self.ability_modifier(self.constitution),
            "int_mod": self.ability_modifier(self.intelligence),
            "wis_mod": self.ability_modifier(self.wisdom),
            "cha_mod": self.ability_modifier(self.charisma),
            "temp_hp": self.temp_hp, "initiative": self.initiative,
            "speed": self.speed, "proficiency_bonus": self.proficiency_bonus,
            "hit_dice": self.hit_dice, "alignment": self.alignment,
            "experience_points": self.experience_points, "subclass": self.subclass,
            "skills": json.loads(self.skills_json or "{}"),
            "saving_throws": json.loads(self.saving_throws_json or "{}"),
            "equipment": json.loads(self.equipment_json or "[]"),
            "spells": json.loads(self.spells_json or "{}"),
            "features": json.loads(self.features_json or "[]"),
            "traits": json.loads(self.traits_json or "{}"),
            "attacks": json.loads(self.attacks_json or "[]"),
            "notes": self.notes,
        })
        return d

    def to_template(self, template_name: str, description: str = "") -> CharacterTemplate:
        """Snapshot this character into a reusable template."""
        import json
        return CharacterTemplate(
            owner_id=self.owner_id,
            name=template_name,
            description=description,
            is_npc_template=self.is_npc,
            race=self.race,
            char_class=self.char_class,
            background=self.background,
            alignment=self.alignment,
            level=self.level,
            strength=self.strength, dexterity=self.dexterity,
            constitution=self.constitution, intelligence=self.intelligence,
            wisdom=self.wisdom, charisma=self.charisma,
            traits_json=self.traits_json or "{}",
            notes=self.notes,
        )
