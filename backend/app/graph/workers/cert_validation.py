import time
from datetime import datetime, timezone

from app.guardrails.grounding import require_citations
from app.models.schemas import AgentResult
from app.rag.retriever import retrieve


async def run(state: dict) -> AgentResult:
    start = time.monotonic()
    request = state["request"]
    cert = request.device.certificate

    chunks = retrieve("ca_trust_bundle", "certificate revoked expired trust issuer", k=3, min_similarity=0.15)
    citations = [c["metadata"].get("source_file", "ca_trust_bundle") for c in chunks]

    now = datetime.now(timezone.utc)
    if cert.revoked:
        status = "fail"
        summary = "certificate is revoked"
    elif cert.expires_at <= now:
        status = "fail"
        summary = f"certificate expired at {cert.expires_at.isoformat()}"
    elif cert.issuer != "Internal CA":
        status = "fail"
        summary = f"certificate issued by untrusted issuer: {cert.issuer}"
    else:
        status = "pass"
        summary = f"certificate valid, issued by {cert.issuer}, expires {cert.expires_at.isoformat()}"

    result = AgentResult(
        agent_name="cert_validation",
        status=status,
        confidence=0.95,
        summary=summary,
        evidence=[summary],
        citations=citations,
        duration_ms=int((time.monotonic() - start) * 1000),
    )
    return require_citations(result, chunks)
