"use client";

import { useCallback, useRef, useState, DragEvent } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  BackgroundVariant,
  Connection,
  Node,
  Edge,
  NodeProps,
  Handle,
  Position,
  useReactFlow,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useRouter } from "next/navigation";

// ─── Public types ─────────────────────────────────────────────────────────────

export interface StepLibraryItem {
  id: string;
  label: string;
  processTemplate: string;
  order: number;
}

export interface ApplicationDef {
  id: string;
  name: string;
  color: string;
  description: string;
  processTemplates: string[];
}

export interface ActorDef {
  id: string;
  name: string;
  color: string;
  description: string;
  type: string;
}

// ─── Node data shapes ─────────────────────────────────────────────────────────

interface AssignedItem {
  name: string;
  color: string;
}

interface TaskData {
  label: string;
  actors: AssignedItem[];
  systems: AssignedItem[];
  order: number;
  [key: string]: unknown;
}

interface GatewayData {
  label: string;
  [key: string]: unknown;
}

// ─── BPMN: Start Event ────────────────────────────────────────────────────────

function StartEventNode({ selected }: NodeProps) {
  return (
    <div style={{ position: "relative", width: 48, height: 48 }}>
      <Handle type="source" position={Position.Right} style={handleStyle("#26BC71")} />
      <div
        style={{
          width: 48, height: 48, borderRadius: "50%",
          border: "2px solid #26BC71",
          background: selected ? "rgba(38,188,113,0.18)" : "rgba(38,188,113,0.08)",
          boxShadow: selected ? "0 0 0 3px rgba(38,188,113,0.25)" : undefined,
          display: "flex", alignItems: "center", justifyContent: "center", cursor: "grab",
        }}
      >
        <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#26BC71" }} />
      </div>
      <div style={eventLabelStyle("#26BC71")}>Start</div>
    </div>
  );
}

// ─── BPMN: End Event ──────────────────────────────────────────────────────────

function EndEventNode({ selected }: NodeProps) {
  return (
    <div style={{ position: "relative", width: 48, height: 48 }}>
      <Handle type="target" position={Position.Left} style={handleStyle("#EF4444")} />
      <div
        style={{
          width: 48, height: 48, borderRadius: "50%",
          border: "4px solid #EF4444",
          background: selected ? "rgba(239,68,68,0.18)" : "rgba(239,68,68,0.08)",
          boxShadow: selected ? "0 0 0 3px rgba(239,68,68,0.25)" : undefined,
          display: "flex", alignItems: "center", justifyContent: "center", cursor: "grab",
        }}
      >
        <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#EF4444" }} />
      </div>
      <div style={eventLabelStyle("#EF4444")}>End</div>
    </div>
  );
}

// ─── BPMN: Task Node ──────────────────────────────────────────────────────────

function TaskNode({ data, selected }: NodeProps) {
  const d = data as TaskData;
  const actors: AssignedItem[] = d.actors ?? [];
  const systems: AssignedItem[] = d.systems ?? [];

  return (
    <div
      style={{
        background: selected ? "#112d5c" : "#0d2249",
        border: `2px solid ${selected ? "#3366FF" : "#1a3668"}`,
        borderRadius: 10,
        minWidth: 210,
        maxWidth: 260,
        cursor: "grab",
        boxShadow: selected ? "0 0 0 3px rgba(51,102,255,0.3)" : "0 4px 16px rgba(0,0,0,0.4)",
        transition: "all 0.15s",
        overflow: "hidden",
      }}
    >
      <Handle type="target" position={Position.Left} style={handleStyle("#3366FF")} />

      {/* Actor strip — multiple actors */}
      {actors.length > 0 ? (
        <div
          style={{
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            padding: "5px 10px",
            display: "flex",
            flexWrap: "wrap",
            gap: 4,
          }}
        >
          {actors.map((a) => (
            <span
              key={a.name}
              style={{
                background: a.color + "22",
                border: `1px solid ${a.color}44`,
                borderRadius: 4,
                padding: "1px 6px",
                fontSize: 9,
                fontWeight: 700,
                color: a.color,
                display: "flex",
                alignItems: "center",
                gap: 3,
              }}
            >
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: a.color, display: "inline-block" }} />
              {a.name}
            </span>
          ))}
        </div>
      ) : (
        <div style={{ borderBottom: "1px dashed rgba(255,255,255,0.07)", padding: "4px 10px", fontSize: 9, color: "rgba(255,255,255,0.2)" }}>
          No actor assigned
        </div>
      )}

      {/* Body */}
      <div style={{ padding: "10px 12px" }}>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 3 }}>
          Task {d.order}
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", lineHeight: 1.3 }}>{d.label}</div>

        {/* System badges — multiple systems */}
        {systems.length > 0 ? (
          <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 4 }}>
            {systems.map((s) => (
              <span
                key={s.name}
                style={{
                  background: s.color + "22",
                  border: `1px solid ${s.color}55`,
                  borderRadius: 5,
                  padding: "2px 7px",
                  fontSize: 10,
                  fontWeight: 700,
                  color: s.color,
                }}
              >
                {s.name}
              </span>
            ))}
          </div>
        ) : (
          <div style={{ marginTop: 8, border: "1px dashed rgba(255,255,255,0.13)", borderRadius: 5, padding: "3px 8px", fontSize: 10, color: "rgba(255,255,255,0.22)", display: "inline-block" }}>
            No system
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Right} style={handleStyle("#3366FF")} />
    </div>
  );
}

