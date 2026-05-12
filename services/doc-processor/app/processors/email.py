"""Email (.eml/.msg) processor."""
from __future__ import annotations

import io

import mailparser


def extract_email(buf: bytes) -> str:
    msg = mailparser.parse_from_bytes(buf)
    parts: list[str] = []
    parts.append(f"From: {msg.from_}")
    parts.append(f"To: {msg.to}")
    parts.append(f"Date: {msg.date}")
    parts.append(f"Subject: {msg.subject}")
    parts.append("")
    if msg.body:
        parts.append(msg.body)
    if msg.attachments:
        parts.append("")
        parts.append("Attachments:")
        for a in msg.attachments:
            parts.append(f"- {a.get('filename', '?')} ({a.get('mail_content_type', '?')})")
    return "\n".join(parts)
