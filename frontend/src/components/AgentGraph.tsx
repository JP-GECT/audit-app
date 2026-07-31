import { useMemo } from "react";
import ReactFlow, { Background, BackgroundVariant, Handle, Position, type Edge, type Node, type NodeProps } from "reactflow";
import "reactflow/dist/style.css";
import { statusColor } from "../lib/statusColor";
import type { AgentResult } from "../types";

const LEAD_ORDER = ["identity_trust", "reachability", "template_compat", "impact_compliance"];
const LEAD_CHILDREN: Record<string, string[]> = {
  identity_trust: ["cert_validation", "nac_posture", "device_fingerprint"],
  reachability: ["dns_check", "ntp_check", "mgmt_plane_check"],
  template_compat: [],
  impact_compliance: ["blast_radius_sim", "golden_config_diff"],
};
// template_compat has no separate Tier-2 child - its own AgentResult is emitted
// under the "template_compat" name, so the lead node itself carries that status.
const STATUS_LOOKUP_NAMES: Record<string, string[]> = {
  identity_trust: LEAD_CHILDREN.identity_trust,
  reachability: LEAD_CHILDREN.reachability,
  template_compat: ["template_compat"],
  impact_compliance: LEAD_CHILDREN.impact_compliance,
};

const STATUS_RANK: Record<string, number> = { fail: 4, insufficient_data: 3, warning: 2, pass: 1 };

function aggregateStatus(results: AgentResult[], names: string[]): string | null {
  const relevant = results.filter((r) => names.includes(r.agent_name));
  if (relevant.length === 0) return null;
  return relevant.reduce((worst, r) => (STATUS_RANK[r.status] > STATUS_RANK[worst] ? r.status : worst), relevant[0].status);
}

type GraphNodeData = {
  label: string;
  status: string | null;
  kind: "supervisor" | "lead" | "worker";
  selected: boolean;
};

function GraphNode({ data }: NodeProps<GraphNodeData>) {
  const color = data.status ? statusColor(data.status) : "var(--border-strong)";
  const isPending = !data.status && data.kind !== "supervisor";
  const baseShadow = data.kind === "supervisor" ? "5px 5px 10px var(--neu-dark), -5px -5px 10px var(--neu-light)" : "3px 3px 6px var(--neu-dark), -3px -3px 6px var(--neu-light)";
  const selectedShadow = "inset 2px 2px 5px var(--neu-dark), inset -2px -2px 5px var(--neu-light)";
  return (
    <div
      className={`rounded-xl px-3 py-2 text-center transition-all ${data.kind === "supervisor" ? "font-semibold" : "text-sm"}`}
      style={{
        background: "var(--neu-bg)",
        color: "var(--text-primary)",
        minWidth: data.kind === "supervisor" ? 160 : 128,
        boxShadow: `0 0 0 1.5px color-mix(in oklab, ${color} 70%, transparent), ${data.selected ? selectedShadow : baseShadow}`,
        opacity: isPending ? 0.55 : 1,
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: "var(--border-strong)", opacity: 0 }} />
      <div className="flex items-center justify-center gap-1.5">
        {isPending ? (
          <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: "var(--text-muted)" }} />
        ) : (
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
        )}
        <span className="whitespace-nowrap">{data.label}</span>
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: "var(--border-strong)", opacity: 0 }} />
    </div>
  );
}

const nodeTypes = { statusNode: GraphNode };

export default function AgentGraph({
  results,
  selectedAgent,
  onSelectAgent,
}: {
  results: AgentResult[];
  selectedAgent: string | null;
  onSelectAgent: (name: string) => void;
}) {
  const { nodes, edges } = useMemo(() => {
    const nodes: Node<GraphNodeData>[] = [];
    const edges: Edge[] = [];

    const SLOT_WIDTH = 172;
    const GROUP_GAP = 40;
    let cursor = 0;
    const leadX: Record<string, number> = {};

    LEAD_ORDER.forEach((leadId) => {
      const children = LEAD_CHILDREN[leadId];
      if (children.length === 0) {
        leadX[leadId] = cursor;
        cursor += SLOT_WIDTH;
      } else {
        const groupStart = cursor;
        children.forEach((childName) => {
          const found = results.find((r) => r.agent_name === childName);
          nodes.push({
            id: childName,
            type: "statusNode",
            position: { x: cursor, y: 230 },
            data: { label: childName.replace(/_/g, " "), status: found?.status ?? null, kind: "worker", selected: selectedAgent === childName },
            draggable: false,
          });
          edges.push({ id: `${leadId}-${childName}`, source: leadId, target: childName, style: { stroke: "var(--border-strong)" } });
          cursor += SLOT_WIDTH;
        });
        leadX[leadId] = (groupStart + (cursor - SLOT_WIDTH)) / 2;
      }
      cursor += GROUP_GAP;
    });

    LEAD_ORDER.forEach((leadId) => {
      nodes.push({
        id: leadId,
        type: "statusNode",
        position: { x: leadX[leadId], y: 110 },
        data: {
          label: leadId.replace(/_/g, " "),
          status: aggregateStatus(results, STATUS_LOOKUP_NAMES[leadId]),
          kind: "lead",
          selected: leadId === "template_compat" && selectedAgent === "template_compat",
        },
        draggable: false,
      });
      edges.push({ id: `supervisor-${leadId}`, source: "supervisor", target: leadId, animated: results.length === 0, style: { stroke: "var(--border-strong)" } });
    });

    const supervisorX = (Math.min(...Object.values(leadX)) + Math.max(...Object.values(leadX))) / 2;
    nodes.unshift({
      id: "supervisor",
      type: "statusNode",
      position: { x: supervisorX, y: 0 },
      data: { label: "Supervisor", status: results.length > 0 ? "pass" : null, kind: "supervisor", selected: false },
      draggable: false,
    });

    return { nodes, edges };
  }, [results, selectedAgent]);

  return (
    <div className="neu-inset-lg" style={{ height: 360, borderRadius: 20 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        proOptions={{ hideAttribution: true }}
        onNodeClick={(_, node) => {
          if (node.data.kind === "worker" || node.id === "template_compat") onSelectAgent(node.id);
        }}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="var(--gridline)" />
      </ReactFlow>
    </div>
  );
}
