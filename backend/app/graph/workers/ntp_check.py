import time

from app.models.schemas import AgentResult
from app.tools.simulated_mgmt_api import probe

MAX_RETRIES = 2


async def run(state: dict) -> AgentResult:
    start = time.monotonic()
    device_id = state["request"].device.device_id

    attempt = 0
    result = await probe(device_id, "ntp")
    while not result["reachable"] and attempt < MAX_RETRIES:
        attempt += 1
        result = await probe(device_id, "ntp")

    status = "pass" if result["reachable"] else "fail"
    summary = (
        f"NTP {'reachable' if result['reachable'] else 'unreachable'} after "
        f"{attempt + 1} attempt(s), offset={result.get('offset_ms')}ms"
    )

    return AgentResult(
        agent_name="ntp_check",
        status=status,
        confidence=0.9,
        summary=summary,
        evidence=[summary],
        citations=[],
        duration_ms=int((time.monotonic() - start) * 1000),
    )
