"""
SRD 5.1 data — immutable source of truth for CharacterForge.
All character builds must validate against this data.
"""
from __future__ import annotations

SRD_RACES = [
    {"name": "Dragonborn", "speed": 30, "ability_bonuses": {"strength": 2, "charisma": 1}, "traits": ["Draconic Ancestry", "Breath Weapon", "Damage Resistance"]},
    {"name": "Dwarf (Hill)", "speed": 25, "ability_bonuses": {"constitution": 2, "wisdom": 1}, "traits": ["Darkvision", "Dwarven Resilience", "Stonecunning", "Dwarven Toughness"]},
    {"name": "Dwarf (Mountain)", "speed": 25, "ability_bonuses": {"constitution": 2, "strength": 2}, "traits": ["Darkvision", "Dwarven Resilience", "Stonecunning", "Dwarven Armor Training"]},
    {"name": "Elf (High)", "speed": 30, "ability_bonuses": {"dexterity": 2, "intelligence": 1}, "traits": ["Darkvision", "Keen Senses", "Fey Ancestry", "Trance", "Elf Weapon Training", "Cantrip", "Extra Language"]},
    {"name": "Elf (Wood)", "speed": 35, "ability_bonuses": {"dexterity": 2, "wisdom": 1}, "traits": ["Darkvision", "Keen Senses", "Fey Ancestry", "Trance", "Elf Weapon Training", "Fleet of Foot", "Mask of the Wild"]},
    {"name": "Elf (Drow)", "speed": 30, "ability_bonuses": {"dexterity": 2, "charisma": 1}, "traits": ["Superior Darkvision", "Keen Senses", "Fey Ancestry", "Trance", "Sunlight Sensitivity", "Drow Magic", "Drow Weapon Training"]},
    {"name": "Gnome (Forest)", "speed": 25, "ability_bonuses": {"intelligence": 2, "dexterity": 1}, "traits": ["Darkvision", "Gnome Cunning", "Natural Illusionist", "Speak with Small Beasts"]},
    {"name": "Gnome (Rock)", "speed": 25, "ability_bonuses": {"intelligence": 2, "constitution": 1}, "traits": ["Darkvision", "Gnome Cunning", "Artificer's Lore", "Tinker"]},
    {"name": "Half-Elf", "speed": 30, "ability_bonuses": {"charisma": 2}, "traits": ["Darkvision", "Fey Ancestry", "Skill Versatility"]},
    {"name": "Half-Orc", "speed": 30, "ability_bonuses": {"strength": 2, "constitution": 1}, "traits": ["Darkvision", "Menacing", "Relentless Endurance", "Savage Attacks"]},
    {"name": "Halfling (Lightfoot)", "speed": 25, "ability_bonuses": {"dexterity": 2, "charisma": 1}, "traits": ["Lucky", "Brave", "Halfling Nimbleness", "Naturally Stealthy"]},
    {"name": "Halfling (Stout)", "speed": 25, "ability_bonuses": {"dexterity": 2, "constitution": 1}, "traits": ["Lucky", "Brave", "Halfling Nimbleness", "Stout Resilience"]},
    {"name": "Human", "speed": 30, "ability_bonuses": {"strength": 1, "dexterity": 1, "constitution": 1, "intelligence": 1, "wisdom": 1, "charisma": 1}, "traits": ["Extra Language"]},
    {"name": "Tiefling", "speed": 30, "ability_bonuses": {"intelligence": 1, "charisma": 2}, "traits": ["Darkvision", "Hellish Resistance", "Infernal Legacy"]},
]

