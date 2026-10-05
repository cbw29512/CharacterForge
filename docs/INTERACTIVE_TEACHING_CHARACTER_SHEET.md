# Interactive Teaching Character Sheet

CharacterForge's character builder must function as both a legal character sheet and an interactive D&D course.

## Product idea

A user should be able to build a D&D character by filling out the sheet directly. Every field, dropdown, score, feature, spell, proficiency, weapon, armor choice, and derived number should explain:

1. **What this is.**
2. **Why it matters.**
3. **What it affects.**
4. **What affects it.**
5. **Why someone would choose this option.**
6. **What tradeoffs it creates.**
7. **What other parts of the character it connects to.**
8. **How it appears during actual play.**
9. **How the rule differs between 2014 and 2024, when applicable.**
10. **What advanced players should know about optimization and edge cases.**

The system must remain understandable to a complete beginner while still being useful to an expert optimizer.

## Interaction model

The character sheet itself is the builder.

Users should not need to complete a wizard and then discover what the resulting sheet means.

Examples:

### Ability score dropdown / selector

When the user selects or changes **Strength**, show:

**Simple**
> Strength measures physical power. It commonly affects melee attacks, Athletics, carrying, and Strength saving throws.

**Connected to**
- melee attack rolls for Strength-based weapons;
- melee damage for those weapons;
- Athletics;
- Strength saves;
- carrying capacity;
- armor or multiclass prerequisites where applicable.

**Why increase it**
> Good for characters who attack with heavy or Strength-based weapons, grapple, shove, or solve physical problems.

**What changes now**
> STR 16 → 18 changes your modifier from +3 to +4. Your affected attack rolls, damage rolls, Athletics checks, and Strength saves increase by 1.

**Advanced**
> Explain breakpoints, proficiency interaction, feat prerequisites, equipment implications, and build-specific opportunity cost.

### Class dropdown

Selecting **Fighter** should explain:
- what the Fighter is generally good at;
- durability;
- weapon use;
- armor;
- action economy;
- common party roles;
- complexity;
- what ability scores usually matter;
- how subclasses change the role;
- what major decisions arrive at later levels;
- how the choice compares with similar classes.

### Skill dropdown

Selecting **Stealth** should explain:
- which ability normally powers it;
- how proficiency changes it;
- what armor or conditions may affect it;
- common table uses;
- examples of what a DM might call for;
- why a Rogue/Ranger may value it;
- when a different skill might be more appropriate.

### Weapon dropdown

Selecting a weapon should explain:
- attack ability;
- proficiency requirement;
- damage die/type;
- range or reach;
- hands required;
- weapon properties;
- mastery interaction for 2024 when applicable;
- what builds commonly use it;
- how it changes the user's attack line;
- whether another weapon is mechanically stronger for the declared build goal.

### Spell selector

Each spell choice should explain:
- action type;
- range;
- target;
- attack roll or saving throw;
- damage/healing/control;
- concentration;
- duration;
- resource cost;
- upcasting when relevant;
- common uses;
- common mistakes;
- synergy with the current build;
- redundancy with already-selected spells;
- edition-specific behavior.

## Every value should be inspectable

Important character-sheet values should be clickable/tappable.

Examples:

### Armor Class
Show:
- base armor calculation;
- Dexterity contribution;
- shield;
- magic bonus;
- class/species/features;
- temporary modifiers;
- why the current total is what it is.

### Attack bonus
Show the equation.

Example:
```
Longsword +8
+4 Strength
+4 proficiency
= +8
```

Then explain why proficiency applies.

### Spell save DC

Example:
```
DC 16
8 base
+4 proficiency
+4 spellcasting ability
```

Then explain what an enemy actually rolls against it.

### Hit Points

Explain:
- Hit Die;
- level-one HP;
- later-level HP;
- Constitution contribution;
- temporary HP is separate;
- healing does not normally exceed max HP;
- 0 HP/death-save relationship.

## Dependency graph

CharacterForge should maintain a dependency graph between character decisions and derived values.

Examples:

**Strength**
→ melee attacks  
→ melee damage  
→ Athletics  
→ Strength saves  
→ carrying  
→ prerequisites

**Dexterity**
→ AC in applicable armor  
→ initiative  
→ ranged/finesse attacks  
→ Dexterity saves  
→ Acrobatics  
→ Sleight of Hand  
→ Stealth

