import json
from pathlib import Path

from app.models.schemas import DeviceProfile, ProvisioningRequest

DATA_DIR = Path(__file__).parent.parent / "app" / "data" / "synthetic"
_DEVICES = json.loads((DATA_DIR / "device_inventory.json").read_text())


def load_device(index: int) -> DeviceProfile:
    return DeviceProfile(**_DEVICES[index])


def make_request(index: int, proposed_config: str = "hostname test\n") -> ProvisioningRequest:
    return ProvisioningRequest(
        request_id=f"req-{index}",
        device=load_device(index),
        proposed_config=proposed_config,
        change_type="new_device",
        requested_by="test-suite",
    )
