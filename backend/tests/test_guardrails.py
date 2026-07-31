import pytest

from app.guardrails.budget import BudgetExceeded, RunBudget
from app.guardrails.grounding import require_citations
from app.guardrails.policy import compute_risk_score, requires_human, rollback_preconditions_met
from app.guardrails.redaction import redact_secrets
from app.guardrails.schemas import GuardrailViolation, validate_agent_output
from app.models.schemas import AgentResult


def make_result(**overrides) -> AgentResult:
    base = dict(
        agent_name="test_agent",
        status="pass",
        confidence=0.9,
        summary="ok",
        evidence=[],
        citations=[],
        duration_ms=10,
    )
    base.update(overrides)
    return AgentResult(**base)


def test_redact_secrets_masks_api_key():
    text = "config set api_key=sk-abcdefghijklmnopqrstuvwxyz123456"
    redacted = redact_secrets(text)
    assert "sk-abcdefghijklmnopqrstuvwxyz123456" not in redacted
    assert "[REDACTED]" in redacted


def test_redact_secrets_leaves_normal_text_untouched():
    text = "hostname edge-01\ninterface Gi0/0"
    assert redact_secrets(text) == text


def test_validate_agent_output_success():
    result = validate_agent_output({"agent_name": "a", "status": "pass", "confidence": 0.5, "summary": "s", "duration_ms": 1}, AgentResult)
    assert result.agent_name == "a"


def test_validate_agent_output_raises_without_reprompt():
    with pytest.raises(GuardrailViolation):
        validate_agent_output({"agent_name": "a"}, AgentResult)


def test_validate_agent_output_retries_and_succeeds():
    def reprompt(raw, error):
        return {**raw, "status": "pass", "confidence": 0.5, "summary": "s", "duration_ms": 1}

    result = validate_agent_output({"agent_name": "a"}, AgentResult, reprompt_fn=reprompt)
    assert result.status == "pass"


def test_validate_agent_output_raises_after_failed_retry():
    def reprompt(raw, error):
        return raw

    with pytest.raises(GuardrailViolation):
        validate_agent_output({"agent_name": "a"}, AgentResult, reprompt_fn=reprompt)


def test_require_citations_forces_insufficient_data_when_no_chunks():
    result = make_result(status="pass", citations=["x"])
    updated = require_citations(result, [])
    assert updated.status == "insufficient_data"
    assert updated.citations == []


def test_require_citations_passes_through_with_chunks():
    result = make_result(status="pass")
    updated = require_citations(result, ["chunk1"])
    assert updated.status == "pass"


def test_compute_risk_score_all_pass_is_low():
    results = [make_result(status="pass", confidence=0.9), make_result(status="pass", confidence=0.8)]
    risk = compute_risk_score(results)
    assert risk.risk_score == 0.0
    assert risk.hard_fail is False


def test_compute_risk_score_any_fail_is_hard_fail():
    results = [make_result(status="pass"), make_result(status="fail", confidence=0.9)]
    risk = compute_risk_score(results)
    assert risk.hard_fail is True


def test_requires_human_on_hard_fail():
    risk = compute_risk_score([make_result(status="fail")])
    assert requires_human(risk, threshold=0.6) is True


def test_requires_human_on_threshold():
    results = [make_result(status="warning", confidence=1.0)]
    risk = compute_risk_score(results)
    assert requires_human(risk, threshold=0.3) is True
    assert requires_human(risk, threshold=0.9) is False


def test_rollback_preconditions_met_false_on_insufficient_data():
    results = [make_result(status="insufficient_data")]
    assert rollback_preconditions_met(results) is False


def test_rollback_preconditions_met_true_otherwise():
    results = [make_result(status="pass"), make_result(status="warning")]
    assert rollback_preconditions_met(results) is True


def test_budget_consume_within_limit():
    b = RunBudget(max_calls=3)
    assert b.consume("run-1") == 1
    assert b.consume("run-1") == 2
    assert b.remaining("run-1") == 1


def test_budget_exceeded_raises():
    b = RunBudget(max_calls=2)
    b.consume("run-1")
    b.consume("run-1")
    with pytest.raises(BudgetExceeded):
        b.consume("run-1")


def test_budget_tracks_runs_independently():
    b = RunBudget(max_calls=1)
    b.consume("run-1")
    b.consume("run-2")
    assert b.remaining("run-1") == 0
    assert b.remaining("run-2") == 0
