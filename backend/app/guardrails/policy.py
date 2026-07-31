from app.models.schemas import AgentResult, RiskAssessment

STATUS_WEIGHT = {"pass": 0.0, "warning": 0.4, "insufficient_data": 0.5, "fail": 1.0}


def compute_risk_score(results: list[AgentResult]) -> RiskAssessment:
    if not results:
        return RiskAssessment(risk_score=1.0, hard_fail=True, contributing_factors=["no agent results"])

    weighted = sum(STATUS_WEIGHT[r.status] * r.confidence for r in results) / len(results)
    hard_fail = any(r.status == "fail" for r in results)
    factors = [f"{r.agent_name}: {r.status}" for r in results if r.status in ("fail", "warning", "insufficient_data")]
    return RiskAssessment(risk_score=round(weighted, 3), hard_fail=hard_fail, contributing_factors=factors)


def requires_human(risk: RiskAssessment, threshold: float) -> bool:
    return risk.hard_fail or risk.risk_score >= threshold


def rollback_preconditions_met(results: list[AgentResult]) -> bool:
    return all(r.status != "insufficient_data" for r in results)
