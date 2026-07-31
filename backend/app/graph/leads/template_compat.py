import time

from app.guardrails.grounding import require_citations
from app.models.schemas import AgentResult, ProvisioningRequest
from app.rag.retriever import retrieve


async def _check(state: dict) -> AgentResult:
    start = time.monotonic()
    device = state["request"].device

    query = f"{device.model} {device.os} {device.firmware_version} compatibility supported"
    chunks = retrieve("compatibility_matrix", query, k=3, min_similarity=0.15)
    citations = [c["metadata"].get("source_file", "compatibility_matrix") for c in chunks]

    if chunks and "not supported" in chunks[0]["document"].lower():
        status = "fail"
        summary = f"{device.model}/{device.os}/{device.firmware_version} is not a supported combination"
    elif chunks:
        status = "pass"
        summary = f"{device.model}/{device.os}/{device.firmware_version} is a supported combination"
    else:
        status = "insufficient_data"
        summary = f"no compatibility data found for {device.model}/{device.os}/{device.firmware_version}"

    result = AgentResult(
        agent_name="template_compat",
        status=status,
        confidence=0.85,
        summary=summary,
        evidence=[summary],
        citations=citations,
        duration_ms=int((time.monotonic() - start) * 1000),
    )
    return require_citations(result, chunks)


async def run_lead(request: ProvisioningRequest) -> list[AgentResult]:
    result = await _check({"request": request})
    return [result]
