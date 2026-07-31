import { useEffect, useState } from "react";
import ReactDiffViewer from "react-diff-viewer-continued";
import { getGoldenConfig } from "../lib/api";
import { useTheme } from "../hooks/useTheme";
import { useRunStore } from "../store/runStore";

export default function ComplianceDiffView() {
  const request = useRunStore((s) => s.request);
  const results = useRunStore((s) => s.results);
  const theme = useTheme();
  const [golden, setGolden] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const role = request?.device.role;

  useEffect(() => {
    if (!role) return;
    getGoldenConfig(role)
      .then((res) => setGolden(res.content))
      .catch((err) => setError(String(err)));
  }, [role]);

  const diffResult = results.find((r) => r.agent_name === "golden_config_diff");

  if (!request) return <div style={{ color: "var(--text-muted)" }}>Loading…</div>;

  return (
    <div className="animate-fade-slide-in space-y-4">
      {diffResult && (
        <div className="neu-raised rounded-2xl p-4">
          <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
            Config compliance assessment
          </div>
          <p className="mt-1 text-sm">{diffResult.summary}</p>
        </div>
      )}

      {error && <div style={{ color: "var(--status-critical)" }}>{error}</div>}

      {golden !== null && golden.trimEnd() === request.proposed_config.trimEnd() && (
        <div className="neu-inset flex items-center gap-2 rounded-2xl p-6 text-sm" style={{ color: "var(--text-secondary)" }}>
          <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="var(--status-good)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 13l4 4L19 7" />
          </svg>
          Proposed config is byte-for-byte identical to the golden template — no diff to show.
        </div>
      )}

      {golden !== null && golden.trimEnd() !== request.proposed_config.trimEnd() && (
        <div className="neu-raised overflow-hidden rounded-2xl">
          <div className="grid grid-cols-2 text-xs font-semibold uppercase tracking-wide">
            <div className="px-4 py-2" style={{ color: "var(--text-muted)" }}>
              Golden template ({role})
            </div>
            <div className="px-4 py-2" style={{ color: "var(--text-muted)" }}>
              Proposed config
            </div>
          </div>
          <div className="text-sm">
            <ReactDiffViewer
              oldValue={golden.trimEnd()}
              newValue={request.proposed_config.trimEnd()}
              splitView
              useDarkTheme={theme === "dark"}
              leftTitle={undefined}
              rightTitle={undefined}
              styles={{
                variables: {
                  light: {
                    diffViewerBackground: "var(--surface-2)",
                    diffViewerColor: "var(--text-primary)",
                    addedBackground: "color-mix(in oklab, var(--status-good) 16%, var(--surface-2))",
                    addedColor: "var(--text-primary)",
                    removedBackground: "color-mix(in oklab, var(--status-critical) 14%, var(--surface-2))",
                    removedColor: "var(--text-primary)",
                    wordAddedBackground: "color-mix(in oklab, var(--status-good) 35%, transparent)",
                    wordRemovedBackground: "color-mix(in oklab, var(--status-critical) 35%, transparent)",
                    gutterBackground: "var(--surface-1)",
                    gutterColor: "var(--text-muted)",
                    codeFoldGutterBackground: "var(--surface-1)",
                    codeFoldBackground: "var(--surface-1)",
                  },
                },
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
