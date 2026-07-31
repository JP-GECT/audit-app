import json
from pathlib import Path

from app.models.schemas import DeviceProfile

DATA_DIR = Path(__file__).parent.parent / "app" / "data" / "synthetic"


def test_device_inventory_loads_into_schema():
    raw = json.loads((DATA_DIR / "device_inventory.json").read_text())
    assert len(raw) == 30
    devices = [DeviceProfile(**d) for d in raw]
    assert len(devices) == 30


def test_golden_configs_exist():
    files = list((DATA_DIR / "golden_configs").glob("*.txt"))
    assert len(files) == 6


def test_compatibility_matrix_structure():
    raw = json.loads((DATA_DIR / "compatibility_matrix.json").read_text())
    assert len(raw) > 0
    for entry in raw:
        assert {"model", "os", "firmware", "supported", "notes"} <= entry.keys()


def test_topology_structure():
    raw = json.loads((DATA_DIR / "topology.json").read_text())
    assert "nodes" in raw and "edges" in raw
    assert len(raw["nodes"]) > 0


def test_incident_corpus_exists():
    files = list((DATA_DIR / "incident_corpus").glob("*.md"))
    assert len(files) == 8


def test_reachability_logs_structure():
    raw = json.loads((DATA_DIR / "reachability_logs.json").read_text())
    assert len(raw) == 30
    for entry in raw:
        assert {"device_id", "dns", "ntp", "mgmt_plane"} <= entry.keys()


def test_scenarios_placeholder_exists():
    raw = json.loads((DATA_DIR / "scenarios.json").read_text())
    assert "scenarios" in raw
