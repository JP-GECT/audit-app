import json
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path

from faker import Faker

SEED = 42
OUT_DIR = Path(__file__).parent

MODELS = ["ISR-4321", "ISR-4331", "Catalyst-9300", "Catalyst-9200", "Nexus-93180YC", "ASR-1001"]
OS_BY_MODEL = {
    "ISR-4321": "ios-xe",
    "ISR-4331": "ios-xe",
    "Catalyst-9300": "ios-xe",
    "Catalyst-9200": "ios-xe",
    "Nexus-93180YC": "nx-os",
    "ASR-1001": "ios-xe",
}
FIRMWARE_BY_OS = {
    "ios-xe": ["17.3.1", "17.6.4", "16.12.5"],
    "nx-os": ["9.3.10", "10.2.3"],
}
SITES = ["site-a", "site-b", "site-c"]
ROLES = ["edge", "core", "access", "distribution"]


def make_devices(fake: Faker, rng: random.Random) -> list[dict]:
    devices = []
    now = datetime.now(timezone.utc)

    broken_builders = [
        lambda d: {**d, "certificate": {**d["certificate"], "expires_at": (now - timedelta(days=10)).isoformat()}},
        lambda d: {**d, "model": "UNKNOWN-9999"},
        lambda d: {**d, "fingerprint": "INVALID"},
        lambda d: {**d, "nac_posture": {"compliant": False, "checks": {"dot1x": False, "mab": False}}},
        lambda d: {**d, "certificate": {**d["certificate"], "revoked": True}},
    ]

    for i in range(30):
        model = rng.choice(MODELS)
        os_name = OS_BY_MODEL[model]
        firmware = rng.choice(FIRMWARE_BY_OS[os_name])
        device = {
            "device_id": f"dev-{i:03d}",
            "model": model,
            "os": os_name,
            "firmware_version": firmware,
            "site": rng.choice(SITES),
            "role": rng.choice(ROLES),
            "certificate": {
                "issuer": "Internal CA",
                "expires_at": (now + timedelta(days=rng.randint(30, 700))).isoformat(),
                "revoked": False,
            },
            "nac_posture": {
                "compliant": True,
                "checks": {"dot1x": True, "mab": True},
            },
            "fingerprint": fake.sha256()[:16],
        }
        if i < len(broken_builders):
            device = broken_builders[i](device)
        devices.append(device)

    return devices


def write_golden_configs():
    templates = {
        "golden_edge.txt": "hostname {name}\ninterface Gi0/0\n description edge-uplink\n no shutdown\nntp server 10.0.0.1\n",
        "golden_core.txt": "hostname {name}\nrouter ospf 1\n network 10.0.0.0 0.255.255.255 area 0\nntp server 10.0.0.1\n",
        "golden_access.txt": "hostname {name}\ninterface range Gi1/0/1-48\n switchport mode access\n switchport access vlan 100\n",
        "golden_distribution.txt": "hostname {name}\nspanning-tree mode rapid-pvst\ninterface Vlan100\n ip address 10.100.0.1 255.255.255.0\n",
        "golden_catalyst_9300.txt": "hostname {name}\nstack-mac persistent timer 0\nip dhcp snooping\n",
        "golden_nexus_93180.txt": "hostname {name}\nfeature nxapi\nvpc domain 1\n",
    }
    golden_dir = OUT_DIR / "golden_configs"
    golden_dir.mkdir(exist_ok=True)
    for filename, content in templates.items():
        (golden_dir / filename).write_text(content.format(name=filename.replace(".txt", "")), encoding="utf-8")


def make_compatibility_matrix() -> list[dict]:
    matrix = []
    for model, os_name in OS_BY_MODEL.items():
        for firmware in FIRMWARE_BY_OS[os_name]:
            supported = firmware != "16.12.5" or model != "Catalyst-9300"
            matrix.append(
                {
                    "model": model,
                    "os": os_name,
                    "firmware": firmware,
                    "supported": supported,
                    "notes": "supported baseline" if supported else "known incompatibility, see incident INC-004",
                }
            )
    return matrix


