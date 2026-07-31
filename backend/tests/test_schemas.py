from datetime import datetime, timezone

from app.models.schemas import (
    AgentResult,
    AuditEvent,
    CertificateInfo,
    DeviceProfile,
    Decision,
    NacPosture,
    ProvisioningRequest,
    RiskAssessment,
)

NOW = datetime.now(timezone.utc)


def make_device() -> DeviceProfile:
    return DeviceProfile(
        device_id="dev-001",
        model="ISR-4321",
        os="ios-xe",
        firmware_version="17.3.1",
        site="site-a",
        role="edge",
        certificate=CertificateInfo(issuer="Internal CA", expires_at=NOW, revoked=False),
        nac_posture=NacPosture(compliant=True, checks={"dot1x": True}),
        fingerprint="ab:cd:ef",
    )


def test_certificate_info():
    CertificateInfo(issuer="Internal CA", expires_at=NOW, revoked=False)


def test_nac_posture():
    NacPosture(compliant=True, checks={"dot1x": True})


def test_device_profile():
    make_device()


def test_provisioning_request():
    ProvisioningRequest(
        request_id="req-001",
        device=make_device(),
        proposed_config="hostname edge-01",
        change_type="new_device",
        requested_by="jdoe",
    )


def test_agent_result():
    AgentResult(
        agent_name="cert_validation",
        status="pass",
        confidence=0.95,
        summary="Certificate valid",
        evidence=["cert not expired"],
        citations=["ca_trust_bundle#1"],
        duration_ms=120,
    )


def test_risk_assessment():
    RiskAssessment(risk_score=0.2, hard_fail=False, contributing_factors=["none"])


def test_decision():
    Decision(decision="approve", reviewer_id=None, comment=None, timestamp=NOW)


def test_audit_event():
    AuditEvent(timestamp=NOW, actor="system", event_type="run_started", payload={"run_id": "r1"})
