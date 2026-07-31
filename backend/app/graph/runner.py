import asyncio
import time
import uuid
from datetime import datetime, timezone

from langgraph.types import Command

from app.graph.supervisor import get_compiled_graph
from app.models.schemas import ProvisioningRequest
from app.storage.run_store import append_audit_event, get_run, mirror_to_disk, save_run

_QUEUES: dict[str, asyncio.Queue] = {}


def get_queue(run_id: str) -> asyncio.Queue:
    if run_id not in _QUEUES:
        _QUEUES[run_id] = asyncio.Queue()
    return _QUEUES[run_id]


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _publish(run_id: str, message: dict) -> None:
    await get_queue(run_id).put(message)


async def _execute(run_id: str, request: ProvisioningRequest, resume_response: dict | None = None) -> None:
    graph = get_compiled_graph()
    config = {"configurable": {"thread_id": run_id}}

    if resume_response is None:
        graph_input = {
            "request": request,
            "results": [],
            "risk": None,
            "decision": None,
            "final_status": "running",
        }
    else:
        graph_input = Command(resume=resume_response)

    async for chunk in graph.astream(graph_input, config=config, stream_mode="updates"):
        if "__interrupt__" in chunk:
            interrupt_obj = chunk["__interrupt__"][0]
            run = get_run(run_id)
            run["status"] = "awaiting_approval"
            run["interrupt_payload"] = interrupt_obj.value
            save_run(run_id, run)
            append_audit_event(
                run_id,
                {"timestamp": _now_iso(), "actor": "system", "event_type": "awaiting_approval", "payload": interrupt_obj.value},
            )
            await _publish(run_id, {"type": "awaiting_approval", "data": interrupt_obj.value})
            continue

        for _node_name, update in chunk.items():
            if not update:
                continue

            if "results" in update:
                for result in update["results"]:
                    payload = result.model_dump(mode="json")
                    run = get_run(run_id)
                    run.setdefault("results", []).append(payload)
                    save_run(run_id, run)
                    append_audit_event(
                        run_id,
                        {"timestamp": _now_iso(), "actor": result.agent_name, "event_type": "agent_result", "payload": payload},
                    )
                    await _publish(run_id, {"type": "agent_result", "data": payload})

            if update.get("risk") is not None:
                payload = update["risk"].model_dump(mode="json")
                run = get_run(run_id)
                run["risk"] = payload
                save_run(run_id, run)
                await _publish(run_id, {"type": "risk_assessment", "data": payload})

            if update.get("decision") is not None:
                payload = update["decision"].model_dump(mode="json")
                run = get_run(run_id)
                run["decision"] = payload
                save_run(run_id, run)
                append_audit_event(
                    run_id,
                    {"timestamp": _now_iso(), "actor": payload.get("reviewer_id") or "system", "event_type": "decision", "payload": payload},
                )
                await _publish(run_id, {"type": "decision", "data": payload})

            if "final_status" in update:
                run = get_run(run_id)
                run["status"] = update["final_status"]
                run["finished_at"] = time.time() * 1000
                save_run(run_id, run)
                mirror_to_disk(run_id)
                append_audit_event(
                    run_id,
                    {"timestamp": _now_iso(), "actor": "system", "event_type": "run_finalized", "payload": {"status": update["final_status"]}},
                )
                await _publish(run_id, {"type": "finalized", "data": {"status": update["final_status"]}})

    run = get_run(run_id)
    if run is not None and run.get("status") != "awaiting_approval":
        await _publish(run_id, {"type": "stream_end", "data": {}})


async def start_run(request: ProvisioningRequest) -> str:
    run_id = str(uuid.uuid4())
    save_run(
        run_id,
        {
            "run_id": run_id,
            "request": request.model_dump(mode="json"),
            "status": "running",
            "results": [],
            "risk": None,
            "decision": None,
            "audit_trail": [],
            "started_at": time.time() * 1000,
        },
    )
    append_audit_event(
        run_id,
        {"timestamp": _now_iso(), "actor": request.requested_by, "event_type": "run_started", "payload": {"request_id": request.request_id}},
    )
    asyncio.create_task(_execute(run_id, request))
    return run_id


async def approve_run(run_id: str, decision_payload: dict) -> None:
    run = get_run(run_id)
    if run is None:
        raise ValueError("run not found")
    request = ProvisioningRequest(**run["request"])
    asyncio.create_task(_execute(run_id, request, resume_response=decision_payload))