def make_topology(devices: list[dict]) -> dict:
    hub_index = 5  # clean device (indices 0-4 are deliberately broken), used as the high-fanout hub
    subset_indices = [hub_index] + [i for i in range(10) if i != hub_index]
    subset = [devices[i] for i in subset_indices]
    nodes = [d["device_id"] for d in subset]
    edges = []
    for i in range(1, len(subset)):
        edges.append({"source": nodes[0], "target": nodes[i], "type": "uplink"})
    for i in range(1, len(subset) - 1):
        edges.append({"source": nodes[i], "target": nodes[i + 1], "type": "peer"})
    return {"nodes": nodes, "edges": edges}


def write_incident_corpus():
    incident_dir = OUT_DIR / "incident_corpus"
    incident_dir.mkdir(exist_ok=True)
    incidents = [
        ("INC-001", "Expired certificate blocked provisioning", "Device cert expired before rollout; NAC rejected join. Resolution: rotate cert 30 days before expiry."),
        ("INC-002", "NAC posture drift on access switches", "Access switches missing dot1x checks after firmware rollback. Resolution: re-apply golden config post-rollback."),
        ("INC-003", "DNS resolution failure during provisioning", "New edge device could not resolve internal CA hostname. Resolution: verify DNS reachability before cert issuance."),
        ("INC-004", "Catalyst-9300 firmware 16.12.5 incompatibility", "Firmware 16.12.5 has a known stack-mac bug on Catalyst-9300. Resolution: block this firmware/model combination."),
        ("INC-005", "NTP drift caused cert validation false negative", "Unsynced clock made valid certs appear expired. Resolution: enforce NTP check before cert validation."),
        ("INC-006", "Blast radius underestimated for core uplink", "Core device outage affected more downstream devices than modeled. Resolution: refresh topology graph quarterly."),
        ("INC-007", "Config push rollback left VLAN mismatch", "Rollback restored hostname but not VLAN config. Resolution: rollback must restore full golden config, not partial diff."),
        ("INC-008", "Mgmt-plane reachability flapping during upgrade", "Firmware upgrade caused intermittent mgmt-plane timeouts. Resolution: retry mgmt-plane checks up to 2x before failing."),
    ]
    for incident_id, title, body in incidents:
        content = f"# {incident_id}: {title}\n\n## Summary\n\n{body}\n"
        (incident_dir / f"{incident_id.lower()}.md").write_text(content, encoding="utf-8")


def make_reachability_logs(devices: list[dict]) -> list[dict]:
    logs = []
    for i, d in enumerate(devices):
        dns_fail = i % 7 == 0
        ntp_fail = i % 13 == 0
        mgmt_fail = i % 11 == 0
        logs.append(
            {
                "device_id": d["device_id"],
                "dns": {"reachable": not dns_fail, "latency_ms": 999 if dns_fail else 12},
                "ntp": {"reachable": not ntp_fail, "offset_ms": 5000 if ntp_fail else 2},
                "mgmt_plane": {"reachable": not mgmt_fail, "latency_ms": 500 if mgmt_fail else 8},
            }
        )
    return logs


def main():
    fake = Faker()
    Faker.seed(SEED)
    rng = random.Random(SEED)

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    devices = make_devices(fake, rng)
    (OUT_DIR / "device_inventory.json").write_text(json.dumps(devices, indent=2), encoding="utf-8")

    write_golden_configs()

    matrix = make_compatibility_matrix()
    (OUT_DIR / "compatibility_matrix.json").write_text(json.dumps(matrix, indent=2), encoding="utf-8")

    topology = make_topology(devices)
    (OUT_DIR / "topology.json").write_text(json.dumps(topology, indent=2), encoding="utf-8")

    write_incident_corpus()

    reachability = make_reachability_logs(devices)
    (OUT_DIR / "reachability_logs.json").write_text(json.dumps(reachability, indent=2), encoding="utf-8")

    scenarios_path = OUT_DIR / "scenarios.json"
    if not scenarios_path.exists():
        scenarios_path.write_text(json.dumps({"scenarios": []}, indent=2), encoding="utf-8")

    print(f"Generated synthetic data in {OUT_DIR}")


if __name__ == "__main__":
    main()
