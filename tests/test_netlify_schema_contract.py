from __future__ import annotations

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIGRATION = ROOT / "netlify" / "database" / "migrations" / "0001_characterforge_core.sql"


class NetlifySchemaContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.sql = MIGRATION.read_text(encoding="utf-8")
        cls.normalized = re.sub(r"\s+", " ", cls.sql.lower())

    def test_core_tables_exist(self) -> None:
        for table in (
            "users",
            "campaigns",
            "campaign_memberships",
            "character_templates",
            "characters",
        ):
            self.assertIn(f"create table {table}", self.normalized)

    def test_user_roles_are_database_constrained(self) -> None:
        self.assertIn("check (role in ('admin', 'dm', 'player'))", self.normalized)

    def test_usernames_are_case_insensitively_unique(self) -> None:
        self.assertIn("unique index users_username_ci_unique on users (lower(username))", self.normalized)

    def test_campaign_membership_is_unique(self) -> None:
        self.assertIn("unique (campaign_id, user_id)", self.normalized)

    def test_campaign_owner_cannot_be_silently_deleted(self) -> None:
        self.assertIn("dm_id bigint not null references users(id) on delete restrict", self.normalized)

    def test_character_owner_and_campaign_delete_semantics_are_explicit(self) -> None:
        self.assertIn("owner_id bigint references users(id) on delete set null", self.normalized)
        self.assertIn("campaign_id bigint references campaigns(id) on delete cascade", self.normalized)

    def test_structured_character_data_uses_jsonb_with_shape_checks(self) -> None:
        expected = {
            "skills": "object",
            "saving_throws": "object",
            "equipment": "array",
            "spells": "object",
            "features": "array",
            "traits": "object",
            "attacks": "array",
        }
        for column, shape in expected.items():
            self.assertRegex(
                self.normalized,
                rf"{column} jsonb .*?jsonb_typeof\({column}\) = '{shape}'",
            )

    def test_schema_does_not_seed_accounts_or_credentials(self) -> None:
        self.assertNotIn("insert into users", self.normalized)
        self.assertNotIn("1974", self.normalized)
        self.assertNotIn("password-123", self.normalized)


if __name__ == "__main__":
    unittest.main()
