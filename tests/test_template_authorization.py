from __future__ import annotations

import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = (ROOT / "routes" / "templates.py").read_text(encoding="utf-8")


class TemplateAuthorizationTests(unittest.TestCase):
    def test_dm_npc_permission_is_owner_or_campaign_scoped(self) -> None:
        self.assertIn("def _can_save_as_template", SOURCE)
        self.assertIn("if char.owner_id == uid:", SOURCE)
        self.assertIn('if role == "dm" and char.campaign_id:', SOURCE)
        self.assertIn("campaign.dm_id == uid", SOURCE)
        self.assertNotIn("DMs can save any NPC", SOURCE)
        self.assertNotIn('elif role == "dm" and char.is_npc:', SOURCE)


if __name__ == "__main__":
    unittest.main()
