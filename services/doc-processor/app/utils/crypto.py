"""Mirror of the Node API encryption format so the doc-processor can read blobs."""
from __future__ import annotations

import hashlib
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.config import get_settings


def _key() -> bytes:
    raw = get_settings().master_encryption_key or ""
    if len(raw) == 64 and all(c in "0123456789abcdefABCDEF" for c in raw):
        return bytes.fromhex(raw)
    # Match Node scrypt fallback (salt = "stone-gate-salt-v1")
    return hashlib.scrypt(raw.encode(), salt=b"stone-gate-salt-v1", n=16384, r=8, p=1, dklen=32)


def decrypt_blob(data: bytes) -> bytes:
    iv, tag, ct = data[:12], data[12:28], data[28:]
    return AESGCM(_key()).decrypt(iv, ct + tag, None)
