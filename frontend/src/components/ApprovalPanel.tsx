import { useState } from "react";
import type { RunState } from "../types";

export default function ApprovalPanel({
  payload,
  onRespond,
}: {
  payload: NonNullable<RunState["interrupt_payload"]>;
  onRespond: (decision: "approve" | "reject", reviewerId: string, comment: string) => void;
}) {
  const [reviewerId, setReviewerId] = useState("reviewer-1");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState<"approve" | "reject" | null>(null);

  function respond(decision: "approve" | "reject") {
    setSubmitting(decision);
    onRespond(decision, reviewerId, comment);
  }

  return (
    <div
      className="neu-raised animate-fade-slide-in overflow-hidden rounded-2xl"
      style={{ boxShadow: "0 0 0 2px var(--status-warning), 7px 7px 14px var(--neu-dark), -7px -7px 14px var(--neu-light)" }}
    >
      <div className="flex items-center gap-2 px-5 py-3">
        <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="var(--status-warning)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 9v4m0 4h.01M10.29 3.86l-8.18 14.18A2 2 0 0 0 4 21h16a2 2 0 0 0 1.89-2.96L13.71 3.86a2 2 0 0 0-3.42 0Z" />
        </svg>
        <h2 className="text-base font-semibold">Awaiting Human Approval</h2>
      </div>

      <div className="space-y-3 px-5 py-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              Reason
            </div>
            <div className="text-sm">{payload.reason}</div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              Recommendation
            </div>
            <div className="text-sm capitalize">{payload.recommendation}</div>
          </div>
        </div>

        {payload.evidence.length > 0 && (
          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              Evidence considered
            </div>
            <ul className="space-y-0.5 text-sm" style={{ color: "var(--text-secondary)" }}>
              {payload.evidence.slice(0, 6).map((e, i) => (
                <li key={i}>• {e}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              Reviewer
            </span>
            <input
              value={reviewerId}
              onChange={(e) => setReviewerId(e.target.value)}
              className="neu-inset w-full rounded-lg px-2.5 py-1.5 text-sm outline-none"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              Comment
            </span>
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="optional"
              className="neu-inset w-full rounded-lg px-2.5 py-1.5 text-sm outline-none"
            />
          </label>
        </div>

        <div className="flex gap-3 pt-1">
          <button
            onClick={() => respond("approve")}
            disabled={submitting !== null}
            className="neu-btn flex-1 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed"
            style={{ background: "var(--status-good)" }}
          >
            {submitting === "approve" ? "Approving…" : "Approve"}
          </button>
          <button
            onClick={() => respond("reject")}
            disabled={submitting !== null}
            className="neu-btn flex-1 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed"
            style={{ background: "var(--status-critical)" }}
          >
            {submitting === "reject" ? "Rejecting…" : "Reject"}
          </button>
        </div>
      </div>
    </div>
  );
}
