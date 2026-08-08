"use client";

import Link from "next/link";
import {
  Check,
  ChevronRight,
  ExternalLink,
  LoaderCircle,
  type LucideIcon,
} from "lucide-react";
import type { LeadStatus } from "@/lib/contracts";
import { FUNNEL_LABELS } from "@/lib/pipeline/funnel";
import type { DeskLead } from "@/lib/useSignalData";

export function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("");
}

export function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export function deskHref(basePath: string, path: string) {
  if (path === "/") return basePath || "/";
  return `${basePath}${path}`;
}

export function Metric({
  icon: Icon,
  label,
  value,
  note,
  positive = false,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  note: string;
  positive?: boolean;
}) {
  return (
    <article className="metric">
      <Icon size={23} strokeWidth={1.6} />
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <small className={positive ? "positive" : ""}>{note}</small>
    </article>
  );
}

export function PanelHeader({
  title,
  action,
  href,
  onAction,
}: {
  title: string;
  action: string;
  href?: string;
  onAction?: () => void;
}) {
  return (
    <header className="panel-heading">
      <h2>{title}</h2>
      {href ? (
        <Link href={href} className="panel-action-link">
          {action}
          <ChevronRight size={15} />
        </Link>
      ) : onAction ? (
        <button type="button" onClick={onAction}>
          {action}
          <ChevronRight size={15} />
        </button>
      ) : (
        <span>{action}</span>
      )}
    </header>
  );
}

export function ScoreBar({
  label,
  value,
  max,
}: {
  label: string;
  value: number;
  max: number;
}) {
  return (
    <span>
      <small>{label}</small>
      <i>
        <b style={{ width: `${(value / max) * 100}%` }} />
      </i>
      <em>
        {value}/{max}
      </em>
    </span>
  );
}

export function SpeakerRow({
  speaker,
  rank,
  selected,
  status,
  onSelect,
  showEvidence = true,
}: {
  speaker: DeskLead;
  rank: number;
  selected: boolean;
  status: LeadStatus;
  onSelect: () => void;
  showEvidence?: boolean;
}) {
  return (
    <article className={`speaker-row ${selected ? "speaker-selected" : ""}`}>
      <button className="speaker-main" onClick={onSelect} aria-expanded={selected}>
        <span className="rank">{rank}</span>
        <span className="identity">
          <i className={`avatar avatar-${((rank - 1) % 5) + 1}`}>
            {initials(speaker.name)}
          </i>
          <span>
            <strong>{speaker.name}</strong>
            <small>{speaker.title || "Title unavailable"}</small>
          </span>
        </span>
        <span className="role-company">
          <strong>{speaker.title || "Unknown role"}</strong>
          <small>{speaker.company || "Unknown company"}</small>
        </span>
        <span className="score">
          <strong>{speaker.score}</strong>
          <small>Tier {speaker.tier}</small>
        </span>
        <span className="session">
          <strong>{speaker.conference}</strong>
          <small>{speaker.session || "Session not published"}</small>
        </span>
        <span className="outreach">
          <strong>{FUNNEL_LABELS[status]}</strong>
          <small>
            {speaker.outreachStage === "Identified"
              ? "Sequence ready"
              : speaker.outreachStage}
          </small>
        </span>
        <ChevronRight className="row-arrow" size={17} />
      </button>
      {selected && showEvidence ? (
        <div className="speaker-evidence">
          <div>
            <span className="mini-label">Why they matter</span>
            <p>{speaker.scoreReason}</p>
          </div>
          <div>
            <span className="mini-label">Provenance</span>
            {speaker.evidence.map((evidence) => (
              <a
                key={`${speaker.id}-${evidence.sourceUrl}-${evidence.label}`}
                href={evidence.sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                {evidence.label}
                <ExternalLink size={11} />
              </a>
            ))}
          </div>
          <div>
            <span className="mini-label">Explainable score</span>
            <div className="score-bars">
              <ScoreBar
                label="Topic"
                value={speaker.scoreBreakdown.topicRelevance}
                max={25}
              />
              <ScoreBar label="Role" value={speaker.scoreBreakdown.roleFit} max={20} />
              <ScoreBar
                label="Company"
                value={speaker.scoreBreakdown.companyFit}
                max={20}
              />
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}

export const PIPELINE_STEPS = [
  { label: "Crawl", detail: "pages" },
  { label: "Extract", detail: "claims" },
  { label: "Resolve", detail: "entities" },
  { label: "Score", detail: "qualified" },
] as const;

export function PipelineSteps({
  activeIndex,
  isAnalyzing,
  stats,
}: {
  activeIndex: number;
  isAnalyzing: boolean;
  stats: { speakersIngested: number; afterDedupe: number; qualified: number } | null;
}) {
  const details = [
    stats ? `${stats.speakersIngested} speakers` : "pages",
    stats ? `${stats.afterDedupe} unique` : "claims",
    stats ? `${stats.afterDedupe} entities` : "entities",
    stats ? `${stats.qualified} qualified` : "qualified",
  ];

  return (
    <div className="pipeline-steps">
      {PIPELINE_STEPS.map((step, index) => {
        const complete = activeIndex > index || activeIndex === 4 || activeIndex === -1;
        const active = isAnalyzing && activeIndex === index;
        return (
          <div key={step.label} className={active ? "pipeline-active" : ""}>
            <span className={`pipeline-node ${complete ? "node-complete" : ""}`}>
              {active ? (
                <LoaderCircle className="spin" size={11} />
              ) : complete ? (
                <Check size={11} />
              ) : (
                <span className="pipeline-dot" />
              )}
            </span>
            <p>
              <strong>{step.label}</strong>
              <small>
                {details[index]}
                <em>{active ? "now" : "ready"}</em>
              </small>
            </p>
          </div>
        );
      })}
    </div>
  );
}
