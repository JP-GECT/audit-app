import { useState } from "react";
import { statusColor } from "../lib/statusColor";
import type { AgentResult } from "../types";
import StatusBadge from "./StatusBadge";

export default function AgentResultCard({ result }: { result: AgentResult }) {
  const [open, setOpen] = useState(false);
  const hasDetail = result.evidence.length > 0 || result.citations.length > 0;

  return (
    <div className="neu-raised animate-fade-slide-in overflow-hidden rounded-2xl">
      <button
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
        onClick={() => hasDetail && setOpen((v) => !v)}
      >
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: statusColor(result.status) }} />
        <span className="flex-1 font-medium">{result.agent_name.replace(/_/g, " ")}</span>
        <span className="tabular-nums text-xs" style={{ color: "var(--text-muted)" }}>
          {result.duration_ms}ms
        </span>
        <span className="tabular-nums text-xs" style={{ color: "var(--text-muted)" }}>
          {Math.round(result.confidence * 100)}%
        </span>
        <StatusBadge status={result.status} size="sm" />
        {hasDetail && (
          <svg
            viewBox="0 0 24 24"
            width={14}
            height={14}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className="shrink-0 transition-transform"
            style={{ color: "var(--text-muted)", transform: open ? "rotate(180deg)" : "none" }}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        )}
      </button>
      <p className="px-4 pb-3 text-sm" style={{ color: "var(--text-secondary)" }}>
        {result.summary}
      </p>

      {open && hasDetail && (
        <div className="neu-inset mx-3 mb-3 rounded-xl px-4 py-3 text-sm">
          {result.evidence.length > 0 && (
            <div className="mb-2">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                Evidence
              </div>
              <ul className="space-y-1 font-mono text-xs" style={{ color: "var(--text-secondary)" }}>
                {result.evidence.map((e, i) => (
                  <li key={i} className="whitespace-pre-wrap break-words">
                    {e}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.citations.length > 0 && (
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                Citations
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[...new Set(result.citations)].map((c, i) => (
                  <span
                    key={i}
                    className="neu-chip rounded-md px-1.5 py-0.5 text-xs"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
