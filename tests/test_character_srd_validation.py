from __future__ import annotations

import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CHARACTERS_SOURCE = (ROOT / "routes" / "characters.py").read_text(encoding="utf-8")


class CharacterSrdValidationTests(unittest.TestCase):
    def test_create_route_rejects_unknown_catalog_choices(self) -> None:
        self.assertIn("srd_service.get_race(race_name)", CHARACTERS_SOURCE)
        self.assertIn("srd_service.get_class(class_name)", CHARACTERS_SOURCE)
        self.assertIn("srd_service.get_background(bg_name)", CHARACTERS_SOURCE)
        self.assertIn("alignment not in srd_service.SRD_ALIGNMENTS", CHARACTERS_SOURCE)
        self.assertIn('flash("Choose a supported SRD race, class, background, and alignment.", "error")', CHARACTERS_SOURCE)

    def test_invalid_class_no_longer_uses_generic_hit_die_fallback(self) -> None:
        self.assertNotIn('srd_class = srd_service.get_class(class_name) or {}', CHARACTERS_SOURCE)
        self.assertNotIn('hit_die = srd_class.get("hit_die", "d8")', CHARACTERS_SOURCE)

    def test_blank_names_and_db_bound_values_are_normalized(self) -> None:
        self.assertIn('char_name = (f.get("name") or "").strip() or "(unnamed)"', CHARACTERS_SOURCE)
        self.assertIn("armor_class = max(0, armor_class)", CHARACTERS_SOURCE)


if __name__ == "__main__":
    unittest.main()
