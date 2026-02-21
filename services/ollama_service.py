from __future__ import annotations
import requests
import json

def ollama_health(url: str) -> bool:
    try:
        r = requests.get(url.rstrip("/") + "/api/tags", timeout=2)
        return r.status_code == 200
    except Exception:
        return False

def ollama_chat(url: str, model: str, messages: list, timeout: int = 60) -> str:
    try:
        r = requests.post(
            url.rstrip("/") + "/api/chat",
            json={"model": model, "messages": messages, "stream": False},
            timeout=timeout
        )
        r.raise_for_status()
        return r.json().get("message", {}).get("content", "").strip()
    except Exception as e:
        return f"[AI unavailable: {e}]"

def simple_completion(url: str, model: str, prompt: str, timeout: int = 90) -> str:
    try:
        r = requests.post(
            url.rstrip("/") + "/api/generate",
            json={"model": model, "prompt": prompt, "stream": False},
            timeout=timeout
        )
        r.raise_for_status()
        return r.json().get("response", "").strip()
    except Exception as e:
        return f"[AI unavailable: {e}]"

# ─── SRD DATA SUMMARY FOR PROMPTS ───────────────────────────────────────────

SRD_PROMPT_SUMMARY = """
=== D&D 5e SRD RULES (immutable source of truth) ===

ABILITY SCORES: STR, DEX, CON, INT, WIS, CHA. Modifier = (score-10)//2.
Proficiency bonus: levels 1-4=+2, 5-8=+3, 9-12=+4, 13-16=+5, 17-20=+6.
Standard array: 15,14,13,12,10,8. Point buy: 27 points, scores 8-15 before racial bonuses.

RACES & BONUSES:
- Dragonborn: STR+2 CHA+1, 30ft, Breath Weapon, Damage Resistance
- Dwarf (Hill): CON+2 WIS+1, 25ft, Darkvision, Dwarven Toughness (+1 HP/level)
- Dwarf (Mountain): CON+2 STR+2, 25ft, Darkvision, Armor Training
- Elf (High): DEX+2 INT+1, 30ft, Darkvision, Trance, Cantrip
- Elf (Wood): DEX+2 WIS+1, 35ft, Darkvision, Fleet of Foot, Mask of the Wild
- Elf (Drow): DEX+2 CHA+1, 30ft, Superior Darkvision, Sunlight Sensitivity
- Gnome (Forest): INT+2 DEX+1, 25ft, Darkvision, Gnome Cunning
- Gnome (Rock): INT+2 CON+1, 25ft, Darkvision, Artificer's Lore
- Half-Elf: CHA+2 + two others+1, 30ft, Darkvision, Skill Versatility (2 skills)
- Half-Orc: STR+2 CON+1, 30ft, Darkvision, Relentless Endurance, Savage Attacks
- Halfling (Lightfoot): DEX+2 CHA+1, 25ft, Lucky, Brave, Naturally Stealthy
- Halfling (Stout): DEX+2 CON+1, 25ft, Lucky, Brave, Stout Resilience
- Human: All stats+1, 30ft, extra language
- Tiefling: INT+1 CHA+2, 30ft, Darkvision, Hellish Resistance, Infernal Legacy

CLASSES (hit die, primary stat, saves):
- Barbarian: d12, STR, STR+CON. Rage, Unarmored Defense (10+CON+DEX), Reckless Attack
- Bard: d8, CHA, DEX+CHA. Spellcasting, Bardic Inspiration, Jack of All Trades
- Cleric: d8, WIS, WIS+CHA. Spellcasting, Divine Domain, Channel Divinity
- Druid: d8, WIS, INT+WIS. Spellcasting, Wild Shape, Druid Circle
- Fighter: d10, STR or DEX, STR+CON. Fighting Style, Second Wind, Action Surge
- Monk: d8, DEX+WIS, STR+DEX. Martial Arts, Ki, Unarmored Defense (10+DEX+WIS)
- Paladin: d10, STR+CHA, WIS+CHA. Lay on Hands, Divine Smite, Aura of Protection
- Ranger: d10, DEX+WIS, STR+DEX. Favored Enemy, Natural Explorer, Spellcasting
- Rogue: d8, DEX, DEX+INT. Sneak Attack, Cunning Action, Expertise
- Sorcerer: d6, CHA, CON+CHA. Spellcasting, Sorcerous Origin, Font of Magic
- Warlock: d8, CHA, WIS+CHA. Pact Magic (short rest slots), Eldritch Invocations
- Wizard: d6, INT, INT+WIS. Spellcasting, Arcane Recovery, Spell Mastery

BACKGROUNDS (skill proficiencies):
Acolyte: Insight+Religion | Criminal: Deception+Stealth | Folk Hero: Animal Handling+Survival
Noble: History+Persuasion | Sage: Arcana+History | Soldier: Athletics+Intimidation
Charlatan: Deception+Sleight of Hand | Entertainer: Acrobatics+Performance
Guild Artisan: Insight+Persuasion | Hermit: Medicine+Religion | Outlander: Athletics+Survival
Sailor: Athletics+Perception | Urchin: Sleight of Hand+Stealth

SKILLS (ability): Acrobatics(DEX) Animal Handling(WIS) Arcana(INT) Athletics(STR)
Deception(CHA) History(INT) Insight(WIS) Intimidation(CHA) Investigation(INT)
Medicine(WIS) Nature(INT) Perception(WIS) Performance(CHA) Persuasion(CHA)
Religion(INT) Sleight of Hand(DEX) Stealth(DEX) Survival(WIS)

HP CALCULATION: Max HP = hit die max + CON modifier + (level-1) × (avg hit die + CON modifier)
AC (unarmored): 10 + DEX modifier (unless class feature changes this)
Initiative: DEX modifier
Spell Save DC: 8 + proficiency bonus + spellcasting ability modifier
Spell Attack: proficiency bonus + spellcasting ability modifier
"""

