"use client";

import { useSignalData } from "@/lib/useSignalData";
import { useDeskUi } from "@/components/desk/DeskShell";
import { PanelHeader, SpeakerRow } from "@/components/desk/shared";

export function SpeakersView() {
  const data = useSignalData();
  const { openSpeaker } = useDeskUi();
  const qualifiedCount = data.stats?.qualified ?? data.leads.length;

  return (
    <section className="panel speakers-panel page-panel">
      <PanelHeader
        title="High-signal speakers"
        action={`${data.filteredLeads.length} in view`}
      />
      <div className="speaker-head" aria-hidden="true">
        <span>#</span>
        <span>Speaker</span>
        <span>Role / company</span>
        <span>Score</span>
        <span>Conference / session</span>
        <span>Outreach</span>
      </div>
      <div className="speaker-list">
        {data.filteredLeads.length === 0 ? (
          <p className="speaker-empty">No speakers yet — run Analyze conference.</p>
        ) : (
          data.filteredLeads.map((speaker, index) => (
            <SpeakerRow
              key={speaker.id}
              speaker={speaker}
              rank={index + 1}
              selected={speaker.id === data.selected?.id}
              status={data.statuses[speaker.id] ?? "identified"}
              onSelect={() => openSpeaker(speaker.id)}
            />
          ))
        )}
      </div>
      <footer className="panel-footer">
        <span>
          {data.filteredLeads.length} shown · {qualifiedCount} qualified
        </span>
        <span>
          Focus: {data.selectedConference?.name ?? "All conferences"}
        </span>
      </footer>
    </section>
  );
}
