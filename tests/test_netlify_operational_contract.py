from __future__ import annotations

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORKFLOWS = ROOT / ".github" / "workflows"
OPERATIONS = ROOT / "docs" / "NETLIFY_OPERATIONS.md"


class NetlifyOperationalContractTests(unittest.TestCase):
    def test_production_database_url_is_not_committed_into_deploy_configuration(self):
        config = (ROOT / "netlify.toml").read_text(encoding="utf-8")
        self.assertNotIn("NETLIFY_DB_URL", config)
        self.assertNotIn("DATABASE_URL", config)

        workflow_text = "\n".join(
            path.read_text(encoding="utf-8")
            for path in sorted(WORKFLOWS.glob("*.yml"))
        )
        self.assertNotRegex(workflow_text, r"(?m)^\s*NETLIFY_DB_URL\s*:")

        database_lines = [
            line.strip()
            for line in workflow_text.splitlines()
            if re.match(r"^DATABASE_URL\s*:", line.strip())
        ]
        self.assertTrue(database_lines, "expected the isolated Flask CI DATABASE_URL fixture")
        self.assertEqual(
            database_lines,
            ["DATABASE_URL: sqlite:////tmp/characterforge-ci.sqlite3"],
        )

    def test_database_connection_fails_closed_without_platform_url(self):
        pg = (ROOT / "netlify" / "lib" / "pg.mts").read_text(encoding="utf-8")
        self.assertIn("process.env.NETLIFY_DB_URL", pg)
        self.assertIn("NETLIFY_DB_URL is required", pg)
        self.assertNotRegex(pg, r"postgres(?:ql)?://")

    def test_restore_cannot_be_triggered_by_ci_or_application_code(self):
        candidate_paths = list(WORKFLOWS.glob("*.yml"))
        candidate_paths += list((ROOT / "netlify").rglob("*.mts"))
        candidate_paths += list((ROOT / "scripts").glob("*.mjs"))
        text = "\n".join(path.read_text(encoding="utf-8") for path in candidate_paths)
        forbidden = (
            r"netlify\s+(?:database|db)\s+restore",
            r"netlify\s+restore",
            r"restore[-_ ]?backup",
        )
        for pattern in forbidden:
            self.assertIsNone(re.search(pattern, text, flags=re.IGNORECASE), pattern)

    def test_runbook_preserves_preview_isolation_and_manual_restore_invariants(self):
        text = OPERATIONS.read_text(encoding="utf-8")
        required = (
            "Production deploys are the only deploy context allowed to access the main production database.",
            "Deploy Previews use their own Netlify-managed database branch.",
            "must not manually inject, copy, or hard-code a production `NETLIFY_DB_URL`",
            "Do not automate database restore",
            "Data written after that backup can be lost.",
            "Restoring the database does not automatically roll application code back",
            "A restore requires a Team Owner",
            "Run the CharacterForge production smoke with the exact live 40-character commit SHA.",
            "Rolling an application deploy back does not automatically restore the database.",
        )
        for phrase in required:
            self.assertIn(phrase, text)

    def test_runbook_requires_pre_cutover_backup_and_preview_proof(self):
        text = OPERATIONS.read_text(encoding="utf-8")
        self.assertIn("Confirm the Deploy Preview is using a database branch rather than the production database.", text)
        self.assertIn("Confirm the record does not exist in production.", text)
        self.assertIn("Confirm the Database dashboard shows a recent production backup.", text)
        self.assertIn("production publishes are deliberate release events", text.lower())


if __name__ == "__main__":
    unittest.main()