// ─── BPMN: XOR Gateway ───────────────────────────────────────────────────────

function XorGatewayNode({ data, selected }: NodeProps) {
  const d = data as GatewayData;
  return (
    <div style={{ position: "relative", width: 52, height: 52 }}>
      <Handle type="target" position={Position.Left} style={{ ...handleStyle("#FFAC09"), top: "50%", left: 0 }} />
      <Handle type="source" position={Position.Right} style={{ ...handleStyle("#FFAC09"), top: "50%", right: 0 }} />
      <Handle type="source" id="bottom" position={Position.Bottom} style={{ ...handleStyle("#FFAC09"), bottom: 0, left: "50%" }} />
      <svg width={52} height={52} viewBox="0 0 52 52" style={{ display: "block", filter: selected ? "drop-shadow(0 0 6px rgba(255,172,9,0.5))" : undefined }}>
        <polygon points="26,2 50,26 26,50 2,26" fill={selected ? "rgba(255,172,9,0.18)" : "rgba(255,172,9,0.08)"} stroke="#FFAC09" strokeWidth="2" />
        <text x="26" y="33" textAnchor="middle" fontSize="20" fontWeight="700" fill="#FFAC09" style={{ userSelect: "none" }}>×</text>
      </svg>
      <div style={eventLabelStyle("#FFAC09")}>{d.label || "XOR"}</div>
    </div>
  );
}

// ─── BPMN: Parallel Gateway ───────────────────────────────────────────────────

function ParallelGatewayNode({ data, selected }: NodeProps) {
  const d = data as GatewayData;
  return (
    <div style={{ position: "relative", width: 52, height: 52 }}>
      <Handle type="target" position={Position.Left} style={{ ...handleStyle("#06B6D4"), top: "50%", left: 0 }} />
      <Handle type="source" position={Position.Right} style={{ ...handleStyle("#06B6D4"), top: "50%", right: 0 }} />
      <Handle type="source" id="bottom" position={Position.Bottom} style={{ ...handleStyle("#06B6D4"), bottom: 0, left: "50%" }} />
      <svg width={52} height={52} viewBox="0 0 52 52" style={{ display: "block", filter: selected ? "drop-shadow(0 0 6px rgba(6,182,212,0.5))" : undefined }}>
        <polygon points="26,2 50,26 26,50 2,26" fill={selected ? "rgba(6,182,212,0.18)" : "rgba(6,182,212,0.08)"} stroke="#06B6D4" strokeWidth="2" />
        <text x="26" y="33" textAnchor="middle" fontSize="20" fontWeight="700" fill="#06B6D4" style={{ userSelect: "none" }}>+</text>
      </svg>
      <div style={eventLabelStyle("#06B6D4")}>{d.label || "AND"}</div>
    </div>
  );
}

// ─── Shared style helpers ─────────────────────────────────────────────────────

function handleStyle(color: string): React.CSSProperties {
  return { background: color, border: "2px solid #fff", width: 10, height: 10 };
}

function eventLabelStyle(color: string): React.CSSProperties {
  return {
    position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)",
    marginTop: 4, fontSize: 9, fontWeight: 700, color, whiteSpace: "nowrap", pointerEvents: "none",
  };
}

