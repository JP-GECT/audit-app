import asyncio
import json

from fastapi.testclient import TestClient

from main import app
from tests.conftest import DATA_DIR

_DEVICES = json.loads((DATA_DIR / "device_inventory.json").read_text())


def _payload(index: int, request_id: str) -> dict:
    return {
        "request_id": request_id,
        "device": _DEVICES[index],
        "proposed_config": "hostname test\n",
        "change_type": "new_device",
        "requested_by": "api-test",
    }


def _wait_for_status(client: TestClient, run_id: str, statuses: set[str], timeout: float = 5.0):
    async def _poll():
        elapsed = 0.0
        while elapsed < timeout:
            run = client.get(f"/api/runs/{run_id}").json()
            if run["status"] in statuses:
                return run
            await asyncio.sleep(0.05)
            elapsed += 0.05
        raise TimeoutError(f"run {run_id} never reached {statuses}, last status={run['status']}")

    return asyncio.run(_poll())


def test_health_and_docs():
    with TestClient(app) as client:
        assert client.get("/health").json() == {"status": "ok"}
        assert client.get("/docs").status_code == 200


def test_clean_request_auto_completes_via_api():
    with TestClient(app) as client:
        run_id = client.post("/api/validate", json=_payload(20, "req-api-clean")).json()["run_id"]
        run = _wait_for_status(client, run_id, {"completed", "rejected"})
        assert run["status"] == "completed"
        assert run["decision"]["decision"] == "approve"
        assert len(run["results"]) == 9


def test_broken_request_pauses_then_rejects_via_api():
    with TestClient(app) as client:
        run_id = client.post("/api/validate", json=_payload(4, "req-api-broken")).json()["run_id"]
        run = _wait_for_status(client, run_id, {"awaiting_approval"})
        assert run["interrupt_payload"]["hard_fail"] is True

        approve_resp = client.post(
            f"/api/runs/{run_id}/approve",
            json={"decision": "reject", "reviewer_id": "reviewer-1", "comment": "cert revoked"},
        )
        assert approve_resp.status_code == 200

        final = _wait_for_status(client, run_id, {"rejected"})
        assert final["decision"]["decision"] == "reject"
        assert any(e["event_type"] == "run_finalized" for e in final["audit_trail"])


def test_runs_and_metrics_endpoints():
    with TestClient(app) as client:
        run_id = client.post("/api/validate", json=_payload(20, "req-api-metrics")).json()["run_id"]
        _wait_for_status(client, run_id, {"completed", "rejected"})

        runs = client.get("/api/runs").json()
        assert any(r["run_id"] == run_id for r in runs)

        metrics = client.get("/api/metrics").json()
        assert metrics["total_runs"] >= 1


def test_scenarios_endpoint_returns_list():
    with TestClient(app) as client:
        resp = client.get("/api/scenarios")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)


def test_topology_endpoint():
    with TestClient(app) as client:
        resp = client.get("/api/topology")
        assert resp.status_code == 200
        body = resp.json()
        assert "nodes" in body and "edges" in body


def test_golden_config_endpoint():
    with TestClient(app) as client:
        resp = client.get("/api/golden-config/edge")
        assert resp.status_code == 200
        assert "hostname" in resp.json()["content"]
        assert client.get("/api/golden-config/does-not-exist").status_code == 404
