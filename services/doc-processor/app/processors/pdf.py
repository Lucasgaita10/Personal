"""PDF processor — text extraction, table extraction, OCR fallback for image PDFs."""
from __future__ import annotations

import io
from dataclasses import dataclass
from typing import Iterable

import fitz  # PyMuPDF
import pdfplumber
from PIL import Image
import pytesseract


@dataclass
class PageContent:
    page: int
    text: str
    tables: list[list[list[str]]]
    ocr_used: bool


def extract_pdf(buf: bytes) -> tuple[list[PageContent], int]:
    pages: list[PageContent] = []

    # Pass 1: PyMuPDF for text + lightweight detection of image-only pages
    doc = fitz.open(stream=buf, filetype="pdf")
    page_count = doc.page_count
    image_only_pages: set[int] = set()
    raw_texts: dict[int, str] = {}
    for i, page in enumerate(doc):
        t = page.get_text("text") or ""
        raw_texts[i] = t
        if len(t.strip()) < 40 and page.get_images():
            image_only_pages.add(i)
    doc.close()

    # Pass 2: pdfplumber for tables
    page_tables: dict[int, list[list[list[str]]]] = {}
    try:
        with pdfplumber.open(io.BytesIO(buf)) as pdf:
            for i, page in enumerate(pdf.pages):
                tables = page.extract_tables() or []
                if tables:
                    page_tables[i] = tables
    except Exception:
        pass

    # Pass 3: OCR fallback for image-only pages
    ocr_texts: dict[int, str] = {}
    if image_only_pages:
        doc = fitz.open(stream=buf, filetype="pdf")
        for i in image_only_pages:
            page = doc[i]
            pix = page.get_pixmap(dpi=180)
            img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
            try:
                ocr_texts[i] = pytesseract.image_to_string(img) or ""
            except Exception:
                ocr_texts[i] = ""
        doc.close()

    for i in range(page_count):
        text = raw_texts.get(i, "")
        used_ocr = False
        if i in ocr_texts and len(ocr_texts[i]) > len(text):
            text = ocr_texts[i]
            used_ocr = True
        pages.append(
            PageContent(
                page=i + 1,
                text=text,
                tables=page_tables.get(i, []),
                ocr_used=used_ocr,
            )
        )
    return pages, page_count
