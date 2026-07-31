import { useEffect } from "react";
import { NavLink, Outlet, useParams } from "react-router-dom";
import StatusBadge from "../components/StatusBadge";
import { useRunStore } from "../store/runStore";

const tabClass = "rounded-xl px-4 py-2 text-sm font-medium transition-all";

export default function RunDetailLayout() {
  const { runId } = useParams<{ runId: string }>();
  const hydrate = useRunStore((s) => s.hydrate);
  const status = useRunStore((s) => s.status);
  const request = useRunStore((s) => s.request);
  const results = useRunStore((s) => s.results);
  const loading = useRunStore((s) => s.loading);

  useEffect(() => {
    if (runId) hydrate(runId);
  }, [runId, hydrate]);

  if (loading && results.length === 0) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-16 text-center" style={{ color: "var(--text-muted)" }}>
        Loading run…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-mono text-sm" style={{ color: "var(--text-muted)" }}>
              {runId}
            </h1>
            <StatusBadge status={status as never} />
          </div>
          {request && (
            <p className="mt-1 text-lg font-semibold">
              {request.device.device_id}{" "}
              <span className="font-normal" style={{ color: "var(--text-secondary)" }}>
                — {request.device.model} · {request.device.role} · {request.change_type}
              </span>
            </p>
          )}
        </div>
      </div>

      <nav className="neu-inset mt-4 inline-flex gap-1 rounded-2xl p-1.5">
        <NavLink
          to={`/runs/${runId}`}
          end
          className={({ isActive }) => `${tabClass} ${isActive ? "neu-raised-sm" : ""}`}
          style={({ isActive }) => ({
            color: isActive ? "var(--series-1)" : "var(--text-secondary)",
          })}
        >
          Overview
        </NavLink>
        <NavLink
          to={`/runs/${runId}/impact`}
          className={({ isActive }) => `${tabClass} ${isActive ? "neu-raised-sm" : ""}`}
          style={({ isActive }) => ({
            color: isActive ? "var(--series-1)" : "var(--text-secondary)",
          })}
        >
          Impact Simulation
        </NavLink>
        <NavLink
          to={`/runs/${runId}/compliance`}
          className={({ isActive }) => `${tabClass} ${isActive ? "neu-raised-sm" : ""}`}
          style={({ isActive }) => ({
            color: isActive ? "var(--series-1)" : "var(--text-secondary)",
          })}
        >
          Compliance Diff
        </NavLink>
      </nav>

      <div className="py-6">
        <Outlet />
      </div>
    </div>
  );
}
