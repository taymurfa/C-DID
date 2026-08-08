"use client";

import { Building2, ChevronDown, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { useSignalData, type DeskLead } from "@/lib/useSignalData";
import { useDeskUi } from "@/components/desk/DeskShell";
import { initials, PanelHeader } from "@/components/desk/shared";

type CompanyAgg = {
  key: string;
  name: string;
  count: number;
  avgScore: number;
  maxScore: number;
  titles: string[];
  topics: string[];
  isICP: boolean;
  leads: DeskLead[];
};

function aggregateCompanies(leads: DeskLead[]): CompanyAgg[] {
  const map = new Map<string, DeskLead[]>();
  for (const lead of leads) {
    const name = lead.normalizedCompany || lead.company || "Unknown company";
    const key = name.trim().toLowerCase() || "unknown";
    const bucket = map.get(key) ?? [];
    bucket.push(lead);
    map.set(key, bucket);
  }

  return [...map.entries()]
    .map(([key, group]) => {
      const scores = group.map((l) => l.score);
      const avgScore =
        scores.reduce((sum, value) => sum + value, 0) / Math.max(scores.length, 1);
      const titles = [
        ...new Set(group.map((l) => l.title).filter(Boolean) as string[]),
      ].slice(0, 3);
      const topics = [
        ...new Set(group.flatMap((l) => l.topics ?? []).filter(Boolean)),
      ].slice(0, 4);
      return {
        key,
        name: group[0]?.normalizedCompany || group[0]?.company || "Unknown company",
        count: group.length,
        avgScore: Math.round(avgScore),
        maxScore: Math.max(...scores),
        titles,
        topics,
        isICP: group.some((l) => l.isICP),
        leads: [...group].sort((a, b) => b.score - a.score),
      };
    })
    .sort((a, b) => b.maxScore - a.maxScore || b.count - a.count);
}

export function CompaniesView() {
  const data = useSignalData();
  const { openSpeaker } = useDeskUi();
  const companies = useMemo(
    () => aggregateCompanies(data.filteredLeads),
    [data.filteredLeads],
  );
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <section className="panel companies-panel page-panel">
      <PanelHeader
        title="Companies"
        action={`${companies.length} accounts`}
      />
      <div className="company-head" aria-hidden="true">
        <span>Company</span>
        <span>Speakers</span>
        <span>Avg / max</span>
        <span>Titles</span>
        <span>ICP</span>
      </div>
      <div className="company-list">
        {companies.length === 0 ? (
          <p className="speaker-empty">No companies in view — analyze a conference first.</p>
        ) : (
          companies.map((company) => {
            const open = expanded === company.key;
            return (
              <article
                key={company.key}
                className={`company-row ${open ? "company-expanded" : ""}`}
              >
                <button
                  type="button"
                  className="company-main"
                  onClick={() => setExpanded(open ? null : company.key)}
                  aria-expanded={open}
                >
                  <span className="company-identity">
                    <i className="avatar avatar-1">
                      <Building2 size={14} />
                    </i>
                    <span>
                      <strong>{company.name}</strong>
                      <small>
                        {company.topics.length
                          ? company.topics.join(" · ")
                          : "Topics from speaker sessions"}
                      </small>
                    </span>
                  </span>
                  <span className="company-count">{company.count}</span>
                  <span className="company-score">
                    <strong>{company.avgScore}</strong>
                    <small>max {company.maxScore}</small>
                  </span>
                  <span className="company-titles">
                    {company.titles.join(" · ") || "—"}
                  </span>
                  <span className={`company-icp ${company.isICP ? "icp-yes" : ""}`}>
                    {company.isICP ? "ICP" : "Watch"}
                  </span>
                  {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
                {open ? (
                  <div className="company-speakers">
                    {company.leads.map((lead) => (
                      <button
                        key={lead.id}
                        type="button"
                        className="company-speaker"
                        onClick={() => openSpeaker(lead.id)}
                      >
                        <i className="avatar avatar-2">{initials(lead.name)}</i>
                        <span>
                          <strong>{lead.name}</strong>
                          <small>
                            {lead.title || "Role unknown"} · score {lead.score}
                          </small>
                        </span>
                        <ChevronRight size={14} />
                      </button>
                    ))}
                  </div>
                ) : null}
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
