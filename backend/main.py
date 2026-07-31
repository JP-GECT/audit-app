from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.approve import router as approve_router
from app.api.config_check import router as config_check_router
from app.api.escalate import router as escalate_router
from app.api.health import router as health_router
from app.api.metrics import router as metrics_router
from app.api.runs import router as runs_router
from app.api.scenarios import router as scenarios_router
from app.api.stream import router as stream_router
from app.api.topology import router as topology_router
from app.api.validate import router as validate_router

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(config_check_router)
app.include_router(validate_router)
app.include_router(runs_router)
app.include_router(approve_router)
app.include_router(escalate_router)
app.include_router(metrics_router)
app.include_router(scenarios_router)
app.include_router(stream_router)
app.include_router(topology_router)
