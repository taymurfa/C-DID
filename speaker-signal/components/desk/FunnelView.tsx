"use client";

import { ChevronRight } from "lucide-react";
import { FUNNEL_LABELS, nextLeadStatus } from "@/lib/pipeline/funnel";
import { useSignalData } from "@/lib/useSignalData";
import { useDeskUi } from "@/components/desk/DeskShell";
import { initials, PanelHeader } from "@/components/desk/shared";

export function FunnelView() {
  const data = useSignalData();
  const { openSpeaker } = useDeskUi();
  const drop = data.funnel.dropOff;
  const selected = data.selected;
  const status = selected
    ? (data.statuses[selected.id] ?? "identified")
    : null;
  const next = status ? nextLeadStatus(status) : null;

  return (
    <div className="funnel-page">
      <section className="panel funnel-panel page-panel">
        <PanelHeader title="Pipeline funnel" action="Status-driven conversion" />
        <div className="funnel-meta">
          <span>Lead statuses</span>
          <span>
            <i /> {data.funnelSource === "api" ? "Agent 3" : "Local"}
          </span>
        </div>
        <div className="funnel-chart funnel-chart-7">
          {data.funnel.stages.map((stage) => (
            <div key={stage.stage} className="funnel-stage">
              <span>{stage.label}</span>
              <strong>{stage.count}</strong>
              <small>
                {stage.conversionFromPrior === null
                  ? "Source set"
                  : `${stage.conversionFromPrior}% from prior`}
              </small>
            </div>
          ))}
        </div>
        <div className="funnel-dropoff">
          <span>Largest leak</span>
          <strong>
            {drop ? `${drop.fromLabel} → ${drop.toLabel}` : "No drop-off yet"}
          </strong>
          <em>{drop ? `−${drop.lost}` : "—"}</em>
          <p>
            {drop
              ? "Advance lead status on a speaker to watch conversion and drop-off recompute."
              : "Advance statuses to surface the largest funnel leak."}
          </p>
        </div>
      </section>

      {selected && status ? (
        <section className="panel page-panel">
          <PanelHeader title="Selected lead control" action="Open drawer" onAction={() => openSpeaker(selected.id)} />
          <div className="funnel-lead-control">
            <span className="avatar avatar-1">{initials(selected.name)}</span>
            <div>
              <strong>{selected.name}</strong>
              <small>
                {selected.company} · {FUNNEL_LABELS[status]}
              </small>
            </div>
            <button
              type="button"
              className="mode-button"
              disabled={!next}
              onClick={() => data.advanceStatus(selected.id)}
            >
              Advance{next ? ` → ${FUNNEL_LABELS[next]}` : ""}
              <ChevronRight size={14} />
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
