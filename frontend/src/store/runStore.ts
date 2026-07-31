import { create } from "zustand";
import { approveRun, getRun, openRunStream, runScenario, submitValidation } from "../lib/api";
import type { AgentResult, Decision, ProvisioningRequest, RiskAssessment, RunState, StreamMessage } from "../types";

let activeSocket: WebSocket | null = null;

interface RunStore {
  runId: string | null;
  request: ProvisioningRequest | null;
  results: AgentResult[];
  risk: RiskAssessment | null;
  decision: Decision | null;
  interruptPayload: RunState["interrupt_payload"] | null;
  status: string;
  auditTrail: RunState["audit_trail"];
  loading: boolean;
  error: string | null;

  startRun: (request: ProvisioningRequest) => Promise<string>;
  startScenario: (id: string) => Promise<string>;
  hydrate: (runId: string) => Promise<void>;
  respond: (decision: "approve" | "reject", reviewerId: string, comment: string) => Promise<void>;
  reset: () => void;
}

const initialRunFields = {
  runId: null,
  request: null,
  results: [],
  risk: null,
  decision: null,
  interruptPayload: null,
  status: "idle",
  auditTrail: [],
  loading: false,
  error: null,
};

export const useRunStore = create<RunStore>((set, get) => {
  function attachStream(runId: string) {
    activeSocket?.close();
    const ws = openRunStream(runId);
    activeSocket = ws;
    ws.onmessage = (event) => {
      const msg: StreamMessage = JSON.parse(event.data);
      if (get().runId !== runId) return;
      switch (msg.type) {
        case "agent_result":
          set((s) =>
            s.results.some((r) => r.agent_name === msg.data.agent_name)
              ? s
              : { results: [...s.results, msg.data] }
          );
          break;
        case "risk_assessment":
          set({ risk: msg.data });
          break;
        case "decision":
          set({ decision: msg.data });
          break;
        case "awaiting_approval":
          set({ interruptPayload: msg.data ?? null, status: "awaiting_approval" });
          break;
        case "finalized":
          set({ status: msg.data.status });
          break;
        case "error":
          set({ error: msg.data.detail });
          break;
        case "stream_end":
          ws.close();
          break;
      }
    };
    ws.onerror = () => set({ error: "websocket error" });
  }

  return {
    ...initialRunFields,

    async startRun(request) {
      set({ ...initialRunFields, status: "running", runId: null, request, loading: true });
      try {
        const { run_id } = await submitValidation(request);
        set({ runId: run_id, loading: false });
        attachStream(run_id);
        return run_id;
      } catch (err) {
        set({ error: String(err), status: "error", loading: false });
        throw err;
      }
    },

    async startScenario(id) {
      set({ ...initialRunFields, status: "running", runId: null, loading: true });
      try {
        const { run_id } = await runScenario(id);
        // The scenario's request body lives server-side; fetch it once so the
        // dashboard/impact/compliance views have device + proposed_config to render.
        const run = await getRun(run_id);
        set({ runId: run_id, request: run.request, loading: false });
        attachStream(run_id);
        return run_id;
      } catch (err) {
        set({ error: String(err), status: "error", loading: false });
        throw err;
      }
    },

    async hydrate(runId) {
      // Guards against React StrictMode's dev-mode double-invoked mount effect, and
      // against redundantly re-fetching a run that startRun/startScenario just attached.
      if (get().runId === runId) return;
      set({ ...initialRunFields, runId, loading: true });
      try {
        const run = await getRun(runId);
        set({
          runId: run.run_id,
          request: run.request,
          results: run.results,
          risk: run.risk,
          decision: run.decision,
          interruptPayload: run.interrupt_payload ?? null,
          status: run.status,
          auditTrail: run.audit_trail,
          loading: false,
        });
        if (run.status === "running" || run.status === "awaiting_approval") {
          attachStream(runId);
        }
      } catch (err) {
        set({ error: String(err), loading: false });
      }
    },

    async respond(decisionValue, reviewerId, comment) {
      const runId = get().runId;
      if (!runId) return;
      try {
        await approveRun(runId, decisionValue, reviewerId, comment);
        set({ status: "running", interruptPayload: null });
      } catch (err) {
        set({ error: String(err) });
      }
    },

    reset() {
      activeSocket?.close();
      activeSocket = null;
      set({ ...initialRunFields });
    },
  };
});
