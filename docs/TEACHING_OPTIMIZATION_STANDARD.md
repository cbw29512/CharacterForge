# Teaching-First Character Optimization

CharacterForge must make an optimized character understandable, not merely legal or numerically strong.

## Core rule

Every optimized choice must explain:

1. **What was chosen.**
2. **Why it is strong for this character's intended job.**
3. **Which rule or character mechanic makes it work.**
4. **What tradeoff the choice creates.**
5. **What reasonable alternatives exist and why they were not selected by default.**
6. **How the player should actually use the choice at the table.**
7. **Whether the explanation differs between 2014 and 2024 rules.**

An optimized build with no explanation is incomplete.

## One engine, three presentation depths

Do not maintain separate beginner and expert character builders. Use the same legal character model and expose different explanation depth.

### Guided
For new players.

Show:
- one decision at a time;
- plain-language explanation before rules jargon;
- the character's intended role;
- why each ability score matters;
- what proficiency means;
- what AC, HP, initiative, attacks, saves, skills, spell slots, concentration, and resources do as they appear;
- a recommended choice with a short reason;
- a small set of sensible alternatives;
- a table-use example after important decisions.

### Explained
For players who know the basics but want optimization rationale.

Show:
- recommendation;
- mechanical reason;
- important numerical effect;
- synergy with earlier choices;
- opportunity cost;
- alternatives;
- expected play pattern.

### Expert
For experienced players.

Show:
- legal options;
- final numbers;
- concise optimization tags;
- deltas versus alternatives;
- filters/sorting;
- optional expandable rationale.

Expert mode hides explanation by default; it never removes the underlying rationale data.

## Required explanation objects

Every build choice should support structured explanation data rather than hard-coded prose only.

Suggested shape:

```json
{
  "choiceId": "example-choice",
  "decision": "Select Fighting Style",
  "selected": "Defense",
  "goal": "durable front-line protector",
  "why": "Raises AC while wearing armor and works every round without consuming an action or resource.",
  "rulesReason": "The selected fighting style modifies Armor Class while its equipment requirement is met.",
  "numericImpact": {
    "before": "AC 18",
    "after": "AC 19"
  },
  "synergies": [
    "heavy armor",
    "shield use",
    "front-line positioning"
  ],
  "tradeoffs": [
    "does not increase weapon damage"
  ],
  "alternatives": [
    {
      "name": "Dueling",
      "reasonToChoose": "Better if the player's priority is one-handed weapon damage rather than maximum durability."
    }
  ],
  "tableUse": "You do not activate this. If you are wearing qualifying armor, the AC bonus is already included on the sheet.",
  "edition": "2024"
}
```

The exact storage schema may change, but the information must remain available as data.

## Ability scores

Never present an optimized array without teaching it.

For each assigned score, explain:
- which attacks/spells/features use it;
- which saving throw it controls;
- important skills;
- armor or multiclass prerequisites when relevant;
- why this build values it above or below another ability;
- whether increasing it changes hit chance, save DC, damage, AC, initiative, concentration, HP, or another derived value.

Show the actual derived change when possible.

Example:

> CHA 16 → 18  
> Spell attack increases +5 → +6.  
> Spell save DC increases 13 → 14.  
> Relevant Charisma checks also increase by 1.

## Features, feats, spells, and equipment

For every recommended option, provide:
- purpose;
- action economy;
- resource cost;
- trigger/timing;
- target/use restrictions;
- synergy;
- common beginner mistake;
- simple table example.

Equipment recommendations must explain effects on:
- AC;
- attack bonus;
- damage;
- range/reach;
- hands required;
- speed or stealth where applicable.

Never label something "best" without stating the optimization goal.

"Best damage" may differ from:
- best survivability;
- best control;
- best support;
- best exploration;
- easiest beginner play;
- best all-around build.

## Level-up teaching

A level-up screen must answer:

- What changed this level?
- What new choice do I need to make?
- Why is the recommended choice strong?
- Did any old action become obsolete or less important?
- Did my normal turn change?
- What resource should I now track?
- What should I try in the next session?

For branch points such as subclasses, feats, spell selections, and ability-score improvements, show alternatives and resulting playstyle changes.

## Teach the turn

Every completed character should have a **How to Play This Character** section.

At minimum:

- **Before combat**
- **Round 1**
- **Normal turn**
- **When an ally is in trouble**
- **When you are in trouble**
- **When enemies are grouped**
- **When an enemy is hard to hit**
- **Resource conservation**
- **Common mistakes**
- **What changes at the next major level**

Do not imply a rigid rotation when the class is situational. Explain decision priorities instead.

## Numbers must explain themselves

Important derived values should be inspectable.

Examples:

### Attack bonus
```
+8 to hit
+4 ability
+4 proficiency
```

### Spell save DC
```
16
8 base
+4 proficiency
+4 spellcasting ability
```

### Armor Class
Show armor, Dexterity contribution, shield, and applicable features.

### Hit points
Show level-one basis plus later Hit Die averages/roll policy and Constitution contribution.

The displayed character sheet remains clean; explanations appear on demand.

## Optimization integrity

Optimization must always specify its goal and constraints.

Never:
- mix 2014 and 2024 rules;
- use an illegal prerequisite;
- count mutually exclusive choices simultaneously;
- assume a magic item unless the build explicitly includes it;
- hide an important downside;
- claim mathematically superior performance without comparable assumptions;
- optimize only DPR when the requested build has another job.

## Ember & Stone integration

Each major build concept should be linkable to a matching Ember & Stone lesson.

Examples:
- ability scores;
- proficiency;
- AC;
- attack bonus;
- saving throws;
- spell save DC;
- concentration;
- action economy;
- feats;
- multiclassing;
- equipment;
- class/subclass tactics.

The character builder should eventually support:

- **Learn this concept** → written Ember & Stone lesson;
- **Watch** → matching video;
- **Test it** → Iron Pit example when applicable;
- **See it in play** → Hearthford adventure/pregen using the concept.

## Success criterion

A first-time player should be able to use an optimized character without being handed unexplained numbers.

A veteran should be able to build the same character quickly without being forced through tutorial screens.

Both users must receive the same legal, audited character underneath.