SRD_CLASSES = [
    {"name": "Barbarian", "hit_die": "d12", "primary_ability": "Strength", "saving_throws": ["Strength", "Constitution"],
     "armor_proficiencies": ["Light armor", "Medium armor", "Shields"],
     "weapon_proficiencies": ["Simple weapons", "Martial weapons"],
     "skill_choices": ["Animal Handling", "Athletics", "Intimidation", "Nature", "Perception", "Survival"], "num_skills": 2,
     "features_by_level": {1: ["Rage", "Unarmored Defense"], 2: ["Reckless Attack", "Danger Sense"]}},
    {"name": "Bard", "hit_die": "d8", "primary_ability": "Charisma", "saving_throws": ["Dexterity", "Charisma"],
     "armor_proficiencies": ["Light armor"],
     "weapon_proficiencies": ["Simple weapons", "Hand crossbows", "Longswords", "Rapiers", "Shortswords"],
     "skill_choices": ["Any"], "num_skills": 3,
     "features_by_level": {1: ["Spellcasting", "Bardic Inspiration (d6)"], 2: ["Jack of All Trades", "Song of Rest (d6)"]}},
    {"name": "Cleric", "hit_die": "d8", "primary_ability": "Wisdom", "saving_throws": ["Wisdom", "Charisma"],
     "armor_proficiencies": ["Light armor", "Medium armor", "Shields"],
     "weapon_proficiencies": ["Simple weapons"],
     "skill_choices": ["History", "Insight", "Medicine", "Persuasion", "Religion"], "num_skills": 2,
     "features_by_level": {1: ["Spellcasting", "Divine Domain"], 2: ["Channel Divinity (1/rest)", "Divine Domain Feature"]}},
    {"name": "Druid", "hit_die": "d8", "primary_ability": "Wisdom", "saving_throws": ["Intelligence", "Wisdom"],
     "armor_proficiencies": ["Light armor (nonmetal)", "Medium armor (nonmetal)", "Shields (nonmetal)"],
     "weapon_proficiencies": ["Clubs", "Daggers", "Darts", "Javelins", "Maces", "Quarterstaffs", "Scimitars", "Sickles", "Slings", "Spears"],
     "skill_choices": ["Arcana", "Animal Handling", "Insight", "Medicine", "Nature", "Perception", "Religion", "Survival"], "num_skills": 2,
     "features_by_level": {1: ["Druidic", "Spellcasting"], 2: ["Wild Shape", "Druid Circle"]}},
    {"name": "Fighter", "hit_die": "d10", "primary_ability": "Strength or Dexterity", "saving_throws": ["Strength", "Constitution"],
     "armor_proficiencies": ["All armor", "Shields"],
     "weapon_proficiencies": ["Simple weapons", "Martial weapons"],
     "skill_choices": ["Acrobatics", "Animal Handling", "Athletics", "History", "Insight", "Intimidation", "Perception", "Survival"], "num_skills": 2,
     "features_by_level": {1: ["Fighting Style", "Second Wind"], 2: ["Action Surge (one use)"]}},
    {"name": "Monk", "hit_die": "d8", "primary_ability": "Dexterity & Wisdom", "saving_throws": ["Strength", "Dexterity"],
     "armor_proficiencies": [],
     "weapon_proficiencies": ["Simple weapons", "Shortswords"],
     "skill_choices": ["Acrobatics", "Athletics", "History", "Insight", "Religion", "Stealth"], "num_skills": 2,
     "features_by_level": {1: ["Unarmored Defense", "Martial Arts"], 2: ["Ki", "Unarmored Movement"]}},
    {"name": "Paladin", "hit_die": "d10", "primary_ability": "Strength & Charisma", "saving_throws": ["Wisdom", "Charisma"],
     "armor_proficiencies": ["All armor", "Shields"],
     "weapon_proficiencies": ["Simple weapons", "Martial weapons"],
     "skill_choices": ["Athletics", "Insight", "Intimidation", "Medicine", "Persuasion", "Religion"], "num_skills": 2,
     "features_by_level": {1: ["Divine Sense", "Lay on Hands"], 2: ["Fighting Style", "Spellcasting", "Divine Smite"]}},
    {"name": "Ranger", "hit_die": "d10", "primary_ability": "Dexterity & Wisdom", "saving_throws": ["Strength", "Dexterity"],
     "armor_proficiencies": ["Light armor", "Medium armor", "Shields"],
     "weapon_proficiencies": ["Simple weapons", "Martial weapons"],
     "skill_choices": ["Animal Handling", "Athletics", "Insight", "Investigation", "Nature", "Perception", "Stealth", "Survival"], "num_skills": 3,
     "features_by_level": {1: ["Favored Enemy", "Natural Explorer"], 2: ["Fighting Style", "Spellcasting"]}},
    {"name": "Rogue", "hit_die": "d8", "primary_ability": "Dexterity", "saving_throws": ["Dexterity", "Intelligence"],
     "armor_proficiencies": ["Light armor"],
     "weapon_proficiencies": ["Simple weapons", "Hand crossbows", "Longswords", "Rapiers", "Shortswords"],
     "skill_choices": ["Acrobatics", "Athletics", "Deception", "Insight", "Intimidation", "Investigation", "Perception", "Performance", "Persuasion", "Sleight of Hand", "Stealth"], "num_skills": 4,
     "features_by_level": {1: ["Expertise", "Sneak Attack (1d6)", "Thieves' Cant"], 2: ["Cunning Action"]}},
    {"name": "Sorcerer", "hit_die": "d6", "primary_ability": "Charisma", "saving_throws": ["Constitution", "Charisma"],
     "armor_proficiencies": [],
     "weapon_proficiencies": ["Daggers", "Darts", "Slings", "Quarterstaffs", "Light crossbows"],
     "skill_choices": ["Arcana", "Deception", "Insight", "Intimidation", "Persuasion", "Religion"], "num_skills": 2,
     "features_by_level": {1: ["Spellcasting", "Sorcerous Origin"], 2: ["Font of Magic"]}},
    {"name": "Warlock", "hit_die": "d8", "primary_ability": "Charisma", "saving_throws": ["Wisdom", "Charisma"],
     "armor_proficiencies": ["Light armor"],
     "weapon_proficiencies": ["Simple weapons"],
     "skill_choices": ["Arcana", "Deception", "History", "Intimidation", "Investigation", "Nature", "Religion"], "num_skills": 2,
     "features_by_level": {1: ["Otherworldly Patron", "Pact Magic"], 2: ["Eldritch Invocations"]}},
    {"name": "Wizard", "hit_die": "d6", "primary_ability": "Intelligence", "saving_throws": ["Intelligence", "Wisdom"],
     "armor_proficiencies": [],
     "weapon_proficiencies": ["Daggers", "Darts", "Slings", "Quarterstaffs", "Light crossbows"],
     "skill_choices": ["Arcana", "History", "Insight", "Investigation", "Medicine", "Religion"], "num_skills": 2,
     "features_by_level": {1: ["Spellcasting", "Arcane Recovery"], 2: ["Arcane Tradition"]}},
]

