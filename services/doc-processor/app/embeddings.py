"""Embeddings — same provider strategy as the AI service."""
from __future__ import annotations

import hashlib
from typing import Sequence

import httpx
import numpy as np

from app.config import get_settings


class VoyageProvider:
    def __init__(self) -> None:
        self.s = get_settings()
        self._client = httpx.AsyncClient(timeout=60)

    async def embed(self, texts: Sequence[str]) -> list[list[float]]:
        if not self.s.voyage_api_key:
            raise RuntimeError("VOYAGE_API_KEY missing")
        r = await self._client.post(
            "https://api.voyageai.com/v1/embeddings",
            headers={"Authorization": f"Bearer {self.s.voyage_api_key}"},
            json={"input": list(texts), "model": self.s.embedding_model, "input_type": "document"},
        )
        r.raise_for_status()
        return [item["embedding"] for item in r.json()["data"]]


class LocalProvider:
    def __init__(self, dim: int = 1024) -> None:
        self.dim = dim

    async def embed(self, texts: Sequence[str]) -> list[list[float]]:
        out = []
        for t in texts:
            h = hashlib.sha512(t.encode("utf-8")).digest()
            buf = (h * ((self.dim // len(h)) + 1))[: self.dim * 2]
            arr = np.frombuffer(buf, dtype=np.uint8).astype(np.float32)[: self.dim]
            arr = (arr / 255.0) - 0.5
            n = np.linalg.norm(arr) + 1e-9
            out.append((arr / n).tolist())
        return out


def get_provider():
    s = get_settings()
    if s.embedding_provider == "voyage" and s.voyage_api_key:
        return VoyageProvider()
    return LocalProvider(s.embedding_dim)
