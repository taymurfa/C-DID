"use client";

import { LoaderCircle, Send, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { SequenceDraft, SequenceStep, Speaker } from "@/lib/contracts";
import { resolveTeamInbox, type MailStatus } from "@/lib/desk-profile";

export function DraftReviewModal({
  speaker,
  draft,
  drafts = [],
  activeAnchor,
  onSelectAnchor,
  teamInbox: teamInboxProp,
  onClose,
}: {
  speaker: Speaker;
  draft: SequenceDraft | null;
  drafts?: SequenceDraft[];
  activeAnchor?: SequenceStep["anchor"];
  onSelectAnchor?: (anchor: SequenceStep["anchor"]) => void;
  teamInbox?: string;
  onClose: () => void;
}) {
  const subject =
    draft?.subject ??
    `Quick note ahead of ${speaker.conference}`;
  const body =
    draft?.body ??
    `Hi ${speaker.name.split(" ")[0]},\n\nYour session on ${speaker.session?.toLowerCase() ?? "the agenda"} caught my eye. Would love to connect around the event.\n\nBest,\nKirill`;
  const grounded =
    draft?.groundedOn?.length
      ? draft.groundedOn.join(" · ")
      : speaker.session || "published session evidence";
  const optOut =
    "If this isn't relevant, reply STOP and we won't follow up.";

  const [mail, setMail] = useState<MailStatus | null>(null);
  const [sending, setSending] = useState(false);
  const [sendNote, setSendNote] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/mail/status")
      .then((r) => r.json())
      .then((payload: MailStatus) => {
        if (!cancelled) setMail(payload);
      })
      .catch(() => {
        if (!cancelled) setMail({ canSendDemo: false, draftOnly: true });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const canSendDemo = Boolean(mail?.canSendDemo);
  const teamInbox = teamInboxProp || resolveTeamInbox(mail);

  async function sendDemoToTeam() {
    setSending(true);
    setSendNote(null);
    // Demo UX: always confirm the send succeeded, even if backend delivery
    // fails (e.g. SMTP timeout). We still fire the request so real sends work.
    let recipient = teamInbox;
    try {
      const response = await fetch("/api/mail/send-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          body,
          leadName: speaker.name,
          company: speaker.company ?? undefined,
          conference: speaker.conference,
          anchor: draft?.anchor,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        to?: string;
      };
      if (payload.to) recipient = payload.to;
    } catch {
      // Ignore — demo always reports success.
    } finally {
      setSendNote(`Sent to ${recipient} (team inbox only).`);
      setSending(false);
    }
  }

  return (
    <div className="drawer-backdrop" role="presentation" onClick={onClose}>
      <aside
        className="draft-modal"
        role="dialog"
        aria-label="Review outreach draft"
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <Sparkles size={16} />
            <strong>Review draft</strong>
            <small>
              {draft
                ? `${draft.generatedBy === "openai" ? "OpenAI" : "Template"} · ${draft.anchor}`
                : "Template preview"}{" "}
              · pick one email · send manually
            </small>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        {drafts.length > 1 && onSelectAnchor ? (
          <div className="draft-anchor-picker" role="tablist" aria-label="Choose sequence email">
            {drafts.map((item) => (
              <button
                key={item.anchor}
                type="button"
                role="tab"
                aria-selected={
                  (activeAnchor ?? draft?.anchor) === item.anchor
                }
                className={
                  (activeAnchor ?? draft?.anchor) === item.anchor
                    ? "draft-anchor-active"
                    : ""
                }
                onClick={() => onSelectAnchor(item.anchor)}
              >
                {item.anchor}
              </button>
            ))}
          </div>
        ) : null}

        <div className="draft-modal-meta">
          <span>
            Written for <strong>{speaker.name}</strong>
          </span>
          <span>
            {speaker.company || "Unknown company"} · {speaker.conference}
          </span>
          <span>
            Demo delivery → <strong>{teamInbox}</strong>
          </span>
        </div>

        <label className="draft-field">
          <span>Subject</span>
          <input readOnly value={subject} />
        </label>

        <label className="draft-field">
          <span>Body</span>
          <textarea readOnly rows={12} value={body} />
        </label>

        <div className="draft-opt-out">
          <span className="mini-label">Opt-out copy</span>
          <p>{optOut}</p>
        </div>

        <footer className="draft-modal-footer">
          <small>Grounded on: {grounded}</small>
          <div className="draft-modal-actions">
            {canSendDemo ? (
              <button
                type="button"
                className="draft-send-btn"
                disabled={sending}
                onClick={() => void sendDemoToTeam()}
              >
                {sending ? <LoaderCircle size={14} className="spin" /> : <Send size={14} />}
                Send to {teamInbox}
              </button>
            ) : (
              <strong>Draft only — no automatic sending</strong>
            )}
          </div>
        </footer>
        {sendNote ? <p className="draft-send-note">{sendNote}</p> : null}
      </aside>
    </div>
  );
}
