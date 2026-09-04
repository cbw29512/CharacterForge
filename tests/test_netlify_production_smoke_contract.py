from __future__ import annotations

import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class NetlifyProductionSmokeContractTests(unittest.TestCase):
    def test_manual_workflow_is_explicit_and_verification_only(self):
        workflow = (ROOT / ".github/workflows/netlify-production-smoke.yml").read_text(encoding="utf-8")
        self.assertIn("workflow_dispatch:", workflow)
        self.assertIn("site_url:", workflow)
        self.assertIn("expected_sha:", workflow)
        self.assertIn("npm run smoke:netlify", workflow)
        lowered = workflow.lower()
        for forbidden in (
            "netlify deploy",
            "deploy --prod",
            "netlify_auth_token",
            "netlify_site_id",
            "schedule:",
            "pull_request:",
            "push:",
        ):
            self.assertNotIn(forbidden, lowered)

    def test_documentation_requires_https_and_full_sha(self):
        docs = (ROOT / "docs/NETLIFY_PRODUCTION_SMOKE.md").read_text(encoding="utf-8")
        self.assertIn("exact deployed HTTPS origin", docs)
        self.assertIn("exact full 40-character Git commit", docs)
        self.assertIn("does **not** automatically deploy", docs)


if __name__ == "__main__":
    unittest.main()
