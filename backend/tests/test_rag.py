from app.rag.retriever import retrieve


def test_retrieve_finds_relevant_golden_config():
    hits = retrieve("golden_configs", "edge interface uplink no shutdown", k=3)
    assert len(hits) > 0
    assert hits[0]["metadata"]["role"] == "edge"


def test_retrieve_returns_empty_below_threshold():
    hits = retrieve("golden_configs", "zzzzz nonsense query unrelated", k=3, min_similarity=0.9)
    assert hits == []


def test_retrieve_ca_trust_bundle():
    hits = retrieve("ca_trust_bundle", "revoked certificate hard fail", k=3)
    assert len(hits) > 0
