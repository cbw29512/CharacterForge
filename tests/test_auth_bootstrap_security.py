from __future__ import annotations

import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AUTH_SOURCE = (ROOT / "routes" / "auth.py").read_text(encoding="utf-8")


class AuthBootstrapSecurityTests(unittest.TestCase):
    def test_known_default_accounts_are_not_seeded(self) -> None:
        self.assertNotIn("DEFAULT_ACCOUNTS", AUTH_SOURCE)
        self.assertNotIn("ensure_default_accounts", AUTH_SOURCE)
        self.assertNotIn('"1974"', AUTH_SOURCE)
        self.assertNotIn("'1974'", AUTH_SOURCE)

    def test_first_launch_requires_setup(self) -> None:
        self.assertIn('redirect(url_for("auth.setup_get"))', AUTH_SOURCE)

    def test_admin_setup_requires_modern_minimum_length(self) -> None:
        self.assertIn("if len(password) < 12:", AUTH_SOURCE)


if __name__ == "__main__":
    unittest.main()
