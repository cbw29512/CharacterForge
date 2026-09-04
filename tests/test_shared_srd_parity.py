from __future__ import annotations

import json
import unittest
from pathlib import Path

from services import srd_service

ROOT = Path(__file__).resolve().parents[1]
SHARED = json.loads((ROOT / "shared" / "srd-5.1.json").read_text(encoding="utf-8"))


def _normalize_class(value: dict) -> dict:
    normalized = dict(value)
    normalized["features_by_level"] = {
        str(level): features for level, features in value["features_by_level"].items()
    }
    return normalized


class SharedSrdParityTests(unittest.TestCase):
    def test_races_match_exactly(self) -> None:
        self.assertEqual(SHARED["races"], srd_service.SRD_RACES)

    def test_classes_match_exactly(self) -> None:
        self.assertEqual(
            SHARED["classes"],
            [_normalize_class(value) for value in srd_service.SRD_CLASSES],
        )

    def test_backgrounds_alignments_and_skills_match_exactly(self) -> None:
        self.assertEqual(SHARED["backgrounds"], srd_service.SRD_BACKGROUNDS)
        self.assertEqual(SHARED["alignments"], srd_service.SRD_ALIGNMENTS)
        self.assertEqual(SHARED["skills"], srd_service.ALL_SKILLS)

    def test_proficiency_table_matches_exactly(self) -> None:
        expected = {str(level): bonus for level, bonus in srd_service.PROFICIENCY_BY_LEVEL.items()}
        self.assertEqual(SHARED["proficiency_by_level"], expected)

    def test_math_contract_matches_edge_cases(self) -> None:
        self.assertEqual([srd_service.ability_modifier(score) for score in (1, 8, 9, 10, 11, 20, 30)], [-5, -1, -1, 0, 0, 5, 10])
        self.assertEqual([srd_service.proficiency_bonus(level) for level in (1, 4, 5, 8, 9, 12, 13, 16, 17, 20)], [2, 2, 3, 3, 4, 4, 5, 5, 6, 6])


if __name__ == "__main__":
    unittest.main()
