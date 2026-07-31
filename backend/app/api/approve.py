from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.graph.runner import approve_run
from app.storage.run_store import get_run

router = APIRouter()


class ApprovalRequest(BaseModel):
    decision: str
    reviewer_id: str | None = None
    comment: str | None = None


@router.post("/api/runs/{run_id}/approve")
async def approve(run_id: str, payload: ApprovalRequest):
    if get_run(run_id) is None:
        raise HTTPException(status_code=404, detail="run not found")
    await approve_run(run_id, payload.model_dump())
    return {"status": "resuming"}
