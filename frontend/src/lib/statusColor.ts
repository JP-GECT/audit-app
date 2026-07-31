const STATUS_COLORS: Record<string, string> = {
  pass: "var(--status-good)",
  completed: "var(--status-good)",
  warning: "var(--status-warning)",
  awaiting_approval: "var(--status-warning)",
  insufficient_data: "var(--status-serious)",
  rolled_back: "var(--status-serious)",
  fail: "var(--status-critical)",
  rejected: "var(--status-critical)",
  running: "var(--series-1)",
};

export function statusColor(status: string): string {
  return STATUS_COLORS[status] ?? "var(--text-muted)";
}
