import difflib
import time
from pathlib import Path

from app.guardrails.grounding import require_citations
from app.models.schemas import AgentResult
from app.rag.retriever import retrieve
from app.tools.llm_client import explain

GOLDEN_DIR = Path(__file__).parent.parent.parent / "data" / "synthetic" / "golden_configs"


async def run(state: dict) -> AgentResult:
    start = time.monotonic()
    request = state["request"]
    role = request.device.role
    golden_path = GOLDEN_DIR / f"golden_{role}.txt"

    golden_text = golden_path.read_text(encoding="utf-8") if golden_path.exists() else ""
    diff = list(
        difflib.unified_diff(
            golden_text.splitlines(),
            request.proposed_config.splitlines(),
            lineterm="",
        )
    )

    chunks = retrieve("golden_configs", f"{role} golden config template", k=3, min_similarity=0.15)
    citations = [c["metadata"].get("source_file", "golden_configs") for c in chunks]

    changed_lines = [line for line in diff if line.startswith("+") or line.startswith("-")]

    if not changed_lines:
        status = "pass"
        summary = "proposed config matches golden template exactly"
        evidence = [summary]
    else:
        status = "warning"
        explanation = await explain(
            f"Classify these config diff hunks against the {role} golden template as safe or risky:\n"
            + "\n".join(diff)
        )
        summary = f"{len(changed_lines)} line(s) differ from golden template"
        evidence = diff[:20] + [explanation]

    result = AgentResult(
        agent_name="golden_config_diff",
        status=status,
        confidence=0.85,
        summary=summary,
        evidence=evidence,
        citations=citations,
        duration_ms=int((time.monotonic() - start) * 1000),
    )
    return require_citations(result, chunks)
