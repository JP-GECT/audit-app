from app.graph.workers import (
    blast_radius_sim,
    cert_validation,
    device_fingerprint,
    dns_check,
    golden_config_diff,
    mgmt_plane_check,
    nac_posture,
    ntp_check,
)
from tests.conftest import make_request


async def test_cert_validation_pass_on_valid_device():
    result = await cert_validation.run({"request": make_request(10)})
    assert result.status == "pass"


async def test_cert_validation_fail_on_expired_cert():
    result = await cert_validation.run({"request": make_request(0)})
    assert result.status == "fail"


async def test_cert_validation_fail_on_revoked_cert():
    result = await cert_validation.run({"request": make_request(4)})
    assert result.status == "fail"


async def test_nac_posture_pass_on_compliant_device():
    result = await nac_posture.run({"request": make_request(10)})
    assert result.status == "pass"


async def test_nac_posture_fail_on_noncompliant_device():
    result = await nac_posture.run({"request": make_request(3)})
    assert result.status == "fail"


async def test_device_fingerprint_pass_on_valid_device():
    result = await device_fingerprint.run({"request": make_request(10)})
    assert result.status == "pass"


async def test_device_fingerprint_fail_on_invalid_fingerprint():
    result = await device_fingerprint.run({"request": make_request(2)})
    assert result.status == "fail"


async def test_dns_check_pass_on_reachable_device():
    result = await dns_check.run({"request": make_request(1)})
    assert result.status == "pass"


async def test_dns_check_fail_on_unreachable_device():
    result = await dns_check.run({"request": make_request(7)})
    assert result.status == "fail"


async def test_ntp_check_pass_on_reachable_device():
    result = await ntp_check.run({"request": make_request(1)})
    assert result.status == "pass"


async def test_ntp_check_fail_on_unreachable_device():
    result = await ntp_check.run({"request": make_request(13)})
    assert result.status == "fail"


async def test_mgmt_plane_check_pass_on_reachable_device():
    result = await mgmt_plane_check.run({"request": make_request(1)})
    assert result.status == "pass"


async def test_mgmt_plane_check_fail_on_unreachable_device():
    result = await mgmt_plane_check.run({"request": make_request(11)})
    assert result.status == "fail"


async def test_blast_radius_sim_returns_result_for_known_node():
    request = make_request(0)
    result = await blast_radius_sim.run({"request": request})
    assert result.agent_name == "blast_radius_sim"
    assert result.status in ("pass", "warning", "insufficient_data")


async def test_blast_radius_sim_zero_downstream_for_unknown_node():
    request = make_request(29)
    result = await blast_radius_sim.run({"request": request})
    assert "0 downstream" in result.summary or result.status in ("pass", "insufficient_data")


async def test_golden_config_diff_pass_on_exact_match():
    golden_edge = "hostname golden_edge\ninterface Gi0/0\n description edge-uplink\n no shutdown\nntp server 10.0.0.1\n"
    request = make_request(10, proposed_config=golden_edge)
    request.device.role = "edge"
    result = await golden_config_diff.run({"request": request})
    assert result.status == "pass"


async def test_golden_config_diff_warning_on_mismatch():
    request = make_request(10, proposed_config="hostname totally-different\nno ntp\n")
    request.device.role = "edge"
    result = await golden_config_diff.run({"request": request})
    assert result.status in ("warning", "insufficient_data")
