from app.rag.chroma_client import get_client
from app.rag.embeddings import HashEmbeddingFunction

_ef = HashEmbeddingFunction()


def retrieve(collection: str, query: str, filters: dict | None = None, k: int = 5, min_similarity: float = 0.35) -> list[dict]:
    client = get_client()
    coll = client.get_or_create_collection(collection, embedding_function=_ef, metadata={"hnsw:space": "cosine"})

    results = coll.query(query_texts=[query], n_results=k, where=filters)

    documents = results["documents"][0] if results["documents"] else []
    metadatas = results["metadatas"][0] if results["metadatas"] else []
    distances = results["distances"][0] if results["distances"] else []

    hits = []
    for doc, meta, dist in zip(documents, metadatas, distances):
        similarity = 1 - dist
        if similarity >= min_similarity:
            hits.append({"document": doc, "metadata": meta, "similarity": similarity})
    return hits
