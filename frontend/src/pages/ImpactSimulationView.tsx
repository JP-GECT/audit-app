import { useEffect, useMemo, useState } from "react";
import ReactFlow, { Background, BackgroundVariant, Handle, MarkerType, Position, type Edge, type Node, type NodeProps } from "reactflow";
import "reactflow/dist/style.css";
import { getTopology, type Topology } from "../lib/api";
import { useRunStore } from "../store/runStore";

type ImpactNodeData = { label: string; role: "root" | "downstream" | "other" };

function ImpactNode({ data }: NodeProps<ImpactNodeData>) {
  const ringColor = { root: "var(--series-1)", downstream: "var(--status-warning)", other: "var(--border-strong)" }[data.role];

  return (
    <div
      className="rounded-xl px-3 py-2 text-center text-sm font-medium"
      style={{
        background: "var(--neu-bg)",
        boxShadow: `0 0 0 1.5px color-mix(in oklab, ${ringColor} 70%, transparent), 3px 3px 6px var(--neu-dark), -3px -3px 6px var(--neu-light)`,
        minWidth: 110,
        opacity: data.role === "other" ? 0.55 : 1,
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      {data.label}
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
}

const nodeTypes = { impactNode: ImpactNode };

function bfsDownstream(topology: Topology, root: string): Set<string> {
  const adjacency = new Map<string, string[]>();
  topology.edges.forEach((e) => {
    if (!adjacency.has(e.source)) adjacency.set(e.source, []);
    adjacency.get(e.source)!.push(e.target);
  });

  const visited = new Set<string>();
  const queue = [root];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const next of adjacency.get(cur) ?? []) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }
  return visited;
}

function bfsLevels(topology: Topology, root: string): Map<string, number> {
  const adjacency = new Map<string, string[]>();
  topology.edges.forEach((e) => {
    if (!adjacency.has(e.source)) adjacency.set(e.source, []);
    adjacency.get(e.source)!.push(e.target);
  });
  const levels = new Map<string, number>([[root, 0]]);
  const queue = [root];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    const depth = levels.get(cur)!;
    for (const next of adjacency.get(cur) ?? []) {
      if (!levels.has(next)) {
        levels.set(next, depth + 1);
        queue.push(next);
      }
    }
  }
  topology.nodes.forEach((n) => {
    if (!levels.has(n)) levels.set(n, -1);
  });
  return levels;
}

export default function ImpactSimulationView() {
  const request = useRunStore((s) => s.request);
  const results = useRunStore((s) => s.results);
  const [topology, setTopology] = useState<Topology | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getTopology()
      .then(setTopology)
      .catch((err) => setError(String(err)));
  }, []);

  const blastResult = results.find((r) => r.agent_name === "blast_radius_sim");
  const deviceId = request?.device.device_id;

  const { nodes, edges, inTopology } = useMemo(() => {
    if (!topology || !deviceId) return { nodes: [], edges: [], inTopology: false };
    if (!topology.nodes.includes(deviceId)) return { nodes: [], edges: [], inTopology: false };

    const downstream = bfsDownstream(topology, deviceId);
    const levels = bfsLevels(topology, deviceId);
    const byLevel = new Map<number, string[]>();
    topology.nodes.forEach((n) => {
      const lvl = levels.get(n) ?? -1;
      if (!byLevel.has(lvl)) byLevel.set(lvl, []);
      byLevel.get(lvl)!.push(n);
    });

    const nodes: Node<ImpactNodeData>[] = [];
    [...byLevel.entries()]
      .sort(([a], [b]) => a - b)
      .forEach(([lvl, ids]) => {
        const y = lvl < 0 ? 320 : lvl * 110;
        ids.forEach((id, i) => {
          const x = i * 150 - ((ids.length - 1) * 150) / 2 + 400;
          nodes.push({
            id,
            type: "impactNode",
            position: { x, y },
            data: { label: id, role: id === deviceId ? "root" : downstream.has(id) ? "downstream" : "other" },
            draggable: false,
          });
        });
      });

    const edges: Edge[] = topology.edges.map((e) => ({
      id: `${e.source}-${e.target}`,
      source: e.source,
      target: e.target,
      label: e.type,
      labelStyle: { fill: "var(--text-muted)", fontSize: 10 },
      labelBgStyle: { fill: "var(--neu-bg)" },
      labelBgPadding: [4, 2] as [number, number],
      labelBgBorderRadius: 4,
      style: { stroke: downstream.has(e.target) || e.source === deviceId ? "var(--status-warning)" : "var(--border-strong)" },
      markerEnd: { type: MarkerType.ArrowClosed, color: "var(--border-strong)" },
    }));

    return { nodes, edges, inTopology: true };
  }, [topology, deviceId]);

  if (error) return <div style={{ color: "var(--status-critical)" }}>{error}</div>;
  if (!topology || !request) return <div style={{ color: "var(--text-muted)" }}>Loading topology…</div>;

  return (
    <div className="animate-fade-slide-in space-y-4">
      {blastResult && (
        <div className="neu-raised rounded-2xl p-4">
          <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
            Blast radius assessment
          </div>
          <p className="mt-1 text-sm">{blastResult.summary}</p>
        </div>
      )}

      {!inTopology ? (
        <div className="neu-inset rounded-2xl p-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
          Device <span className="font-mono">{deviceId}</span> is not part of the modeled topology graph — no
          downstream dependency data available.
        </div>
      ) : (
        <>
          <div className="flex items-center gap-4 text-xs" style={{ color: "var(--text-secondary)" }}>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: "var(--series-1)" }} /> This device
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: "var(--status-warning)" }} /> Downstream / affected
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full opacity-50" style={{ background: "var(--border-strong)" }} /> Unaffected
            </span>
          </div>
          <div className="neu-inset-lg" style={{ height: 420, borderRadius: 20 }}>
            <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView fitViewOptions={{ padding: 0.3 }} nodesDraggable={false} proOptions={{ hideAttribution: true }}>
              <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="var(--gridline)" />
            </ReactFlow>
          </div>
        </>
      )}
    </div>
  );
}
