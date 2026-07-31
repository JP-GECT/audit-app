import type { DeviceProfile } from "../types";

export const CLEAN_DEVICE: DeviceProfile = {
  device_id: "dev-020",
  model: "ASR-1001",
  os: "ios-xe",
  firmware_version: "17.6.4",
  site: "site-b",
  role: "distribution",
  certificate: {
    issuer: "Internal CA",
    expires_at: "2027-01-21T19:30:41.264129+00:00",
    revoked: false,
  },
  nac_posture: {
    compliant: true,
    checks: { dot1x: true, mab: true },
  },
  fingerprint: "24bc87b2b67c3077",
};

export const BROKEN_DEVICE: DeviceProfile = {
  device_id: "dev-004",
  model: "ISR-4331",
  os: "ios-xe",
  firmware_version: "16.12.5",
  site: "site-c",
  role: "distribution",
  certificate: {
    issuer: "Internal CA",
    expires_at: "2027-04-10T19:30:41.264129+00:00",
    revoked: true,
  },
  nac_posture: {
    compliant: true,
    checks: { dot1x: true, mab: true },
  },
  fingerprint: "8717195c92805af2",
};
