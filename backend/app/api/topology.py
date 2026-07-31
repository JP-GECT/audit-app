import json
from pathlib import Path

from fastapi import APIRouter, HTTPException

router = APIRouter()
TOPOLOGY_PATH = Path(__file__).parent.parent / "data" / "synthetic" / "topology.json"
GOLDEN_DIR = Path(__file__).parent.parent / "data" / "synthetic" / "golden_configs"


@router.get("/api/topology")
def get_topology():
    return json.loads(TOPOLOGY_PATH.read_text())


@router.get("/api/golden-config/{role}")
def get_golden_config(role: str):
    path = GOLDEN_DIR / f"golden_{role}.txt"
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"no golden config for role '{role}'")
    return {"role": role, "content": path.read_text(encoding="utf-8")}
