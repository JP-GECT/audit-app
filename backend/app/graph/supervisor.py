import operator
from datetime import datetime, timezone
from typing import Annotated, TypedDict

from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import Command, Send, interrupt

from app.config import settings
from app.graph.hitl import raise_for_approval
from app.graph.leads import identity_trust, impact_compliance, reachability, template_compat
from app.guardrails.policy import compute_risk_score, requires_human
from app.models.schemas import AgentResult, Decision, ProvisioningRequest, RiskAssessment

LEADS = {
    "identity_trust": identity_trust.run_lead,
    "reachability": reachability.run_lead,
    "template_compat": template_compat.run_lead,
    "impact_compliance": impact_compliance.run_lead,
}


class SupervisorState(TypedDict):
    request: ProvisioningRequest
    results: Annotated[list[AgentResult], operator.add]
    risk: RiskAssessment | None
    decision: Decision | None
    final_status: str


def _make_lead_node(fn):
    async def node(state: dict) -> dict:
        results = await fn(state["request"])
        return {"results": results}

    return node


def _fan_out(state: SupervisorState):
    return [Send(name, {"request": state["request"]}) for name in LEADS]


async def _aggregator(state: SupervisorState) -> dict:
    risk = compute_risk_score(state["results"])
    return {"risk": risk}


async def _decision(state: SupervisorState) -> dict:
    risk = state["risk"]
    if requires_human(risk, settings.risk_threshold):
        payload = raise_for_approval(
            reason="hard fail detected" if risk.hard_fail else "risk score above threshold",
            risk=risk,
            evidence=[r.summary for r in state["results"]],
            recommendation="reject" if risk.hard_fail else "review",
        )
        human_response = interrupt(payload)
        decision = Decision(
            decision=human_response.get("decision", "needs_human"),
            reviewer_id=human_response.get("reviewer_id"),
            comment=human_response.get("comment"),
            timestamp=datetime.now(timezone.utc),
        )
    else:
        decision = Decision(
            decision="approve",
            reviewer_id=None,
            comment="auto-approved: risk below threshold",
            timestamp=datetime.now(timezone.utc),
        )
    return {"decision": decision}


async def _rollback_watch(state: SupervisorState) -> dict:
    if state["decision"].decision != "approve":
        return {}

    blast_result = next((r for r in state["results"] if r.agent_name == "blast_radius_sim"), None)
    if blast_result is None or blast_result.status != "warning":
        return {}

    payload = raise_for_approval(
        reason="post-deploy anomaly: blast radius warning on an approved change",
        risk=state["risk"],
        evidence=[blast_result.summary],
        recommendation="rollback",
    )
    human_response = interrupt(payload)
    if human_response.get("decision") == "approve":
        return {"final_status": "rolled_back"}
    return {}


async def _finalize(state: SupervisorState) -> dict:
    if state.get("final_status") == "rolled_back":
        return {}
    decision = state["decision"]
    status = "completed" if decision.decision == "approve" else "rejected"
    return {"final_status": status}


def build_graph():
    graph = StateGraph(SupervisorState)
    graph.add_node("entry", lambda state: {})
    for name, fn in LEADS.items():
        graph.add_node(name, _make_lead_node(fn))
        graph.add_edge(name, "aggregator")
    graph.add_node("aggregator", _aggregator)
    graph.add_node("decision", _decision)
    graph.add_node("rollback_watch", _rollback_watch)
    graph.add_node("finalize", _finalize)

    graph.add_edge(START, "entry")
    graph.add_conditional_edges("entry", _fan_out)
    graph.add_edge("aggregator", "decision")
    graph.add_edge("decision", "rollback_watch")
    graph.add_edge("rollback_watch", "finalize")
    graph.add_edge("finalize", END)

    return graph.compile(checkpointer=InMemorySaver())


_compiled = build_graph()


def get_compiled_graph():
    return _compiled


async def start_run(request: ProvisioningRequest, run_id: str) -> dict:
    config = {"configurable": {"thread_id": run_id}}
    initial_state = {
        "request": request,
        "results": [],
        "risk": None,
        "decision": None,
        "final_status": "running",
    }
    return await _compiled.ainvoke(initial_state, config=config)


async def resume_run(run_id: str, human_response: dict) -> dict:
    config = {"configurable": {"thread_id": run_id}}
    return await _compiled.ainvoke(Command(resume=human_response), config=config)