# ─── WIZARD STEP PROMPTS ────────────────────────────────────────────────────

def step_prompt(step: str, build: dict, user_message: str) -> list:
    """Build a messages list for a specific wizard step."""
    build_summary = _build_summary(build)

    step_contexts = {
        "race": f"""You are a D&D 5e expert DM helping a player choose their RACE.
Current build: {build_summary}
Explain the chosen race's traits and ability bonuses. Tell the player how this race synergizes (or doesn't) with any class they've mentioned.
Be specific: give exact bonuses, traits, and how they affect gameplay. Keep it under 120 words. End with one focused question or recommendation.""",

        "class": f"""You are a D&D 5e expert DM helping a player choose their CLASS.
Current build: {build_summary}
Explain the chosen class's role, hit die, primary ability, saving throws, and key level 1-2 features.
Tell them what ability scores to prioritize given their race choice. Keep it under 150 words. End with a specific tip about their combination.""",

        "background": f"""You are a D&D 5e expert DM helping a player choose their BACKGROUND.
Current build: {build_summary}
Explain the background's skill proficiencies and feature. Tell them how it fits their race+class combo narratively and mechanically.
Keep it under 100 words.""",

        "abilities": f"""You are a D&D 5e expert DM helping a player assign ABILITY SCORES.
Current build: {build_summary}
{SRD_PROMPT_SUMMARY}
Given their race and class, recommend exactly how to assign the standard array (15,14,13,12,10,8) to their six stats.
Be specific: "Put 15 in STR, 14 in CON..." etc. Explain why each placement matters for their class. Under 150 words.""",

        "personality": f"""You are a D&D 5e expert DM helping a player define their CHARACTER PERSONALITY.
Current build: {build_summary}
Help them write a Personality Trait, Ideal, Bond, and Flaw that fit their race/class/background combo.
Give concrete suggestions — don't be vague. Under 120 words.""",

        "general": f"""You are a D&D 5e expert DM helping a player build their character.
Current build: {build_summary}
{SRD_PROMPT_SUMMARY}
Answer the player's question accurately using SRD 5e rules only. Be specific and concise. Under 150 words.""",
    }

    system = step_contexts.get(step, step_contexts["general"])

    return [
        {"role": "system", "content": system + "\n\n" + SRD_PROMPT_SUMMARY},
        {"role": "user", "content": user_message}
    ]

def _build_summary(build: dict) -> str:
    parts = []
    if build.get("name"): parts.append(f"Name: {build['name']}")
    if build.get("race"): parts.append(f"Race: {build['race']}")
    if build.get("char_class"): parts.append(f"Class: {build['char_class']}")
    if build.get("background"): parts.append(f"Background: {build['background']}")
    if build.get("level"): parts.append(f"Level: {build['level']}")
    for stat in ["strength","dexterity","constitution","intelligence","wisdom","charisma"]:
        if build.get(stat): parts.append(f"{stat[:3].upper()}: {build[stat]}")
    return ", ".join(parts) if parts else "Just starting out"

# ─── AI NPC GENERATOR ───────────────────────────────────────────────────────

NPC_GENERATION_PROMPT = """You are a D&D 5e expert. Generate a complete NPC/monster stat block from a description.
You MUST respond with ONLY valid JSON — no markdown, no explanation, just the JSON object.

{srd}

Generate a stat block following these exact D&D 5e rules:
- HP = hit die max + CON mod + (level-1) × (avg hit die + CON mod)  
- AC = 10 + DEX mod if unarmored, or appropriate armor
- Proficiency bonus based on CR/level (1-4=+2, 5-8=+3, 9-12=+4, 13-16=+5, 17-20=+6)
- All 6 ability scores (reasonable for the creature type, 3-20 range for humanoids, up to 30 for powerful monsters)

Return exactly this JSON structure:
{{
  "name": "string",
  "race": "string (creature type: Humanoid, Undead, Beast, etc)",
  "char_class": "string (Fighter/Rogue/Wizard etc or Monster Type)",
  "level": number,
  "alignment": "string",
  "strength": number,
  "dexterity": number,
  "constitution": number,
  "intelligence": number,
  "wisdom": number,
  "charisma": number,
  "armor_class": number,
  "max_hp": number,
  "speed": number,
  "notes": "string (special abilities, attacks, traits — be specific with dice notation)",
  "reasoning": "string (brief explanation of stat choices)"
}}

NPC Description: {description}"""

def generate_npc(url: str, model: str, description: str) -> dict | str:
    """Generate a full NPC stat block from a text description. Returns dict or error string."""
    prompt = NPC_GENERATION_PROMPT.format(srd=SRD_PROMPT_SUMMARY, description=description)
    raw = simple_completion(url, model, prompt, timeout=120)

    # Try to parse JSON from the response
    import re
    # Strip markdown code blocks if present
    raw = re.sub(r'```json\s*', '', raw)
    raw = re.sub(r'```\s*', '', raw)
    raw = raw.strip()

    # Find JSON object in response
    match = re.search(r'\{.*\}', raw, re.DOTALL)
    if match:
        try:
            data = json.loads(match.group())
            return data
        except json.JSONDecodeError:
            pass

    return f"Could not parse AI response. Raw: {raw[:300]}"
