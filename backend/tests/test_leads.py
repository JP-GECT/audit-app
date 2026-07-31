from app.graph.leads import identity_trust, impact_compliance, reachability, template_compat
from tests.conftest import make_request


async def test_identity_trust_all_pass():
    results = await identity_trust.run_lead(make_request(10))
    assert len(results) == 3
    assert {r.agent_name for r in results} == {"cert_validation", "nac_posture", "device_fingerprint"}
    assert all(r.status == "pass" for r in results)


async def test_identity_trust_one_child_fails():
    results = await identity_trust.run_lead(make_request(4))
    assert len(results) == 3
    statuses = {r.agent_name: r.status for r in results}
    assert statuses["cert_validation"] == "fail"


async def test_reachability_all_pass():
    results = await reachability.run_lead(make_request(1))
    assert len(results) == 3
    assert all(r.status == "pass" for r in results)


async def test_reachability_one_child_fails():
    results = await reachability.run_lead(make_request(7))
    assert len(results) == 3
    statuses = {r.agent_name: r.status for r in results}
    assert statuses["dns_check"] == "fail"


async def test_impact_compliance_returns_both_children():
    results = await impact_compliance.run_lead(make_request(10))
    assert len(results) == 2
    assert {r.agent_name for r in results} == {"blast_radius_sim", "golden_config_diff"}


async def test_template_compat_returns_single_result():
    results = await template_compat.run_lead(make_request(10))
    assert len(results) == 1
    assert results[0].agent_name == "template_compat"
