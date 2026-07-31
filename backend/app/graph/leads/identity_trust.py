import operator
from typing import Annotated, TypedDict

from langgraph.graph import END, START, StateGraph
from langgraph.types import Send

from app.graph.workers import cert_validation, device_fingerprint, nac_posture
from app.models.schemas import AgentResult, ProvisioningRequest

WORKERS = {
    "cert_validation": cert_validation.run,
    "nac_posture": nac_posture.run,
    "device_fingerprint": device_fingerprint.run,
}


class LeadState(TypedDict):
    request: ProvisioningRequest
    results: Annotated[list[AgentResult], operator.add]


def _make_node(fn):
    async def node(state: dict) -> dict:
        result = await fn(state)
        return {"results": [result]}

    return node


def _dispatch(state: LeadState):
    return [Send(name, {"request": state["request"]}) for name in WORKERS]


def build_graph():
    graph = StateGraph(LeadState)
    for name, fn in WORKERS.items():
        graph.add_node(name, _make_node(fn))
        graph.add_edge(name, END)
    graph.add_conditional_edges(START, _dispatch)
    return graph.compile()


_compiled = build_graph()


async def run_lead(request: ProvisioningRequest) -> list[AgentResult]:
    final_state = await _compiled.ainvoke({"request": request, "results": []})
    return final_state["results"]
