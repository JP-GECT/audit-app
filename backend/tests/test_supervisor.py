from app.graph.supervisor import resume_run, start_run
from tests.conftest import make_request


async def test_clean_request_auto_approves_without_interrupt():
    request = make_request(10)
    result = await start_run(request, run_id="test-run-clean")

    assert "__interrupt__" not in result
    assert result["final_status"] == "completed"
    assert result["decision"].decision == "approve"
    assert result["risk"].hard_fail is False


async def test_broken_request_pauses_for_human_approval():
    request = make_request(4)  # revoked certificate -> hard fail
    result = await start_run(request, run_id="test-run-broken")

    assert "__interrupt__" in result
    interrupt_payload = result["__interrupt__"][0].value
    assert interrupt_payload["type"] == "approval_required"
    assert interrupt_payload["hard_fail"] is True


async def test_resuming_with_reject_completes_run():
    request = make_request(4)
    run_id = "test-run-resume"
    paused = await start_run(request, run_id=run_id)
    assert "__interrupt__" in paused

    final = await resume_run(run_id, {"decision": "reject", "reviewer_id": "reviewer-1", "comment": "cert revoked"})

    assert "__interrupt__" not in final
    assert final["final_status"] == "rejected"
    assert final["decision"].decision == "reject"
    assert final["decision"].reviewer_id == "reviewer-1"


async def test_high_blast_radius_request_auto_approves_then_pauses_for_rollback():
    request = make_request(5)  # clean device, but high-fanout topology hub
    run_id = "test-run-rollback"
    paused = await start_run(request, run_id=run_id)

    assert "__interrupt__" in paused
    interrupt_payload = paused["__interrupt__"][0].value
    assert interrupt_payload["recommendation"] == "rollback"
    assert paused["decision"].decision == "approve"

    final = await resume_run(run_id, {"decision": "approve", "reviewer_id": "reviewer-2", "comment": "confirm rollback"})

    assert "__interrupt__" not in final
    assert final["final_status"] == "rolled_back"
