import type { AgentResult } from "../types";

type Status = AgentResult["status"] | "running" | "awaiting_approval" | "completed" | "rejected" | "rolled_back";

const STATUS_MAP: Record<Status, { color: string; label: string; icon: string }> = {
  pass: { color: "var(--status-good)", label: "Pass", icon: "M5 13l4 4L19 7" },
  completed: { color: "var(--status-good)", label: "Completed", icon: "M5 13l4 4L19 7" },
  warning: { color: "var(--status-warning)", label: "Warning", icon: "M12 9v4m0 4h.01M10.29 3.86l-8.18 14.18A2 2 0 0 0 4 21h16a2 2 0 0 0 1.89-2.96L13.71 3.86a2 2 0 0 0-3.42 0Z" },
  awaiting_approval: { color: "var(--status-warning)", label: "Awaiting Approval", icon: "M12 9v4m0 4h.01M10.29 3.86l-8.18 14.18A2 2 0 0 0 4 21h16a2 2 0 0 0 1.89-2.96L13.71 3.86a2 2 0 0 0-3.42 0Z" },
  insufficient_data: { color: "var(--status-serious)", label: "Insufficient Data", icon: "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3m.09 4h.01M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" },
  rolled_back: { color: "var(--status-serious)", label: "Rolled Back", icon: "M3 12a9 9 0 1 0 9-9M3 12V6m0 6h6" },
  fail: { color: "var(--status-critical)", label: "Fail", icon: "M18 6 6 18M6 6l12 12" },
  rejected: { color: "var(--status-critical)", label: "Rejected", icon: "M18 6 6 18M6 6l12 12" },
  running: { color: "var(--series-1)", label: "Running", icon: "" },
};

export default function StatusBadge({ status, size = "md" }: { status: Status; size?: "sm" | "md" }) {
  const meta = STATUS_MAP[status] ?? STATUS_MAP.running;
  const isRunning = status === "running";
  const px = size === "sm" ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-1 text-xs";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${px}`}
      style={{
        color: meta.color,
        background: `color-mix(in oklab, ${meta.color} 15%, var(--neu-bg))`,
        boxShadow: "2px 2px 4px var(--neu-dark), -2px -2px 4px var(--neu-light)",
      }}
    >
      {isRunning ? (
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ background: meta.color }} />
          <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: meta.color }} />
        </span>
      ) : (
        <svg viewBox="0 0 24 24" width={size === "sm" ? 11 : 13} height={size === "sm" ? 11 : 13} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path d={meta.icon} />
        </svg>
      )}
      {meta.label}
    </span>
  );
}
