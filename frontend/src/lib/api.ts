import axios from "axios";
import type { ProvisioningRequest, RunState } from "../types";

const API_BASE = "http://localhost:8000";
const WS_BASE = "ws://localhost:8000";

const client = axios.create({ baseURL: API_BASE });

export async function submitValidation(request: ProvisioningRequest): Promise<{ run_id: string }> {
  const { data } = await client.post("/api/validate", request);
  return data;
}

export async function getRun(runId: string): Promise<RunState> {
  const { data } = await client.get(`/api/runs/${runId}`);
  return data;
}

export async function listRuns(): Promise<RunState[]> {
  const { data } = await client.get("/api/runs");
  return data;
}

export async function approveRun(
  runId: string,
  decision: "approve" | "reject",
  reviewerId: string,
  comment: string
): Promise<void> {
  await client.post(`/api/runs/${runId}/approve`, { decision, reviewer_id: reviewerId, comment });
}

export function openRunStream(runId: string): WebSocket {
  return new WebSocket(`${WS_BASE}/api/runs/${runId}/stream`);
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
}

export async function listScenarios(): Promise<Scenario[]> {
  const { data } = await client.get("/api/scenarios");
  return data;
}

export async function runScenario(id: string): Promise<{ run_id: string }> {
  const { data } = await client.post(`/api/scenarios/${id}/run`);
  return data;
}

export interface Metrics {
  total_runs: number;
  success_rate: number;
  hitl_rate: number;
  rollback_count: number;
  avg_cycle_time_ms: number;
}

export async function getMetrics(): Promise<Metrics> {
  const { data } = await client.get("/api/metrics");
  return data;
}

export interface Topology {
  nodes: string[];
  edges: { source: string; target: string; type: string }[];
}

export async function getTopology(): Promise<Topology> {
  const { data } = await client.get("/api/topology");
  return data;
}

export async function getGoldenConfig(role: string): Promise<{ role: string; content: string }> {
  const { data } = await client.get(`/api/golden-config/${role}`);
  return data;
}
