from fastapi import APIRouter

from app.config import settings

router = APIRouter()


@router.get("/config-check")
def config_check():
    return {"anthropic_api_key_set": bool(settings.anthropic_api_key)}