const NODE_TYPES = {
  startEvent: StartEventNode,
  endEvent: EndEventNode,
  task: TaskNode,
  xorGateway: XorGatewayNode,
  parallelGateway: ParallelGatewayNode,
};

// ─── Inner canvas ─────────────────────────────────────────────────────────────

interface FlowCanvasProps {
  engagementId: string;
  processTemplate: string;
  processName: string;
  initialProcessMap: { nodes: Node[]; edges: Edge[] } | null;
  templateSteps: StepLibraryItem[];
  genericSteps: StepLibraryItem[];
  applications: ApplicationDef[];
  actors: ActorDef[];
}

function FlowCanvas({
  engagementId,
  processTemplate: _processTemplate,
  processName,
  initialProcessMap,
  templateSteps,
  genericSteps,
  applications,
  actors,
}: FlowCanvasProps) {
  const router = useRouter();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();
  const nodeIdCounter = useRef(initialProcessMap ? initialProcessMap.nodes.length + 1 : 1);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(initialProcessMap?.nodes ?? []);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialProcessMap?.edges ?? []);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const bpmnEdge = (source: string, target: string): Edge => ({
    id: `e-${source}-${target}`, source, target, type: "smoothstep",
    markerEnd: { type: MarkerType.ArrowClosed, color: "#3366FF", width: 16, height: 16 },
    style: { stroke: "#3366FF", strokeWidth: 2 },
  });

  const onConnect = useCallback(
    (connection: Connection) =>
      setEdges((eds) => addEdge({
        ...connection, type: "smoothstep",
        markerEnd: { type: MarkerType.ArrowClosed, color: "#3366FF", width: 16, height: 16 },
        style: { stroke: "#3366FF", strokeWidth: 2 },
      }, eds)),
    [setEdges]
  );

  const onDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const nodeType = event.dataTransfer.getData("application/node-type");
      const label = event.dataTransfer.getData("application/node-label");
      if (!nodeType) return;
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const id = `node-${nodeIdCounter.current++}`;
      let nodeData: Record<string, unknown>;
      if (nodeType === "task") {
        const taskCount = nodes.filter((n) => n.type === "task").length;
        nodeData = { label: label || "Task", actors: [], systems: [], order: taskCount + 1 };
      } else {
        nodeData = { label: label || nodeType };
      }
      setNodes((nds) => [...nds, { id, type: nodeType, position, data: nodeData }]);
    },
    [screenToFlowPosition, nodes, setNodes]
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => setSelectedNodeId(node.id), []);
  const onPaneClick = useCallback(() => setSelectedNodeId(null), []);

  // Toggle actor on selected task
  const toggleActor = useCallback(
    (actor: ActorDef) => {
      if (!selectedNodeId) return;
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== selectedNodeId) return n;
          const current: AssignedItem[] = (n.data.actors as AssignedItem[]) ?? [];
          const exists = current.some((a) => a.name === actor.name);
          const next = exists
            ? current.filter((a) => a.name !== actor.name)
            : [...current, { name: actor.name, color: actor.color }];
          return { ...n, data: { ...n.data, actors: next } };
        })
      );
    },
    [selectedNodeId, setNodes]
  );

  // Toggle system on selected task
  const toggleSystem = useCallback(
    (app: ApplicationDef) => {
      if (!selectedNodeId) return;
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== selectedNodeId) return n;
          const current: AssignedItem[] = (n.data.systems as AssignedItem[]) ?? [];
          const exists = current.some((s) => s.name === app.name);
          const next = exists
            ? current.filter((s) => s.name !== app.name)
            : [...current, { name: app.name, color: app.color }];
          return { ...n, data: { ...n.data, systems: next } };
        })
      );
    },
    [selectedNodeId, setNodes]
  );

  const addAutoLayout = useCallback(() => {
    if (templateSteps.length === 0) return;
    const base = nodeIdCounter.current;
    const startId = `node-${base}`;
    const taskIds = templateSteps.map((_, i) => `node-${base + 1 + i}`);
    const endId = `node-${base + 1 + templateSteps.length}`;
    nodeIdCounter.current = base + 2 + templateSteps.length;

    const newNodes: Node[] = [
      { id: startId, type: "startEvent", position: { x: 60, y: 200 }, data: { label: "Start" } },
      ...templateSteps.map((step, i) => ({
        id: taskIds[i], type: "task",
        position: { x: 160 + i * 270, y: 176 },
        data: { label: step.label, actors: [], systems: [], order: i + 1 } as TaskData,
      })),
      { id: endId, type: "endEvent", position: { x: 160 + templateSteps.length * 270, y: 200 }, data: { label: "End" } },
    ];
    const allIds = [startId, ...taskIds, endId];
    setNodes(newNodes);
    setEdges(allIds.slice(0, -1).map((id, i) => bpmnEdge(id, allIds[i + 1])));
  }, [templateSteps, setNodes, setEdges]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveMap = useCallback(async () => {
    setSaving(true);
    const taskNodes = nodes.filter((n) => n.type === "task");
    const processMap = {
      nodes, edges,
      summary: {
        nodeCount: nodes.length,
        taskCount: taskNodes.length,
        actors: [...new Set(taskNodes.flatMap((n) => ((n.data as TaskData).actors ?? []).map((a) => a.name)))],
        systems: [...new Set(taskNodes.flatMap((n) => ((n.data as TaskData).systems ?? []).map((s) => s.name)))],
      },
    };
    await fetch(`/api/engagements/${engagementId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ processMap }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }, [nodes, edges, engagementId]);

  const saveAndContinue = useCallback(async () => {
    await saveMap();
    router.push(`/engagements/${engagementId}`);
  }, [saveMap, router, engagementId]);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const isTaskSelected = selectedNode?.type === "task";
  const selData = selectedNode?.data as TaskData | undefined;
  const selectedActorNames = new Set((selData?.actors ?? []).map((a) => a.name));
  const selectedSystemNames = new Set((selData?.systems ?? []).map((s) => s.name));

  return (
    <div style={{ height: "calc(100vh - 52px)", display: "flex", flexDirection: "column", background: "#091C35" }}>
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div style={{ height: 52, background: "#0a1e35", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", padding: "0 20px", gap: 12, flexShrink: 0 }}>
        <button onClick={() => router.push(`/engagements/${engagementId}`)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.45)", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
          ← Back
        </button>
        <div style={{ width: 1, height: 16, background: "rgba(255,255,255,0.1)" }} />
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>Process Modeler</div>
        <div style={{ fontSize: 11, background: "rgba(51,102,255,0.15)", border: "1px solid rgba(51,102,255,0.3)", borderRadius: 5, padding: "2px 8px", color: "#3366FF" }}>{processName}</div>
        <div style={{ flex: 1 }} />
        {nodes.length > 0 && (
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
            {nodes.filter((n) => n.type === "task").length} tasks · {edges.length} connections
          </div>
        )}
        <button onClick={saveMap} disabled={saving || nodes.length === 0}
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 7, color: saved ? "#26BC71" : "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: 600, padding: "6px 14px", cursor: nodes.length === 0 ? "not-allowed" : "pointer", opacity: nodes.length === 0 ? 0.4 : 1 }}>
          {saving ? "Saving…" : saved ? "✓ Saved" : "Save Map"}
        </button>
        <button onClick={saveAndContinue} disabled={saving || nodes.length === 0}
          style={{ background: nodes.length === 0 ? "rgba(51,102,255,0.3)" : "#3366FF", border: "none", borderRadius: 7, color: "#fff", fontSize: 12, fontWeight: 700, padding: "6px 16px", cursor: nodes.length === 0 ? "not-allowed" : "pointer", opacity: nodes.length === 0 ? 0.5 : 1 }}>
          Save & Upload Data →
        </button>
      </div>

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* ── Left panel ─────────────────────────────────────────────────── */}
        <div style={{ width: 256, flexShrink: 0, background: "#0a1e35", borderRight: "1px solid rgba(255,255,255,0.07)", overflowY: "auto", padding: "14px 12px" }}>
          {templateSteps.length > 0 && nodes.length === 0 && (
            <button onClick={addAutoLayout} style={{ width: "100%", background: "rgba(51,102,255,0.12)", border: "1px dashed rgba(51,102,255,0.4)", borderRadius: 8, color: "#3366FF", fontSize: 11, fontWeight: 700, padding: 10, cursor: "pointer", marginBottom: 14, textAlign: "center" }}>
              ⚡ Auto-layout {templateSteps.length} steps
            </button>
          )}
          <SectionHeader label="Events" />
          <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 16 }}>
            <DraggableChip nodeType="startEvent" label="Start Event" accentColor="#26BC71" icon="○" />
            <DraggableChip nodeType="endEvent" label="End Event" accentColor="#EF4444" icon="●" />
          </div>
          <SectionHeader label={`${processName} Tasks`} />
          <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 8 }}>
            {templateSteps.map((step) => (
              <DraggableChip key={step.id} nodeType="task" label={step.label} accentColor="#3366FF" icon="□" />
            ))}
          </div>
          <SectionHeader label="Generic Tasks" />
          <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 16 }}>
            {genericSteps.map((step) => (
              <DraggableChip key={step.id} nodeType="task" label={step.label} accentColor="#64748B" icon="□" />
            ))}
          </div>
          <SectionHeader label="Gateways" />
          <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 16 }}>
            <DraggableChip nodeType="xorGateway" label="XOR Gateway" accentColor="#FFAC09" icon="×" />
            <DraggableChip nodeType="parallelGateway" label="Parallel Gateway" accentColor="#06B6D4" icon="+" />
          </div>
          <div style={{ padding: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 7, fontSize: 10, color: "rgba(255,255,255,0.3)", lineHeight: 1.5 }}>
            Click a task to assign multiple actors &amp; systems from the right panel.
          </div>
        </div>

        {/* ── Canvas ─────────────────────────────────────────────────────── */}
        <div ref={reactFlowWrapper} style={{ flex: 1, position: "relative" }}>
          <ReactFlow
            nodes={nodes} edges={edges}
            onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
            onConnect={onConnect} onDrop={onDrop} onDragOver={onDragOver}
            onNodeClick={onNodeClick} onPaneClick={onPaneClick}
            nodeTypes={NODE_TYPES} fitView style={{ background: "#091C35" }}
            defaultEdgeOptions={{ type: "smoothstep", markerEnd: { type: MarkerType.ArrowClosed, color: "#3366FF", width: 16, height: 16 }, style: { stroke: "#3366FF", strokeWidth: 2 } }}
          >
            <Background variant={BackgroundVariant.Dots} gap={28} size={1} color="rgba(255,255,255,0.06)" />
            <Controls style={{ background: "#0a1e35", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} />
          </ReactFlow>
          {nodes.length === 0 && (
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
              <div style={{ fontSize: 38, marginBottom: 12, opacity: 0.25 }}>◇</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "rgba(255,255,255,0.3)" }}>Drag BPMN elements here to model your process</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.18)", marginTop: 6 }}>or use the Auto-layout shortcut on the left</div>
            </div>
          )}
        </div>

        {/* ── Right panel ─────────────────────────────────────────────────── */}
        <div style={{ width: 256, flexShrink: 0, background: "#0a1e35", borderLeft: "1px solid rgba(255,255,255,0.07)", overflowY: "auto", padding: "14px 12px" }}>
          {isTaskSelected && selData ? (
            <>
              {/* Selected counts */}
              <div style={{ marginBottom: 14, padding: "8px 10px", background: "rgba(51,102,255,0.08)", border: "1px solid rgba(51,102,255,0.2)", borderRadius: 7 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#fff", marginBottom: 2 }}>{selData.label}</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>
                  {selectedActorNames.size} actor{selectedActorNames.size !== 1 ? "s" : ""} · {selectedSystemNames.size} system{selectedSystemNames.size !== 1 ? "s" : ""}
                </div>
              </div>

              {/* Actors — multi-toggle */}
              <SectionHeader label="Actors" />
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginBottom: 8 }}>
                Click to toggle — multiple allowed
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 18 }}>
                {actors.map((actor) => {
                  const active = selectedActorNames.has(actor.name);
                  return (
                    <ToggleItem
                      key={actor.id}
                      name={actor.name}
                      description={actor.description}
                      color={actor.color}
                      active={active}
                      onClick={() => toggleActor(actor)}
                    />
                  );
                })}
              </div>

              {/* Systems — multi-toggle */}
              <SectionHeader label="Systems" />
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginBottom: 8 }}>
                Click to toggle — multiple allowed
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {applications.map((app) => {
                  const active = selectedSystemNames.has(app.name);
                  return (
                    <ToggleItem
                      key={app.id}
                      name={app.name}
                      description={app.description}
                      color={app.color}
                      active={active}
                      onClick={() => toggleSystem(app)}
                    />
                  );
                })}
              </div>
            </>
          ) : selectedNode ? (
            <>
              <SectionHeader label="Properties" />
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 6 }}>
                {selectedNode.type === "startEvent" && "Start Event — process entry point"}
                {selectedNode.type === "endEvent" && "End Event — process termination"}
                {selectedNode.type === "xorGateway" && "XOR Gateway — exclusive decision (one path)"}
                {selectedNode.type === "parallelGateway" && "Parallel Gateway — all paths run simultaneously"}
              </div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", lineHeight: 1.6 }}>
                Select a Task node to assign actors and systems.
              </div>
            </>
          ) : (
            <>
              <SectionHeader label="Actors" />
              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 18 }}>
                {actors.map((a) => (
                  <div key={a.id} style={readonlyItem}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: a.color, display: "inline-block", flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>{a.name}</span>
                  </div>
                ))}
              </div>
              <SectionHeader label="Systems" />
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {applications.map((s) => (
                  <div key={s.id} style={readonlyItem}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: s.color, display: "inline-block", flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>{s.name}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 14, fontSize: 10, color: "rgba(255,255,255,0.25)", lineHeight: 1.5 }}>
                Click a task on the canvas to assign actors and systems.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return (
    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>
      {label}
    </div>
  );
}

function DraggableChip({ nodeType, label, accentColor, icon }: { nodeType: string; label: string; accentColor: string; icon: string }) {
  const onDragStart = (event: DragEvent<HTMLDivElement>) => {
    event.dataTransfer.setData("application/node-type", nodeType);
    event.dataTransfer.setData("application/node-label", label);
    event.dataTransfer.effectAllowed = "move";
  };
  return (
    <div
      draggable
      onDragStart={onDragStart}
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderLeft: `3px solid ${accentColor}`, borderRadius: 6, padding: "6px 10px", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.7)", cursor: "grab", userSelect: "none", display: "flex", alignItems: "center", gap: 7 }}
      onMouseEnter={(e) => { const el = e.currentTarget as HTMLDivElement; el.style.background = accentColor + "18"; el.style.color = "#fff"; }}
      onMouseLeave={(e) => { const el = e.currentTarget as HTMLDivElement; el.style.background = "rgba(255,255,255,0.04)"; el.style.color = "rgba(255,255,255,0.7)"; }}
    >
      <span style={{ fontSize: 13, color: accentColor, lineHeight: 1 }}>{icon}</span>
      {label}
    </div>
  );
}

function ToggleItem({ name, description, color, active, onClick }: { name: string; description: string; color: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? color + "20" : "rgba(255,255,255,0.03)",
        border: `1px solid ${active ? color + "70" : "rgba(255,255,255,0.08)"}`,
        borderRadius: 7, padding: "7px 10px", cursor: "pointer", textAlign: "left",
        display: "flex", alignItems: "center", gap: 8, width: "100%", transition: "all 0.1s",
      }}
    >
      {/* Checkbox indicator */}
      <span style={{ width: 14, height: 14, borderRadius: 3, border: `2px solid ${active ? color : "rgba(255,255,255,0.2)"}`, background: active ? color : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.1s" }}>
        {active && <span style={{ fontSize: 9, color: "#fff", fontWeight: 900, lineHeight: 1 }}>✓</span>}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: active ? "#fff" : "rgba(255,255,255,0.7)" }}>{name}</div>
        {description && <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{description}</div>}
      </div>
    </button>
  );
}

const readonlyItem: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 8, padding: "6px 10px",
  borderRadius: 6, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)",
};

// ─── Exported wrapper ─────────────────────────────────────────────────────────

export interface ProcessModelerCanvasProps {
  engagementId: string;
  processTemplate: string;
  processName: string;
  initialProcessMap: { nodes: Node[]; edges: Edge[] } | null;
  templateSteps: StepLibraryItem[];
  genericSteps: StepLibraryItem[];
  applications: ApplicationDef[];
  actors: ActorDef[];
}

export function ProcessModelerCanvas(props: ProcessModelerCanvasProps) {
  return (
    <ReactFlowProvider>
      <FlowCanvas {...props} />
    </ReactFlowProvider>
  );
}
