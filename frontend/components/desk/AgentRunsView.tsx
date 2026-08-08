"use client";

import { useSignalData } from "@/lib/useSignalData";
import { PanelHeader, PipelineSteps } from "@/components/desk/shared";

export function AgentRunsView() {
  const data = useSignalData();
  const agents = [
    { key: "ingestion" as const, label: "Agent 1 · Ingestion", port: ":8001" },
    { key: "intelligence" as const, label: "Agent 2 · Intelligence", port: ":8002" },
    { key: "gtm" as const, label: "Agent 3 · GTM", port: ":8003" },
  ];
  const allOk = data.systemHealth.status === "ok";

  return (
    <section className="panel page-panel agent-runs-panel">
      <PanelHeader title="Agent runs" action={allOk ? "Healthy" : "Degraded"} />
      <div className="agent-runs-grid">
        {agents.map((agent) => {
          const health = data.systemHealth.agents[agent.key];
          const ok = health.status === "ok";
          return (
            <article
              key={agent.key}
              className={`agent-run-card ${ok ? "agent-ok" : health.status === "unknown" ? "agent-unknown" : "agent-down"}`}
            >
              <header>
                <i />
                <strong>{agent.label}</strong>
                <small>{agent.port}</small>
              </header>
              <p>
                Status: <em>{health.status}</em>
                {health.mongo ? ` · mongo ${health.mongo}` : ""}
              </p>
            </article>
          );
        })}
      </div>

      <div className="agent-runs-pipeline">
        <span className="mini-label">Latest pipeline</span>
        <PipelineSteps
          activeIndex={data.pipelineIndex}
          isAnalyzing={data.isAnalyzing}
          stats={data.stats}
        />
        <small>
          {data.isAnalyzing
            ? "Analysis in progress"
            : data.stats
              ? `${data.stats.speakersIngested} ingested · ${data.stats.qualified} qualified`
              : "Run Analyze conference to exercise the pipeline"}
        </small>
      </div>
    </section>
  );
}
