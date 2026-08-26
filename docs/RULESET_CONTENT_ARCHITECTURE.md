# CharacterForge Ruleset Content Architecture

## Objective

CharacterForge must generate characters against an explicitly selected ruleset:

- **2014 / SRD 5.1**
- **2024 / SRD 5.2.1**

The application must never silently mix rules from the two editions.

## Data Schema

Every content record is versioned and typed.

```text
ContentRecord
├── id: stable slug
├── ruleset: 2014 | 2024
├── category: class | subclass | species | subrace | background | feat | spell | item | weapon | armor | gear
├── name: display name
├── source: official_srd | user_licensed | user_homebrew
├── source_book: optional display/source identifier
├── license: CC-BY-4.0 | user-supplied | proprietary
├── prerequisites: structured requirements
├── level_requirements: structured level gates
├── mechanics: structured rule data
├── tags: searchable metadata
└── enabled: boolean
```

Character state stores the ruleset used to create the character:

```text
Character
├── ruleset_id
├── class_id
├── subclass_id
├── species_id
├── background_id
├── feat_ids[]
├── spell_ids[]
├── equipment_ids[]
└── derived_stats
```

## Resolution rules

1. Select the ruleset before character creation.
2. Load only content enabled for that ruleset.
3. Validate prerequisites against that same ruleset.
4. Calculate derived statistics with that ruleset's mechanics engine.
5. Persist the ruleset/version on the character.
6. Render the sheet using the character's persisted ruleset, never the current global default.
7. Cross-edition conversion must be an explicit user action and must show every changed rule.

## Content coverage target

### 2014

Use the complete **SRD 5.1** content that is legally available under CC-BY-4.0, including its classes, subclasses, species/races, backgrounds, feats, spells, equipment, weapons, armor, gear, and magic items. The SRD is not the same thing as the entire 2014 Player's Handbook or all published 2014 supplements.

### 2024

Use the complete **SRD 5.2.1** content that is legally available under CC-BY-4.0. This is the 2024/5.5e rules foundation. It is deliberately not the complete 2024 Player's Handbook or all later supplements.

## Licensed expansion model

CharacterForge may support additional official books only when the user/site operator supplies content under a license that permits the intended use. Such records are isolated from SRD records and carry their own source/license metadata.

This prevents accidentally presenting non-SRD material as freely reusable content.

## Accuracy gate

A content pack is not marked `production` until:

- every record has a source identifier;
- every prerequisite is machine-readable;
- class/subclass level gates are represented;
- spellcasting progression is represented;
- feat prerequisites are represented;
- equipment properties are represented;
- edition-specific differences are tested;
- representative characters from every class and every available subclass can be generated;
- calculated values are compared against the official source;
- the pack passes automated schema validation.

## Important licensing boundary

"Every official D&D option ever published" is **not** equivalent to "everything CharacterForge can legally ship as built-in data." Wizards explicitly states that SRD 5.1 and SRD 5.2.1 are reusable under CC-BY-4.0, while some official classes, species, items, spells, and other content are intentionally excluded from the SRD. CharacterForge therefore uses the SRDs as the built-in baseline and a separate licensed-content mechanism for anything outside them.
