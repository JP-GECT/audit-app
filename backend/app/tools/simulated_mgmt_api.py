import asyncio
import json
from pathlib import Path

DATA_PATH = Path(__file__).parent.parent / "data" / "synthetic" / "reachability_logs.json"
_LOGS: dict | None = None


def _load_logs() -> dict:
    global _LOGS
    if _LOGS is None:
        raw = json.loads(DATA_PATH.read_text())
        _LOGS = {entry["device_id"]: entry for entry in raw}
    return _LOGS


async def probe(device_id: str, check: str) -> dict:
    await asyncio.sleep(0)
    logs = _load_logs()
    entry = logs.get(device_id)
    if entry is None:
        return {"reachable": False, "latency_ms": None}
    return entry[check]
