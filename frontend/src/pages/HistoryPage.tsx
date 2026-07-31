import { useEffect, useState } from "react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Link } from "react-router-dom";
import { getMetrics, listRuns, type Metrics } from "../lib/api";
import StatusBadge from "../components/StatusBadge";
import { statusColor } from "../lib/statusColor";
import type { RunState } from "../types";

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="neu-raised rounded-2xl p-4">
      <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
        {label}
      </div>
      <div className="tabular-nums mt-1 text-2xl font-semibold">{value}</div>
      {sub && (
        <div className="text-xs" style={{ color: "var(--text-muted)" }}>
          {sub}
        </div>
      )}
    </div>
  );
}

export default function HistoryPage() {
  const [runs, setRuns] = useState<RunState[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listRuns(), getMetrics()])
      .then(([r, m]) => {
        setRuns([...r].reverse());
        setMetrics(m);
      })
      .catch((err) => setError(String(err)));
  }, []);

  const statusCounts = ["running", "awaiting_approval", "completed", "rejected", "rolled_back"]
    .map((status) => ({ status, count: runs.filter((r) => r.status === status).length }))
    .filter((d) => d.count > 0);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Run history</h1>
      <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
        Every validation run this session, with aggregate metrics.
      </p>

      {error && <div className="mt-4" style={{ color: "var(--status-critical)" }}>{error}</div>}

      {metrics && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <StatTile label="Total runs" value={String(metrics.total_runs)} />
          <StatTile label="Success rate" value={`${Math.round(metrics.success_rate * 100)}%`} />
          <StatTile label="HITL rate" value={`${Math.round(metrics.hitl_rate * 100)}%`} />
          <StatTile label="Rollbacks" value={String(metrics.rollback_count)} />
          <StatTile label="Avg cycle time" value={`${(metrics.avg_cycle_time_ms / 1000).toFixed(2)}s`} />
        </div>
      )}

      {statusCounts.length > 0 && (
        <div className="neu-raised mt-6 rounded-2xl p-4">
          <div className="mb-2 text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
            Runs by outcome
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={statusCounts} layout="vertical" margin={{ left: 8, right: 16 }}>
              <XAxis type="number" allowDecimals={false} stroke="var(--text-muted)" fontSize={12} />
              <YAxis
                type="category"
                dataKey="status"
                width={120}
                stroke="var(--text-muted)"
                fontSize={12}
                tickFormatter={(v: string) => v.replace(/_/g, " ")}
              />
              <Tooltip
                cursor={{ fill: "color-mix(in oklab, var(--neu-dark) 25%, transparent)" }}
                contentStyle={{ background: "var(--neu-bg)", border: "none", borderRadius: 12, fontSize: 12, boxShadow: "4px 4px 9px var(--neu-dark), -4px -4px 9px var(--neu-light)" }}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={22}>
                {statusCounts.map((d) => (
                  <Cell key={d.status} fill={statusColor(d.status)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="neu-raised mt-6 overflow-hidden rounded-2xl">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ color: "var(--text-muted)" }}>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide">Run</th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide">Device</th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide">Status</th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide">Risk</th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide">Decision</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.run_id} className="transition-colors hover:brightness-95" style={{ boxShadow: "inset 0 1px 0 var(--neu-dark)" }}>
                <td className="px-4 py-2">
                  <Link to={`/runs/${r.run_id}`} className="font-mono text-xs" style={{ color: "var(--series-1)" }}>
                    {r.run_id.slice(0, 8)}
                  </Link>
                </td>
                <td className="px-4 py-2">{r.request?.device.device_id ?? "—"}</td>
                <td className="px-4 py-2">
                  <StatusBadge status={r.status as never} size="sm" />
                </td>
                <td className="tabular-nums px-4 py-2">{r.risk ? r.risk.risk_score.toFixed(3) : "—"}</td>
                <td className="px-4 py-2">{r.decision?.decision ?? "—"}</td>
              </tr>
            ))}
            {runs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center" style={{ color: "var(--text-muted)" }}>
                  No runs yet — submit a request to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
