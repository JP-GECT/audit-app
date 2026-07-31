import time

from app.models.schemas import AgentResult


async def run(state: dict) -> AgentResult:
    start = time.monotonic()
    posture = state["request"].device.nac_posture

    if not posture.compliant:
        status = "fail"
        summary = "NAC posture non-compliant"
    else:
        failed_checks = [k for k, v in posture.checks.items() if not v]
        if failed_checks:
            status = "warning"
            summary = f"non-compliant checks: {', '.join(failed_checks)}"
        else:
            status = "pass"
            summary = "all NAC checks passed"

    return AgentResult(
        agent_name="nac_posture",
        status=status,
        confidence=0.9,
        summary=summary,
        evidence=[summary],
        citations=[],
        duration_ms=int((time.monotonic() - start) * 1000),
    )
