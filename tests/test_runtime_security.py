from __future__ import annotations

import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = (ROOT / "app.py").read_text(encoding="utf-8")
CONFIG = (ROOT / "config.py").read_text(encoding="utf-8")


class RuntimeSecurityTests(unittest.TestCase):
    def test_session_cookie_security_defaults_are_explicit(self) -> None:
        self.assertIn("SESSION_COOKIE_HTTPONLY = True", CONFIG)
        self.assertIn('SESSION_COOKIE_SAMESITE = "Lax"', CONFIG)
        self.assertIn('SESSION_COOKIE_SECURE = _env_flag("SESSION_COOKIE_SECURE"', CONFIG)

    def test_response_security_headers_are_applied(self) -> None:
        for marker in (
            '"X-Content-Type-Options", "nosniff"',
            '"X-Frame-Options", "DENY"',
            '"Referrer-Policy", "strict-origin-when-cross-origin"',
            '"Permissions-Policy", "camera=(), geolocation=(), microphone=()"',
        ):
            with self.subTest(marker=marker):
                self.assertIn(marker, APP)

    def test_debug_mode_is_opt_in(self) -> None:
        self.assertNotIn("debug=True", APP)
        self.assertIn('_env_flag("FLASK_DEBUG", default=False)', APP)


if __name__ == "__main__":
    unittest.main()
