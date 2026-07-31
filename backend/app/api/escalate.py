from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.storage.run_store import append_audit_event, get_run, save_run

router = APIRouter()


class EscalateRequest(BaseModel):
    new_reviewer_id: str
    reason: str | None = None


@router.post("/api/runs/{run_id}/escalate")
def escalate(run_id: str, payload: EscalateRequest):
    run = get_run(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="run not found")

    run["assigned_reviewer"] = payload.new_reviewer_id
    save_run(run_id, run)
    append_audit_event(
        run_id,
        {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "actor": "system",
            "event_type": "escalated",
            "payload": payload.model_dump(),
        },
    )
    return {"status": "escalated", "assigned_reviewer": payload.new_reviewer_id}
