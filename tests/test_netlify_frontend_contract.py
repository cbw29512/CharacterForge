from __future__ import annotations

import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "site"


class NetlifyFrontendContractTests(unittest.TestCase):
    def test_publish_surface_and_security_headers_are_explicit(self):
        config = (ROOT / "netlify.toml").read_text(encoding="utf-8")
        self.assertIn('publish = "site"', config)
        self.assertIn('functions = "netlify/functions"', config)
        self.assertIn("default-src 'self'", config)
        self.assertIn("object-src 'none'", config)
        self.assertIn("frame-ancestors 'none'", config)
        self.assertIn('Permissions-Policy', config)

    def test_static_pages_use_only_local_runtime_assets(self):
        for name in ("index.html", "login.html", "setup.html", "app.html"):
            html = (SITE / name).read_text(encoding="utf-8")
            self.assertNotIn("https://fonts.", html, name)
            self.assertNotIn("cdn.", html.lower(), name)
            self.assertNotIn("<script>", html, name)
            self.assertIn('/assets/app.css', html, name)

    def test_auth_client_never_uses_web_storage_for_credentials(self):
        js = "\n".join(path.read_text(encoding="utf-8") for path in (SITE / "assets").glob("*.js"))
        self.assertNotIn("localStorage", js)
        self.assertNotIn("sessionStorage", js)
        self.assertIn("__Host-cf_csrf", js)
        self.assertIn("credentials:'same-origin'", js)

    def test_expected_auth_and_campaign_api_routes_are_wired(self):
        login = (SITE / "assets" / "login.js").read_text(encoding="utf-8")
        setup = (SITE / "assets" / "setup.js").read_text(encoding="utf-8")
        app = (SITE / "assets" / "app.js").read_text(encoding="utf-8")
        self.assertIn("/api/auth/login", login)
        self.assertIn("/api/auth/setup", setup)
        self.assertIn("/api/auth/me", app)
        self.assertIn("/api/auth/logout", app)
        self.assertIn("/api/campaigns", app)

    def test_support_link_is_visible_on_public_and_authenticated_shells(self):
        for name in ("index.html", "app.html"):
            html = (SITE / name).read_text(encoding="utf-8")
            self.assertIn("https://buymeacoffee.com/divclass016", html, name)


if __name__ == "__main__":
    unittest.main()
