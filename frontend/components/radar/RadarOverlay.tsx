"use client";

import { RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { RadarDemoResponse, RadarJoin, ScoredRadarProject } from "@/lib/radar-types";

const SOURCE_LABEL: Record<string, string> = {
  ercot_gis: "ERCOT GIS",
  puct: "PUCT",
  tceq: "TCEQ",
};

type HealthState = {
  ok: boolean;
  agents: Array<{ name: string; ok: boolean; status: string }>;
};

export function RadarOverlay() {
  const [health, setHealth] = useState<HealthState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<ScoredRadarProject[]>([]);
  const [joins, setJoins] = useState<RadarJoin[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [meta, setMeta] = useState<string | null>(null);

  const selected = useMemo(
    () => projects.find((p) => p.canonicalId === selectedId) ?? null,
    [projects, selectedId],
  );

  const selectedJoin = useMemo(
    () => joins.find((j) => j.projectId === selectedId) ?? null,
    [joins, selectedId],
  );

  const refreshHealth = useCallback(async () => {
    try {
      const res = await fetch("/api/radar/health", { cache: "no-store" });
      const data = (await res.json()) as HealthState;
      setHealth(data);
    } catch {
      setHealth({ ok: false, agents: [] });
    }
  }, []);

  useEffect(() => {
    void refreshHealth();
  }, [refreshHealth]);

  async function runDemo() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/radar/demo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "demo" }),
      });
      const data = (await res.json()) as RadarDemoResponse;
      if (!res.ok || !data.projects?.length) {
        setError(
          typeof data.error === "string"
            ? data.error
            : "Demo ingest failed — are R1–R3 running?",
        );
        return;
      }
      setProjects(data.projects);
      setJoins(data.joins ?? []);
      const hard = data.projects.find((p) => p.hardEr);
      setSelectedId(hard?.canonicalId ?? data.projects[0]!.canonicalId);
      setMeta(
        `${data.ingest?.recordCount ?? "?"} raw → ${data.normalize?.projectCount ?? data.projects.length} entities → scored`,
      );
      await refreshHealth();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Demo ingest failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="radar-overlay" aria-label="Project Radar panel">
      <header className="radar-overlay-header">
        <div>
          <p className="radar-kicker">Track 1 · Project Radar</p>
          <h2>Live agents</h2>
        </div>
        <button
          type="button"
          className="radar-demo-btn"
          onClick={() => void runDemo()}
          disabled={busy}
        >
          <RefreshCw size={14} className={busy ? "radar-spin" : undefined} aria-hidden />
          {busy ? "Running…" : "Demo ingest"}
        </button>
      </header>

      <div className="radar-health" role="status">
        {health?.ok ? (
          <span className="radar-pill ok">R1–R3 healthy</span>
        ) : (
          <span className="radar-pill down">Agents offline</span>
        )}
        {meta ? <span className="radar-meta">{meta}</span> : null}
      </div>

      {error ? <p className="radar-error">{error}</p> : null}

      {projects.length > 0 ? (
        <div className="radar-body">
          <ul className="radar-list">
            {projects.map((p) => (
              <li key={p.canonicalId}>
                <button
                  type="button"
                  className={
                    p.canonicalId === selectedId
                      ? "radar-list-item active"
                      : "radar-list-item"
                  }
                  onClick={() => setSelectedId(p.canonicalId)}
                >
                  <span className="radar-list-name">
                    {p.name}
                    {p.hardEr ? <em className="radar-er-badge">ER</em> : null}
                  </span>
                  <span className="radar-list-meta">
                    {p.stage} · {Math.round(p.stageConfidence * 100)}% · {p.mw} MW
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {selected ? (
            <article className="radar-detail">
              <div className="radar-detail-top">
                <h3>{selected.name}</h3>
                <button
                  type="button"
                  className="radar-icon-btn"
                  aria-label="Clear selection"
                  onClick={() => setSelectedId(null)}
                >
                  <X size={14} />
                </button>
              </div>
              <p className="radar-reason">{selected.reason}</p>

              <dl className="radar-dl">
                <div>
                  <dt>Stage</dt>
                  <dd>
                    {selected.stage}{" "}
                    <span>({Math.round(selected.stageConfidence * 100)}% conf.)</span>
                  </dd>
                </div>
                <div>
                  <dt>Owner</dt>
                  <dd>{selected.primaryOwner}</dd>
                </div>
                <div>
                  <dt>Aliases</dt>
                  <dd>{selected.aliases.join(" · ")}</dd>
                </div>
              </dl>

              <h4>Sources</h4>
              <ul className="radar-sources">
                {selected.sources.map((s) => (
                  <li key={s.recordId}>
                    <strong>{SOURCE_LABEL[s.source] ?? s.source}</strong>{" "}
                    <code>{s.sourceId}</code>
                    <p>{s.evidence}</p>
                  </li>
                ))}
              </ul>

              {selectedJoin ? (
                <>
                  <h4>People at company</h4>
                  <ul className="radar-people">
                    {selectedJoin.people.map((person) => (
                      <li key={`${person.name}-${person.title}`}>
                        <strong>{person.name}</strong> — {person.title}
                        {person.conference ? (
                          <span>
                            {" "}
                            · speaking at {person.conference}
                            {person.topic ? ` (“${person.topic}”)` : ""}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </article>
          ) : null}
        </div>
      ) : (
        <p className="radar-empty">
          Run <strong>Demo ingest</strong> to stitch ERCOT + PUCT + TCEQ fixtures,
          resolve aliases, and infer stage with evidence.
        </p>
      )}
    </aside>
  );
}
