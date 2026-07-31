from fastapi import APIRouter

from app.graph.runner import start_run
from app.models.schemas import ProvisioningRequest

router = APIRouter()


@router.post("/api/validate")
async def validate(request: ProvisioningRequest):
    run_id = await start_run(request)
    return {"run_id": run_id}
