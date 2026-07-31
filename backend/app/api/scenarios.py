import json
from pathlib import Path

from fastapi import APIRouter, HTTPException

from app.graph.runner import start_run
from app.models.schemas import ProvisioningRequest

router = APIRouter()
SCENARIOS_PATH = Path(__file__).parent.parent / "data" / "synthetic" / "scenarios.json"


def _load_scenarios() -> list[dict]:
    return json.loads(SCENARIOS_PATH.read_text()).get("scenarios", [])


@router.get("/api/scenarios")
def list_scenarios():
    return _load_scenarios()


@router.post("/api/scenarios/{scenario_id}/run")
async def run_scenario(scenario_id: str):
    scenarios = _load_scenarios()
    match = next((s for s in scenarios if s.get("id") == scenario_id), None)
    if match is None:
        raise HTTPException(status_code=404, detail="scenario not found")
    request = ProvisioningRequest(**match["request"])
    run_id = await start_run(request)
    return {"run_id": run_id}