SRD_BACKGROUNDS = [
    {"name": "Acolyte", "skill_proficiencies": ["Insight", "Religion"], "equipment": ["Holy symbol", "Prayer book", "5 sticks of incense", "Vestments", "Common clothes", "15 gp pouch"], "feature": "Shelter of the Faithful"},
    {"name": "Criminal", "skill_proficiencies": ["Deception", "Stealth"], "equipment": ["Crowbar", "Dark common clothes with hood", "15 gp pouch"], "feature": "Criminal Contact"},
    {"name": "Folk Hero", "skill_proficiencies": ["Animal Handling", "Survival"], "equipment": ["Artisan's tools", "Shovel", "Iron pot", "Common clothes", "10 gp pouch"], "feature": "Rustic Hospitality"},
    {"name": "Noble", "skill_proficiencies": ["History", "Persuasion"], "equipment": ["Fine clothes", "Signet ring", "Scroll of pedigree", "25 gp purse"], "feature": "Position of Privilege"},
    {"name": "Sage", "skill_proficiencies": ["Arcana", "History"], "equipment": ["Bottle of ink", "Quill", "Small knife", "Letter with unanswered question", "Common clothes", "10 gp pouch"], "feature": "Researcher"},
    {"name": "Soldier", "skill_proficiencies": ["Athletics", "Intimidation"], "equipment": ["Insignia of rank", "Trophy from fallen enemy", "Deck of cards", "Common clothes", "10 gp pouch"], "feature": "Military Rank"},
    {"name": "Charlatan", "skill_proficiencies": ["Deception", "Sleight of Hand"], "equipment": ["Fine clothes", "Disguise kit", "Con tools", "15 gp pouch"], "feature": "False Identity"},
    {"name": "Entertainer", "skill_proficiencies": ["Acrobatics", "Performance"], "equipment": ["Musical instrument", "Favor of admirer", "Costume", "15 gp pouch"], "feature": "By Popular Demand"},
    {"name": "Guild Artisan", "skill_proficiencies": ["Insight", "Persuasion"], "equipment": ["Artisan's tools", "Letter of introduction", "Traveler's clothes", "15 gp pouch"], "feature": "Guild Membership"},
    {"name": "Hermit", "skill_proficiencies": ["Medicine", "Religion"], "equipment": ["Scroll case with notes", "Winter blanket", "Common clothes", "Herbalism kit", "5 gp"], "feature": "Discovery"},
    {"name": "Outlander", "skill_proficiencies": ["Athletics", "Survival"], "equipment": ["Staff", "Hunting trap", "Trophy from animal", "Traveler's clothes", "10 gp pouch"], "feature": "Wanderer"},
    {"name": "Sailor", "skill_proficiencies": ["Athletics", "Perception"], "equipment": ["Belaying pin", "50 feet silk rope", "Lucky charm", "Common clothes", "10 gp pouch"], "feature": "Ship's Passage"},
    {"name": "Urchin", "skill_proficiencies": ["Sleight of Hand", "Stealth"], "equipment": ["Small knife", "Map of home city", "Pet mouse", "Token from parents", "Common clothes", "10 gp pouch"], "feature": "City Secrets"},
]

