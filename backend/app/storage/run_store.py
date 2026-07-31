import json
from pathlib import Path

_RUNS: dict[str, dict] = {}

RUNS_DIR = Path(__file__).parent.parent / "data" / "runs"


def save_run(run_id: str, data: dict) -> None:
    _RUNS[run_id] = data


def get_run(run_id: str) -> dict | None:
    return _RUNS.get(run_id)


def list_runs() -> list[dict]:
    return list(_RUNS.values())


def append_audit_event(run_id: str, event: dict) -> None:
    run = _RUNS.setdefault(run_id, {"run_id": run_id, "audit_trail": []})
    run.setdefault("audit_trail", []).append(event)


def mirror_to_disk(run_id: str) -> None:
    run = _RUNS.get(run_id)
    if run is None:
        return
    RUNS_DIR.mkdir(parents=True, exist_ok=True)
    (RUNS_DIR / f"{run_id}.json").write_text(json.dumps(run, indent=2, default=str), encoding="utf-8")
