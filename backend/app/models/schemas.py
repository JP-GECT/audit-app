from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class CertificateInfo(BaseModel):
    issuer: str
    expires_at: datetime
    revoked: bool


class NacPosture(BaseModel):
    compliant: bool
    checks: dict[str, bool]


class DeviceProfile(BaseModel):
    device_id: str
    model: str
    os: str
    firmware_version: str
    site: str
    role: Literal["edge", "core", "access", "distribution"]
    certificate: CertificateInfo
    nac_posture: NacPosture
    fingerprint: str


class ProvisioningRequest(BaseModel):
    request_id: str
    device: DeviceProfile
    proposed_config: str
    change_type: Literal["new_device", "config_push", "firmware_upgrade"]
    requested_by: str


class AgentResult(BaseModel):
    agent_name: str
    status: Literal["pass", "fail", "warning", "insufficient_data"]
    confidence: float
    summary: str
    evidence: list[str] = []
    citations: list[str] = []
    duration_ms: int


class RiskAssessment(BaseModel):
    risk_score: float
    hard_fail: bool
    contributing_factors: list[str]


class Decision(BaseModel):
    decision: Literal["approve", "reject", "needs_human"]
    reviewer_id: str | None = None
    comment: str | None = None
    timestamp: datetime


class AuditEvent(BaseModel):
    timestamp: datetime
    actor: str
    event_type: str
    payload: dict
