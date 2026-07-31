export interface CertificateInfo {
  issuer: string;
  expires_at: string;
  revoked: boolean;
}

export interface NacPosture {
  compliant: boolean;
  checks: Record<string, boolean>;
}

export interface DeviceProfile {
  device_id: string;
  model: string;
  os: string;
  firmware_version: string;
  site: string;
  role: "edge" | "core" | "access" | "distribution";
  certificate: CertificateInfo;
  nac_posture: NacPosture;
  fingerprint: string;
}

export interface ProvisioningRequest {
  request_id: string;
  device: DeviceProfile;
  proposed_config: string;
  change_type: "new_device" | "config_push" | "firmware_upgrade";
  requested_by: string;
}

export interface AgentResult {
  agent_name: string;
  status: "pass" | "fail" | "warning" | "insufficient_data";
  confidence: number;
  summary: string;
  evidence: string[];
  citations: string[];
  duration_ms: number;
}

export interface RiskAssessment {
  risk_score: number;
  hard_fail: boolean;
  contributing_factors: string[];
}

export interface Decision {
  decision: "approve" | "reject" | "needs_human";
  reviewer_id: string | null;
  comment: string | null;
  timestamp: string;
}

export interface AuditEvent {
  timestamp: string;
  actor: string;
  event_type: string;
  payload: Record<string, unknown>;
}

export interface RunState {
  run_id: string;
  request: ProvisioningRequest;
  status: string;
  results: AgentResult[];
  risk: RiskAssessment | null;
  decision: Decision | null;
  audit_trail: AuditEvent[];
  interrupt_payload?: {
    type: string;
    reason: string;
    risk_score: number;
    hard_fail: boolean;
    contributing_factors: string[];
    evidence: string[];
    recommendation: string;
  };
}

export type StreamMessage =
  | { type: "agent_result"; data: AgentResult }
  | { type: "risk_assessment"; data: RiskAssessment }
  | { type: "decision"; data: Decision }
  | { type: "awaiting_approval"; data: RunState["interrupt_payload"] }
  | { type: "finalized"; data: { status: string } }
  | { type: "stream_end"; data: Record<string, never> }
  | { type: "error"; data: { detail: string } };
