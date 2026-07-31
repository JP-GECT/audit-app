from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.graph.runner import get_queue
from app.storage.run_store import get_run

router = APIRouter()


@router.websocket("/api/runs/{run_id}/stream")
async def stream_run(websocket: WebSocket, run_id: str):
    await websocket.accept()

    if get_run(run_id) is None:
        await websocket.send_json({"type": "error", "data": {"detail": "run not found"}})
        await websocket.close()
        return

    queue = get_queue(run_id)
    try:
        while True:
            message = await queue.get()
            await websocket.send_json(message)
            if message["type"] == "stream_end":
                break
    except WebSocketDisconnect:
        pass
