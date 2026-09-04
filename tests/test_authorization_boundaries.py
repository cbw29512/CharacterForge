from __future__ import annotations

import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CHARACTERS_SOURCE = (ROOT / "routes" / "characters.py").read_text(encoding="utf-8")
ADMIN_SOURCE = (ROOT / "routes" / "admin.py").read_text(encoding="utf-8")


class AuthorizationBoundaryTests(unittest.TestCase):
    def test_dm_npc_access_is_not_global(self) -> None:
        self.assertNotIn("return char.is_npc", CHARACTERS_SOURCE)
        self.assertNotIn("if char.is_npc: return True", CHARACTERS_SOURCE)
        self.assertIn("campaign.dm_id == uid", CHARACTERS_SOURCE)

    def test_npc_creator_is_recorded(self) -> None:
        self.assertIn("owner_id=uid", CHARACTERS_SOURCE)
        self.assertNotIn("owner_id=uid if not is_npc else None", CHARACTERS_SOURCE)

    def test_campaign_injection_is_guarded_for_get_and_post(self) -> None:
        guard = "if campaign_id and not _can_create_in_campaign(campaign_id, is_npc):"
        self.assertGreaterEqual(CHARACTERS_SOURCE.count(guard), 2)
        self.assertIn("approved=True", CHARACTERS_SOURCE)

    def test_character_sheet_checks_view_permission(self) -> None:
        self.assertIn("if not _can_view_character(char):", CHARACTERS_SOURCE)
        self.assertIn("You don't have permission to view this character.", CHARACTERS_SOURCE)

    def test_admin_password_policy_matches_bootstrap(self) -> None:
        self.assertGreaterEqual(ADMIN_SOURCE.count("len(password) < 12"), 1)
        self.assertIn("len(pw) < 12", ADMIN_SOURCE)
        self.assertNotIn("Password must be at least 6 characters", ADMIN_SOURCE)


if __name__ == "__main__":
    unittest.main()
