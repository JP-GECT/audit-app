from fastapi import APIRouter

from app.storage.run_store import list_runs

router = APIRouter()


@router.get("/api/metrics")
def metrics():
    runs = list_runs()
    total = len(runs)
    completed = sum(1 for r in runs if r.get("status") == "completed")
    rolled_back = sum(1 for r in runs if r.get("status") == "rolled_back")
    hitl = sum(
        1 for r in runs if any(e.get("event_type") == "awaiting_approval" for e in r.get("audit_trail", []))
    )

    durations = [
        r["finished_at"] - r["started_at"]
        for r in runs
        if r.get("started_at") is not None and r.get("finished_at") is not None
    ]

    return {
        "total_runs": total,
        "success_rate": round(completed / total, 3) if total else 0.0,
        "hitl_rate": round(hitl / total, 3) if total else 0.0,
        "rollback_count": rolled_back,
        "avg_cycle_time_ms": round(sum(durations) / len(durations), 1) if durations else 0.0,
    }
