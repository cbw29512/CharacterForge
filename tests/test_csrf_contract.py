from __future__ import annotations

import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REQUIREMENTS = (ROOT / "requirements.txt").read_text(encoding="utf-8")
APP = (ROOT / "app.py").read_text(encoding="utf-8")
BASE = (ROOT / "templates" / "base.html").read_text(encoding="utf-8")
LOGIN = (ROOT / "templates" / "auth" / "login.html").read_text(encoding="utf-8")
SETUP = (ROOT / "templates" / "auth" / "setup.html").read_text(encoding="utf-8")
APP_JS = (ROOT / "static" / "js" / "app.js").read_text(encoding="utf-8")


class CsrfContractTests(unittest.TestCase):
    def test_flask_wtf_is_pinned_and_initialized(self) -> None:
        self.assertIn("flask-wtf==1.2.2", REQUIREMENTS)
        self.assertIn("from flask_wtf.csrf import CSRFProtect", APP)
        self.assertIn("csrf = CSRFProtect()", APP)
        self.assertIn("csrf.init_app(app)", APP)

    def test_pages_expose_csrf_metadata(self) -> None:
        for source in (BASE, LOGIN, SETUP):
            self.assertIn('meta name="csrf-token" content="{{ csrf_token() }}"', source)

    def test_entry_forms_have_server_rendered_csrf_tokens(self) -> None:
        marker = 'name="csrf_token" value="{{ csrf_token() }}"'
        self.assertIn(marker, LOGIN)
        self.assertIn(marker, SETUP)

    def test_shared_js_protects_dynamic_forms_and_json_posts(self) -> None:
        self.assertIn("form.querySelector('input[name=\"csrf_token\"]')", APP_JS)
        self.assertIn("input.name = 'csrf_token'", APP_JS)
        self.assertIn("headers.set('X-CSRFToken', csrfToken)", APP_JS)
        self.assertIn("url.origin === window.location.origin", APP_JS)


if __name__ == "__main__":
    unittest.main()