SRD_ALIGNMENTS = [
    "Lawful Good", "Neutral Good", "Chaotic Good",
    "Lawful Neutral", "True Neutral", "Chaotic Neutral",
    "Lawful Evil", "Neutral Evil", "Chaotic Evil"
]

ALL_SKILLS = [
    {"name": "Acrobatics", "ability": "dexterity"},
    {"name": "Animal Handling", "ability": "wisdom"},
    {"name": "Arcana", "ability": "intelligence"},
    {"name": "Athletics", "ability": "strength"},
    {"name": "Deception", "ability": "charisma"},
    {"name": "History", "ability": "intelligence"},
    {"name": "Insight", "ability": "wisdom"},
    {"name": "Intimidation", "ability": "charisma"},
    {"name": "Investigation", "ability": "intelligence"},
    {"name": "Medicine", "ability": "wisdom"},
    {"name": "Nature", "ability": "intelligence"},
    {"name": "Perception", "ability": "wisdom"},
    {"name": "Performance", "ability": "charisma"},
    {"name": "Persuasion", "ability": "charisma"},
    {"name": "Religion", "ability": "intelligence"},
    {"name": "Sleight of Hand", "ability": "dexterity"},
    {"name": "Stealth", "ability": "dexterity"},
    {"name": "Survival", "ability": "wisdom"},
]

PROFICIENCY_BY_LEVEL = {
    1: 2, 2: 2, 3: 2, 4: 2, 5: 3, 6: 3, 7: 3, 8: 3,
    9: 4, 10: 4, 11: 4, 12: 4, 13: 5, 14: 5, 15: 5, 16: 5,
    17: 6, 18: 6, 19: 6, 20: 6,
}

def get_race(name: str) -> dict | None:
    return next((r for r in SRD_RACES if r["name"] == name), None)

def get_class(name: str) -> dict | None:
    return next((c for c in SRD_CLASSES if c["name"] == name), None)

def get_background(name: str) -> dict | None:
    return next((b for b in SRD_BACKGROUNDS if b["name"] == name), None)

def proficiency_bonus(level: int) -> int:
    return PROFICIENCY_BY_LEVEL.get(level, 2)

def ability_modifier(score: int) -> int:
    return (score - 10) // 2
