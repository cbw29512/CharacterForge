from __future__ import annotations

import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = (ROOT / "templates" / "base.html").read_text(encoding="utf-8")
SHEET = (ROOT / "templates" / "characters" / "sheet.html").read_text(encoding="utf-8")
PRINT = (ROOT / "static" / "css" / "print.css").read_text(encoding="utf-8")


class PrintableCharacterSheetTests(unittest.TestCase):
    def test_base_loads_print_stylesheet_only_for_print(self) -> None:
        self.assertIn('href="/static/css/print.css" media="print"', BASE)

    def test_sheet_keeps_core_print_fields(self) -> None:
        required = (
            "{{ char.name }}",
            "{{ data.race }}",
            "{{ data.char_class }}",
            "Level {{ data.level }}",
            "Armor Class",
            "Initiative",
            "Hit Points",
            "Skills",
            "Features & Traits",
            "Equipment",
        )
        for marker in required:
            with self.subTest(marker=marker):
                self.assertIn(marker, SHEET)

    def test_print_css_declares_letter_page_and_hides_ui_chrome(self) -> None:
        self.assertIn("size: letter portrait", PRINT)
        self.assertIn(".topnav", PRINT)
        self.assertIn(".modal-overlay", PRINT)
        self.assertIn(".confirm-action", PRINT)
        self.assertIn("display: none !important", PRINT)

    def test_print_css_preserves_core_sheet_columns(self) -> None:
        self.assertIn('div[style*="grid-template-columns:180px"]', PRINT)
        self.assertIn("grid-template-columns: 1.25in 1fr 1fr !important", PRINT)

    def test_print_css_avoids_splitting_primary_blocks(self) -> None:
        self.assertIn("break-inside: avoid", PRINT)
        self.assertIn("page-break-inside: avoid", PRINT)


if __name__ == "__main__":
    unittest.main()
