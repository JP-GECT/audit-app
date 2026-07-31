import time

from app.models.schemas import AgentResult


async def run(state: dict) -> AgentResult:
    start = time.monotonic()
    fingerprint = state["request"].device.fingerprint

    if not fingerprint or fingerprint == "INVALID" or len(fingerprint) < 8:
        status = "fail"
        summary = f"device fingerprint invalid or malformed: '{fingerprint}'"
    else:
        status = "pass"
        summary = f"device fingerprint '{fingerprint}' is well-formed"

    return AgentResult(
        agent_name="device_fingerprint",
        status=status,
        confidence=0.85,
        summary=summary,
        evidence=[summary],
        citations=[],
        duration_ms=int((time.monotonic() - start) * 1000),
    )
