"use client";

type NodeDef = {
  id: string;
  label: string;
  sub?: string;
  x: number;
  y: number;
  kind: "project" | "source" | "entity" | "moment" | "person";
};

const NODES: NodeDef[] = [
  { id: "project", label: "Lone Star Data Center", sub: "Project", x: 50, y: 48, kind: "project" },
  { id: "ercot", label: "ERCOT", sub: "Market Data", x: 18, y: 18, kind: "source" },
  { id: "puct", label: "PUCT", sub: "Docket #56789", x: 78, y: 14, kind: "source" },
  { id: "tceq", label: "TCEQ", sub: "Air Permit", x: 88, y: 42, kind: "source" },
  { id: "heliocare", label: "HelioCare Energy", sub: "Company", x: 22, y: 52, kind: "entity" },
  { id: "maya", label: "Maya Chen", sub: "Director, Development", x: 12, y: 78, kind: "person" },
  { id: "landowner", label: "Landowner Holdings LLC", sub: "Owner", x: 48, y: 82, kind: "entity" },
  { id: "powerrail", label: "PowerRail Construction", sub: "EPC", x: 78, y: 72, kind: "entity" },
  { id: "summit", label: "GridForward Summit", sub: "May 14–16 · Dallas, TX", x: 62, y: 28, kind: "moment" },
];

const EDGES: { from: string; to: string; style: "source" | "entity" | "moment" }[] = [
  { from: "ercot", to: "project", style: "source" },
  { from: "puct", to: "project", style: "source" },
  { from: "tceq", to: "project", style: "source" },
  { from: "heliocare", to: "project", style: "entity" },
  { from: "maya", to: "heliocare", style: "entity" },
  { from: "landowner", to: "project", style: "entity" },
  { from: "powerrail", to: "project", style: "entity" },
  { from: "summit", to: "project", style: "moment" },
  { from: "maya", to: "summit", style: "moment" },
];

function strokeFor(style: "source" | "entity" | "moment") {
  if (style === "entity") return { stroke: "#1F7A5C", dash: undefined, width: 1.6 };
  if (style === "moment") return { stroke: "#FF4F00", dash: "4 3", width: 1.5 };
  return { stroke: "#9CA3AF", dash: "3 3", width: 1.25 };
}

export function NetworkGraph() {
  const byId = Object.fromEntries(NODES.map((n) => [n.id, n]));

  return (
    <div className="gc-graph" aria-label="Project connection network diagram">
      <svg className="gc-graph-svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
        {EDGES.map((edge) => {
          const a = byId[edge.from];
          const b = byId[edge.to];
          const s = strokeFor(edge.style);
          return (
            <line
              key={`${edge.from}-${edge.to}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={s.stroke}
              strokeWidth={s.width}
              strokeDasharray={s.dash}
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </svg>

      {NODES.map((node) => (
        <div
          key={node.id}
          className={`gc-node gc-node--${node.kind}`}
          style={{ left: `${node.x}%`, top: `${node.y}%` }}
        >
          <strong>{node.label}</strong>
          {node.sub ? <span>{node.sub}</span> : null}
        </div>
      ))}

      <ul className="gc-legend" aria-label="Connection legend">
        <li>
          <i className="gc-legend-line gc-legend-line--source" />
          Public Source
        </li>
        <li>
          <i className="gc-legend-line gc-legend-line--entity" />
          Entity / Relationship
        </li>
        <li>
          <i className="gc-legend-line gc-legend-line--moment" />
          Moment / Event
        </li>
      </ul>
    </div>
  );
}

export function NetworkGraphMobile() {
  const cards = [
    { title: "Lone Star Data Center", meta: "Project", tone: "project" as const },
    { title: "HelioCare Energy", meta: "Company · linked", tone: "entity" as const },
    { title: "Maya Chen", meta: "Director, Development", tone: "person" as const },
    { title: "PUCT Docket #56789", meta: "Public source", tone: "source" as const },
    { title: "GridForward Summit", meta: "May 14–16 · Dallas", tone: "moment" as const },
  ];

  return (
    <div className="gc-graph-mobile" aria-label="Connected project story">
      {cards.map((card, i) => (
        <div key={card.title} className="gc-mobile-step">
          {i > 0 ? <div className="gc-mobile-connector" aria-hidden="true" /> : null}
          <div className={`gc-mobile-card gc-mobile-card--${card.tone}`}>
            <strong>{card.title}</strong>
            <span>{card.meta}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
