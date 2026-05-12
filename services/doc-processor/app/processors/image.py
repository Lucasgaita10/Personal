"""Image OCR processor."""
from __future__ import annotations

import io
from PIL import Image
import pytesseract


def extract_image(buf: bytes) -> str:
    img = Image.open(io.BytesIO(buf))
    try:
        return pytesseract.image_to_string(img) or ""
    except Exception:
        return ""
