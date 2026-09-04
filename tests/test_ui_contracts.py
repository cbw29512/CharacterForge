from __future__ import annotations

import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LOGIN = (ROOT / "templates" / "auth" / "login.html").read_text(encoding="utf-8")
SETUP = (ROOT / "templates" / "auth" / "setup.html").read_text(encoding="utf-8")
APP_JS = (ROOT / "static" / "js" / "app.js").read_text(encoding="utf-8")
CHARACTERS = (ROOT / "routes" / "characters.py").read_text(encoding="utf-8")


class UiContractTests(unittest.TestCase):
    def test_login_inputs_have_associated_labels(self) -> None:
        self.assertIn('for="login-username"', LOGIN)
        self.assertIn('id="login-username"', LOGIN)
        self.assertIn('for="login-password"', LOGIN)
        self.assertIn('id="login-password"', LOGIN)

    def test_role_selector_uses_real_buttons_and_pressed_state(self) -> None:
        self.assertIn('type="button" class="role-btn"', LOGIN)
        self.assertIn('aria-pressed="false"', LOGIN)
        self.assertIn("setAttribute('aria-pressed', 'true')", APP_JS)

    def test_setup_matches_backend_password_policy(self) -> None:
        self.assertIn('minlength="12"', SETUP)
        self.assertIn('placeholder="At least 12 characters"', SETUP)

    def test_wizard_ai_frontend_matches_flask_route(self) -> None:
        self.assertIn("fetch('/characters/ai_step'", APP_JS)
        self.assertIn("build: charData", APP_JS)
        self.assertIn('@characters_bp.post("/ai_step")', CHARACTERS)
        self.assertNotIn("/characters/ai_suggest", APP_JS)

    def test_quick_npc_frontend_matches_flask_route(self) -> None:
        self.assertIn("window.generateNPC", APP_JS)
        self.assertIn("fetch('/characters/ai_npc'", APP_JS)
        self.assertIn('@characters_bp.post("/ai_npc")', CHARACTERS)
        self.assertIn("headers: {'Content-Type': 'application/json'}", APP_JS)


if __name__ == "__main__":
    unittest.main()
