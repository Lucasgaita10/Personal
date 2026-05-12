"""Embeddings layer — Voyage primary, deterministic local fallback."""
from __future__ import annotations

import hashlib
from typing import Sequence

import httpx
import numpy as np

from app.config import get_settings


class EmbeddingProvider:
    async def embed(self, texts: Sequence[str]) -> list[list[float]]:
        raise NotImplementedError


class VoyageProvider(EmbeddingProvider):
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


class LocalProvider(EmbeddingProvider):
    """Hash-based deterministic embedding for offline mode.

    Not semantic; usable as a placeholder until a local model
    (e.g. all-MiniLM-L6-v2 via sentence-transformers) is wired.
    """

    def __init__(self, dim: int = 1024) -> None:
        self.dim = dim

    async def embed(self, texts: Sequence[str]) -> list[list[float]]:
        out: list[list[float]] = []
        for t in texts:
            h = hashlib.sha512(t.encode("utf-8")).digest()
            # repeat hash bytes to reach `dim`, normalise to unit vector
            buf = (h * ((self.dim // len(h)) + 1))[: self.dim * 2]
            arr = np.frombuffer(buf, dtype=np.uint8).astype(np.float32)[: self.dim]
            arr = (arr / 255.0) - 0.5
            n = np.linalg.norm(arr) + 1e-9
            out.append((arr / n).tolist())
        return out


def get_provider() -> EmbeddingProvider:
    s = get_settings()
    if s.embedding_provider == "voyage" and s.voyage_api_key:
        return VoyageProvider()
    return LocalProvider(s.embedding_dim)
