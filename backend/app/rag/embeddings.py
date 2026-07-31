import hashlib
import math
import re

from chromadb import Documents, EmbeddingFunction

VECTOR_DIM = 256
_TOKEN_RE = re.compile(r"[a-z0-9]+")


class HashEmbeddingFunction(EmbeddingFunction[Documents]):
    """Deterministic, fully offline bag-of-words hash embedding.

    Placeholder for a real API-based embedding function. Swap this out
    once an embeddings API is configured - no local model download,
    no network calls.
    """

    def __init__(self) -> None:
        pass

    def name(self) -> str:
        return "hash-embedding-v1"

    def get_config(self) -> dict:
        return {}

    @staticmethod
    def build_from_config(config: dict) -> "HashEmbeddingFunction":
        return HashEmbeddingFunction()

    def __call__(self, input: list[str]) -> list[list[float]]:
        return [self._embed(text) for text in input]

    def _embed(self, text: str) -> list[float]:
        vec = [0.0] * VECTOR_DIM
        for token in _TOKEN_RE.findall(text.lower()):
            digest = int(hashlib.sha256(token.encode()).hexdigest(), 16)
            idx = digest % VECTOR_DIM
            sign = 1.0 if (digest // VECTOR_DIM) % 2 == 0 else -1.0
            vec[idx] += sign
        norm = math.sqrt(sum(v * v for v in vec)) or 1.0
        return [v / norm for v in vec]