**Constitution**
→ HP  
→ Constitution saves  
→ concentration saves

**Proficiency bonus**
→ proficient attacks  
→ proficient saves  
→ proficient skills  
→ spell attacks  
→ spell save DC

When a value changes, the UI should be able to say:

> Changing Dexterity 14 → 16 changed:
> - initiative +2 → +3
> - Dexterity save +2 → +3
> - Stealth +4 → +5
> - AC 15 → 16

This is central to the teaching experience.

## Optimization goal selector

Before or during creation, users may choose an optimization goal:

- Balanced
- Maximum damage
- Maximum durability
- Control
- Support
- Healing
- Exploration
- Social
- Beginner simplicity
- Custom

Recommendations must be based on the selected goal.

Do not present a single universal "best build."

## Recommendation labels

Recommended choices should be marked with an explanation, not just a badge.

Example:

**Recommended: Constitution 16**

> This character is expected to fight in melee and maintain concentration. Constitution improves both HP and Constitution saving throws, so it supports survivability and spell reliability.

Alternative:

**Constitution 14**
> Frees points for Wisdom, improving perception and Wisdom saves, but costs 1 HP per level and lowers Constitution checks/saves by 1.

## Build impact preview

Before committing an option, show its impact.

Example:

**Take +2 Charisma**

Current:
- CHA 16
- Spell attack +6
- Spell DC 14

After:
- CHA 18
- Spell attack +7
- Spell DC 15

Also list affected skills/features.

## Explain interactions

The builder should actively surface important relationships.

Examples:

> **You selected Great Weapon Master.**
> This works best when you regularly attack with qualifying heavy weapons.

> **You selected a shield.**
> Your current two-handed weapon cannot be used while wielding the shield.

> **You selected two concentration spells.**
> You may know/prepare both, but normally you can concentrate on only one at a time.

> **You selected heavy armor.**
> Dexterity no longer improves this armor's AC, so increasing Dexterity may now have less defensive value.

These explanations should be informative, not blocking, unless the combination is actually illegal.

## Illegal choices vs suboptimal choices

The UI must distinguish:

### Illegal
> You cannot select this because the prerequisite is not met.

### Legal but inefficient
> This is allowed, but it does not strongly support your selected build goal.

### Redundant
> This overlaps with something you already have.

### Synergistic
> This becomes stronger because of another selected feature.

Do not forbid legal suboptimal characters.

## Teaching depth

Every help panel should support three layers:

### Quick answer
One or two sentences.

### Learn more
Rules explanation + example.

### Deep dive
Optimization, edge cases, interactions, edition comparison, and tactical implications.

This is the core product voice:
**simple first, depth on demand.**

## Character sheet modes

The finished sheet should support:

- **Play Mode** — clean table sheet.
- **Learn Mode** — explanations visible on hover/tap.
- **Build Mode** — dropdowns/selectors and live impact preview.
- **Expert Mode** — compact controls, search, filters, and math with explanations collapsed.

All modes operate on the same character data.

## Level-up mode

At level-up, visually highlight only what changed.

Show:
- new HP;
- proficiency changes;
- class features;
- subclass features;
- spell slots;
- spell selection changes;
- feats/ASI;
- weapon mastery or equivalent;
- new resource trackers.

Then explain:

> **Your turn changed this level because…**

and

> **Try this in your next session…**

## Ember & Stone integration

Every concept should be linkable to the unified learning ecosystem.

Examples:

**Strength**
- Learn: Strength ability lesson
- Watch: Ember & Stone Strength video
- Practice: Iron Pit shove/grapple scenario
- Play: Hearthford scene that uses Strength

**Concentration**
- Learn: concentration lesson
- Watch: concentration video
- Practice: Iron Pit concentration lab
- Play: pregen/adventure using concentration pressure

## Accessibility

Teaching must not depend on hover alone.

Every explanation must also work with:
- keyboard focus;
- touch;
- screen readers;
- mobile layouts.

Plain-language explanations come before jargon.

## Success test

A new player should be able to:

1. create a legal character;
2. understand what every number on the sheet means;
3. understand why their selected options were recommended;
4. know what to do on their first combat turn;
5. understand what changes when they level up.

An expert should be able to:

1. build quickly;
2. inspect exact math;
3. compare alternatives;
4. see optimization tradeoffs;
5. bypass beginner explanations without losing functionality.

If the same character sheet cannot serve both users, the design is incomplete.
