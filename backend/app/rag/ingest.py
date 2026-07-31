import json
from pathlib import Path

from app.rag.chroma_client import get_client
from app.rag.embeddings import HashEmbeddingFunction

DATA_DIR = Path(__file__).parent.parent / "data" / "synthetic"

COLLECTIONS = [
    "golden_configs",
    "compatibility_matrix",
    "ca_trust_bundle",
    "topology_and_incidents",
    "runbooks",
]

RUNBOOKS = {
    "runbook_rollback.md": "Runbook: Rollback Procedure\n\nWhen a post-deploy anomaly is detected on a device with high blast radius, "
    "restore the full golden config for that device role (not a partial diff), verify reachability, "
    "then confirm with the on-call reviewer before closing the run.",
    "runbook_cert_rotation.md": "Runbook: Certificate Rotation\n\nRotate device certificates at least 30 days before expiry. "
    "If a certificate is already expired or revoked, provisioning must hard-fail and require human approval.",
    "runbook_reachability.md": "Runbook: Reachability Checks\n\nDNS, NTP, and mgmt-plane checks should each retry up to 2 times "
    "before being marked failed. NTP drift can cause certificate validation to falsely report expiry.",
}


def _get_or_create(client, name, ef):
    return client.get_or_create_collection(name, embedding_function=ef, metadata={"hnsw:space": "cosine"})


def ingest_golden_configs(client, ef):
    coll = _get_or_create(client, "golden_configs", ef)
    golden_dir = DATA_DIR / "golden_configs"
    docs, ids, metas = [], [], []
    for path in sorted(golden_dir.glob("*.txt")):
        docs.append(path.read_text(encoding="utf-8"))
        ids.append(path.stem)
        metas.append({"source_file": path.name, "role": path.stem.replace("golden_", "")})
    coll.upsert(documents=docs, ids=ids, metadatas=metas)


def ingest_compatibility_matrix(client, ef):
    coll = _get_or_create(client, "compatibility_matrix", ef)
    raw = json.loads((DATA_DIR / "compatibility_matrix.json").read_text())
    docs, ids, metas = [], [], []
    for i, entry in enumerate(raw):
        text = (
            f"Model {entry['model']} running {entry['os']} firmware {entry['firmware']} is "
            f"{'supported' if entry['supported'] else 'NOT supported'}. Notes: {entry['notes']}"
        )
        docs.append(text)
        ids.append(f"compat-{i}")
        metas.append({"device_model": entry["model"], "os_version": entry["os"], "source_file": "compatibility_matrix.json"})
    coll.upsert(documents=docs, ids=ids, metadatas=metas)


def ingest_ca_trust_bundle(client, ef):
    coll = _get_or_create(client, "ca_trust_bundle", ef)
    docs = [
        "Internal CA is the sole trusted issuer for all device certificates across all sites. "
        "Certificates issued by any other authority must be rejected.",
        "Certificates are valid for a maximum of 825 days from issuance. Any certificate expiring in "
        "fewer than 30 days should be flagged for rotation before provisioning proceeds.",
        "A revoked certificate is an automatic hard-fail regardless of remaining validity period.",
    ]
    ids = [f"ca-trust-{i}" for i in range(len(docs))]
    metas = [{"source_file": "ca_trust_bundle"} for _ in docs]
    coll.upsert(documents=docs, ids=ids, metadatas=metas)


def ingest_topology_and_incidents(client, ef):
    coll = _get_or_create(client, "topology_and_incidents", ef)
    docs, ids, metas = [], [], []

    topology = json.loads((DATA_DIR / "topology.json").read_text())
    topo_text = (
        f"Topology has {len(topology['nodes'])} nodes and {len(topology['edges'])} edges. "
        f"Nodes: {', '.join(topology['nodes'])}."
    )
    docs.append(topo_text)
    ids.append("topology-summary")
    metas.append({"source_file": "topology.json"})

    for path in sorted((DATA_DIR / "incident_corpus").glob("*.md")):
        docs.append(path.read_text(encoding="utf-8"))
        ids.append(path.stem)
        metas.append({"source_file": path.name})

    coll.upsert(documents=docs, ids=ids, metadatas=metas)


def ingest_runbooks(client, ef):
    coll = _get_or_create(client, "runbooks", ef)
    docs = list(RUNBOOKS.values())
    ids = [name.replace(".md", "") for name in RUNBOOKS]
    metas = [{"source_file": name} for name in RUNBOOKS]
    coll.upsert(documents=docs, ids=ids, metadatas=metas)


def main():
    client = get_client()
    ef = HashEmbeddingFunction()

    ingest_golden_configs(client, ef)
    ingest_compatibility_matrix(client, ef)
    ingest_ca_trust_bundle(client, ef)
    ingest_topology_and_incidents(client, ef)
    ingest_runbooks(client, ef)

    for name in COLLECTIONS:
        coll = client.get_collection(name, embedding_function=ef)
        print(f"{name}: {coll.count()} docs")


if __name__ == "__main__":
    main()
