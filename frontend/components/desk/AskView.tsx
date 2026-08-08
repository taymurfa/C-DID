"use client";

import {
  LoaderCircle,
  MessageSquareText,
  SendHorizontal,
  Sparkles,
} from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useSignalData } from "@/lib/useSignalData";
import { PanelHeader } from "@/components/desk/shared";

type ChatRole = "user" | "assistant";
type UiMessage = { id: string; role: ChatRole; content: string };

const SUGGESTIONS = [
  "Who are the top A-tier speakers and why?",
  "Summarize this conference's ICP fit",
  "Which companies show up most among qualified leads?",
  "What's the funnel drop-off right now?",
];

function nextId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function AskView() {
  const data = useSignalData();
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  async function ask(question: string) {
    const trimmed = question.trim();
    if (!trimmed || busy) return;

    const userMsg: UiMessage = {
      id: nextId(),
      role: "user",
      content: trimmed,
    };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput("");
    setBusy(true);
    setError(null);

    const leads = data.filteredLeads.slice(0, 40).map((lead) => ({
      id: lead.id,
      name: lead.name,
      title: lead.title,
      company: lead.company,
      conference: lead.conference,
      session: lead.session,
      score: lead.score,
      tier: lead.tier,
      scoreReason: lead.scoreReason,
      topics: lead.topics ?? [],
      role: lead.role,
      status: data.statuses[lead.id] ?? "identified",
      evidence: (lead.evidence ?? []).slice(0, 3).map((item) => ({
        label: item.label,
        excerpt: item.excerpt,
      })),
    }));

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map(({ role, content }) => ({ role, content })),
          context: {
            conferences: data.conferences.map((c) => ({
              name: c.name,
              city: c.city,
              startDate: c.startDate,
              endDate: c.endDate,
              speakerCount: c.speakerCount,
              qualifiedCount: c.qualifiedCount,
              status: c.status,
            })),
            selectedConference: data.selectedConference?.name ?? null,
            leads,
            funnel: data.funnel,
            sequenceSteps: data.sequenceSteps.map((step) => ({
              anchor: step.anchor,
              label: step.label,
              status: step.status,
              subject: step.subject,
            })),
            drafts: data.drafts.map((draft) => ({
              anchor: draft.anchor,
              subject: draft.subject,
              body: draft.body,
            })),
            stats: data.stats,
          },
        }),
      });

      const payload = (await response.json()) as {
        answer?: string;
        error?: string;
        enabled?: boolean;
      };

      if (!response.ok) {
        throw new Error(payload.error || `Chat failed (${response.status})`);
      }

      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: "assistant",
          content: payload.answer?.trim() || "No answer returned.",
        },
      ]);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Chat request failed";
      setError(message);
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: "assistant",
          content: `Sorry — ${message}`,
        },
      ]);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void ask(input);
  }

  const leadCount = data.filteredLeads.length;

  return (
    <section className="panel ask-panel page-panel">
      <PanelHeader
        title="Ask Signal"
        action={
          leadCount
            ? `${leadCount} leads in context`
            : "Analyze a conference first"
        }
      />

      <div className="ask-layout">
        <div className="ask-thread" ref={scrollerRef}>
          {messages.length === 0 ? (
            <div className="ask-empty">
              <span className="ask-empty-icon" aria-hidden="true">
                <MessageSquareText size={22} strokeWidth={1.6} />
              </span>
              <h2>Ask about your desk data</h2>
              <p>
                Answers are grounded in the conferences, qualified speakers,
                funnel, and sequence drafts currently loaded in Signal Desk.
              </p>
              <div className="ask-suggestions">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    disabled={busy}
                    onClick={() => void ask(suggestion)}
                  >
                    <Sparkles size={14} />
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <ul className="ask-messages">
              {messages.map((message) => (
                <li
                  key={message.id}
                  className={`ask-bubble ask-${message.role}`}
                >
                  <span className="ask-role">
                    {message.role === "user" ? "You" : "Assistant"}
                  </span>
                  <p>{message.content}</p>
                </li>
              ))}
              {busy ? (
                <li className="ask-bubble ask-assistant ask-pending">
                  <span className="ask-role">Assistant</span>
                  <p>
                    <LoaderCircle className="spin" size={15} /> Thinking…
                  </p>
                </li>
              ) : null}
            </ul>
          )}
        </div>

        <form className="ask-composer" onSubmit={onSubmit}>
          {error ? <p className="ask-error">{error}</p> : null}
          <label className="sr-only" htmlFor="ask-input">
            Ask a question
          </label>
          <textarea
            id="ask-input"
            ref={inputRef}
            rows={2}
            value={input}
            disabled={busy}
            placeholder={
              leadCount
                ? "Ask about speakers, scores, companies, funnel…"
                : "No leads yet — you can still ask how the desk works"
            }
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void ask(input);
              }
            }}
          />
          <button
            type="submit"
            className="ask-send"
            disabled={busy || !input.trim()}
          >
            {busy ? (
              <LoaderCircle className="spin" size={16} />
            ) : (
              <SendHorizontal size={16} />
            )}
            Ask
          </button>
        </form>
      </div>
    </section>
  );
}
