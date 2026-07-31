import json
import time
from pathlib import Path

import networkx as nx

from app.guardrails.grounding import require_citations
from app.models.schemas import AgentResult
from app.rag.retriever import retrieve
from app.tools.llm_client import explain

TOPOLOGY_PATH = Path(__file__).parent.parent.parent / "data" / "synthetic" / "topology.json"


def _load_graph() -> nx.DiGraph:
    raw = json.loads(TOPOLOGY_PATH.read_text())
    graph = nx.DiGraph()
    graph.add_nodes_from(raw["nodes"])
    for edge in raw["edges"]:
        graph.add_edge(edge["source"], edge["target"], type=edge["type"])
    return graph


async def run(state: dict) -> AgentResult:
    start = time.monotonic()
    device_id = state["request"].device.device_id
    graph = _load_graph()

    downstream = list(nx.descendants(graph, device_id)) if device_id in graph else []

    chunks = retrieve("topology_and_incidents", "blast radius core uplink outage dependency", k=3, min_similarity=0.15)
    citations = [c["metadata"].get("source_file", "topology_and_incidents") for c in chunks]

    status = "warning" if len(downstream) > 5 else "pass"
    summary = f"{len(downstream)} downstream device(s) affected if {device_id} fails"

    explanation = await explain(
        f"Device {device_id} has {len(downstream)} downstream dependents: {downstream}. "
        "Briefly classify the blast radius risk."
    )

    result = AgentResult(
        agent_name="blast_radius_sim",
        status=status,
        confidence=0.8,
        summary=summary,
        evidence=[summary, explanation],
        citations=citations,
        duration_ms=int((time.monotonic() - start) * 1000),
    )
    return require_citations(result, chunks)
