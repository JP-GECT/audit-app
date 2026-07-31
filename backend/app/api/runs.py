from fastapi import APIRouter, HTTPException

from app.storage.run_store import get_run, list_runs

router = APIRouter()


@router.get("/api/runs/{run_id}")
def get_run_endpoint(run_id: str):
    run = get_run(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="run not found")
    return run


@router.get("/api/runs")
def list_runs_endpoint():
    return list_runs()
