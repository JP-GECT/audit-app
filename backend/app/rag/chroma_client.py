import chromadb

from app.config import settings

_client = None


def get_client():
    global _client
    if _client is None:
        _client = chromadb.PersistentClient(path=settings.chroma_dir)
    return _client
