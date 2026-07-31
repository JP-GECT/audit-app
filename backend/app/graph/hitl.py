from app.models.schemas import RiskAssessment


def raise_for_approval(reason: str, risk: RiskAssessment, evidence: list[str], recommendation: str) -> dict:
    return {
        "type": "approval_required",
        "reason": reason,
        "risk_score": risk.risk_score,
        "hard_fail": risk.hard_fail,
        "contributing_factors": risk.contributing_factors,
        "evidence": evidence,
        "recommendation": recommendation,
    }
