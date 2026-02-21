from __future__ import annotations
from pathlib import Path

def extract_text_from_pdf(pdf_path: str) -> str:
    p = Path(pdf_path)
    if not p.exists():
        return ""

    try:
        from pypdf import PdfReader  # type: ignore
        reader = PdfReader(str(p))
        parts = []
        for page in reader.pages:
            parts.append(page.extract_text() or "")
        return "\n\n".join(parts).strip()
    except Exception:
        return ""