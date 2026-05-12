"""ZIP unpacking — recursive extraction of supported types."""
from __future__ import annotations

import io
import zipfile
from typing import Iterator


def iter_zip(buf: bytes) -> Iterator[tuple[str, bytes]]:
    with zipfile.ZipFile(io.BytesIO(buf)) as z:
        for info in z.infolist():
            if info.is_dir():
                continue
            with z.open(info) as f:
                yield info.filename, f.read()
