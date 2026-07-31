import { useEffect, useRef, useState } from "react";
import AgentGraph from "../components/AgentGraph";
import AgentResultCard from "../components/AgentResultCard";
import ApprovalPanel from "../components/ApprovalPanel";
import RiskGauge from "../components/RiskGauge";
import StatusBadge from "../components/StatusBadge";
import { useRunStore } from "../store/runStore";

export default function LiveDashboardPage() {
  const results = useRunStore((s) => s.results);
  const risk = useRunStore((s) => s.risk);
  const decision = useRunStore((s) => s.decision);
  const interruptPayload = useRunStore((s) => s.interruptPayload);
  const status = useRunStore((s) => s.status);
  const respond = useRunStore((s) => s.respond);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (selectedAgent && cardRefs.current[selectedAgent]) {
      cardRefs.current[selectedAgent]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selectedAgent]);

  return (
    <div className="animate-fade-slide-in space-y-6">
      <AgentGraph results={results} selectedAgent={selectedAgent} onSelectAgent={setSelectedAgent} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-2">
          <div className="neu-raised rounded-2xl p-4">
            {risk ? (
              <RiskGauge risk={risk} />
            ) : (
              <div className="text-sm" style={{ color: "var(--text-muted)" }}>
                Waiting for all checks to complete…
              </div>
            )}
          </div>

          {status === "awaiting_approval" && interruptPayload && (
            <ApprovalPanel payload={interruptPayload} onRespond={respond} />
          )}

          {decision && (
            <div className="neu-raised rounded-2xl p-4">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                Decision
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={decision.decision === "approve" ? "pass" : "fail"} size="sm" />
                <span className="text-sm">
                  by <strong>{decision.reviewer_id ?? "system"}</strong>
                </span>
              </div>
              {decision.comment && (
                <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
                  {decision.comment}
                </p>
              )}
            </div>
          )}

          {(status === "completed" || status === "rejected" || status === "rolled_back") && (
            <div className="neu-raised rounded-2xl p-4 text-center">
              <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                Final status
              </div>
              <div className="mt-1">
                <StatusBadge status={status as never} />
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2 lg:col-span-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
              Agent results
            </h2>
            <span className="tabular-nums text-xs" style={{ color: "var(--text-muted)" }}>
              {results.length}/9
            </span>
          </div>
          <div className="space-y-2">
            {results.length === 0 && (
              <div className="neu-inset rounded-2xl p-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                Agents haven't reported in yet…
              </div>
            )}
            {results.map((r) => (
              <div
                key={r.agent_name}
                ref={(el) => {
                  cardRefs.current[r.agent_name] = el;
                }}
                className="rounded-2xl transition-shadow"
                style={selectedAgent === r.agent_name ? { boxShadow: "0 0 0 2px var(--series-1)", borderRadius: 16 } : undefined}
              >
                <AgentResultCard result={r} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
