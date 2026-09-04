from __future__ import annotations

import os
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class ConfigSecretTests(unittest.TestCase):
    def run_import(self, secret: str | None) -> subprocess.CompletedProcess[str]:
        env = os.environ.copy()
        env.pop("SECRET_KEY", None)
        if secret is not None:
            env["SECRET_KEY"] = secret
        return subprocess.run(
            [sys.executable, "-c", "import config; print(len(config.Config.SECRET_KEY))"],
            cwd=ROOT,
            env=env,
            capture_output=True,
            text=True,
            check=False,
        )

    def test_missing_secret_fails_closed(self) -> None:
        result = self.run_import(None)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("SECRET_KEY is required", result.stderr)

    def test_legacy_default_is_rejected(self) -> None:
        result = self.run_import("dev-secret-change-me-in-production")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("must not use an example default", result.stderr)

    def test_short_secret_is_rejected(self) -> None:
        result = self.run_import("too-short")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("at least 32 characters", result.stderr)

    def test_strong_secret_is_accepted(self) -> None:
        result = self.run_import("characterforge-local-test-secret-0123456789")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertGreaterEqual(int(result.stdout.strip()), 32)


if __name__ == "__main__":
    unittest.main()
