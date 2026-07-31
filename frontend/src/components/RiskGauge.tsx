import type { RiskAssessment } from "../types";

const THRESHOLD = 0.6;

function zoneColor(score: number, hardFail: boolean): string {
  if (hardFail || score >= THRESHOLD) return "var(--status-critical)";
  if (score >= THRESHOLD * 0.5) return "var(--status-warning)";
  return "var(--status-good)";
}

export default function RiskGauge({ risk }: { risk: RiskAssessment }) {
  const pct = Math.min(100, Math.max(0, risk.risk_score * 100));
  const color = zoneColor(risk.risk_score, risk.hard_fail);

  return (
    <div className="animate-fade-slide-in">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
          Risk score
        </span>
        <span className="tabular-nums text-2xl font-semibold" style={{ color }}>
          {risk.risk_score.toFixed(3)}
        </span>
      </div>

      <div className="neu-inset relative h-3 w-full overflow-hidden rounded-full p-0.5">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${pct}%`, background: color, boxShadow: `0 0 6px color-mix(in oklab, ${color} 60%, transparent)` }}
        />
        <div
          className="absolute top-0.5 bottom-0.5 w-px"
          style={{ left: `${THRESHOLD * 100}%`, background: "var(--border-strong)" }}
          title={`Human-review threshold: ${THRESHOLD}`}
        />
      </div>

      <div className="mt-2 flex items-center justify-between text-xs" style={{ color: "var(--text-muted)" }}>
        <span>0.0</span>
        <span>threshold {THRESHOLD}</span>
        <span>1.0</span>
      </div>

      {risk.hard_fail && (
        <div
          className="neu-raised-sm mt-2 inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold"
          style={{ color: "var(--status-critical)" }}
        >
          Hard fail
        </div>
      )}

      {risk.contributing_factors.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          {risk.contributing_factors.map((f, i) => (
            <li key={i} className="flex items-start gap-1.5">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full" style={{ background: "var(--text-muted)" }} />
              {f}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
