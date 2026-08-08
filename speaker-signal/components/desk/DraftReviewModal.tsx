"use client";

import { Sparkles, X } from "lucide-react";
import type { SequenceDraft, Speaker } from "@/lib/contracts";

export function DraftReviewModal({
  speaker,
  draft,
  onClose,
}: {
  speaker: Speaker;
  draft: SequenceDraft | null;
  onClose: () => void;
}) {
  const subject =
    draft?.subject ??
    `Quick note ahead of ${speaker.conference}`;
  const body =
    draft?.body ??
    `Hi ${speaker.name.split(" ")[0]},\n\nYour session on ${speaker.session?.toLowerCase() ?? "the agenda"} caught my eye. Would love to connect around the event.\n\nBest,\nAlex`;
  const grounded =
    draft?.groundedOn?.length
      ? draft.groundedOn.join(" · ")
      : speaker.session || "published session evidence";
  const optOut =
    "If this isn't relevant, reply STOP and we won't follow up.";

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
              · draft only
            </small>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <div className="draft-modal-meta">
          <span>
            To <strong>{speaker.name}</strong>
          </span>
          <span>
            {speaker.company || "Unknown company"} · {speaker.conference}
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

        <footer>
          <small>Grounded on: {grounded}</small>
          <strong>No send — review only</strong>
        </footer>
      </aside>
    </div>
  );
}
