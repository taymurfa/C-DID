import type { ChatRequest } from "@/lib/contracts";
import { chatText, isOpenAiEnabled, type ChatTurn } from "@/lib/pipeline/openai";

const PRODUCT_BRIEF = `You are Signal Desk Assistant for Candid Intelligence (Speaker Signal).
Candid Intelligence is an owner's-engineering / project-delivery advisor for energy, power, grid, and data-center infrastructure.
Speaker Signal ingests public conference pages (Agent 1), qualifies speakers as ICP leads (Agent 2), and drafts timed outreach sequences (Agent 3).
Tiers A–D rank ICP fit. Funnel stages: identified → contacted → replied → meeting → met → follow-up → booked.
Sequence anchors: T-14, T-7, T-2, Event, T+2 (days relative to conference start).`;

const RULES = `Rules:
- Answer ONLY from the DESK DATA below plus the product brief. Do not invent speakers, scores, emails, or meetings.
- If the data does not contain the answer, say so clearly and suggest Analyze conference or which desk view to check.
- Prefer concise, operator-friendly answers. Use bullet lists for rankings or comparisons.
- Cite speaker names, tiers, scores, and evidence labels when relevant.
- Never invent personal contact emails; demo mail may use a team inbox.`;

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

export function buildDeskChatSystemPrompt(context: ChatRequest["context"]): string {
  const payload = {
    selectedConference: context.selectedConference ?? null,
    stats: context.stats ?? null,
    conferences: context.conferences,
    leads: context.leads.map((lead) => ({
      ...lead,
      scoreReason: lead.scoreReason
        ? truncate(lead.scoreReason, 280)
        : undefined,
      evidence: (lead.evidence ?? []).slice(0, 3).map((item) => ({
        label: item.label,
        excerpt: truncate(item.excerpt, 180),
      })),
    })),
    funnel: context.funnel ?? null,
    sequenceSteps: context.sequenceSteps ?? [],
    drafts: (context.drafts ?? []).map((draft) => ({
      anchor: draft.anchor,
      subject: draft.subject,
      body: truncate(draft.body, 600),
    })),
  };

  return `${PRODUCT_BRIEF}

${RULES}

DESK DATA (JSON):
${JSON.stringify(payload)}`;
}

export async function answerDeskChat(
  messages: ChatTurn[],
  context: ChatRequest["context"],
): Promise<{ answer: string; enabled: boolean; model?: string }> {
  const enabled = isOpenAiEnabled();
  if (!enabled) {
    return {
      enabled: false,
      answer:
        "OpenAI is not configured on this server (missing OPENAI_API_KEY). Add the key to enable the desk assistant.",
    };
  }

  const system = buildDeskChatSystemPrompt(context);
  // Keep recent turns only; the latest user message is always included.
  const recent = messages.slice(-12);
  const answer = await chatText(system, recent);
  if (!answer) {
    return {
      enabled: true,
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      answer:
        "I couldn't reach OpenAI just now. Try again in a moment, or check Speakers / Funnel for the raw desk data.",
    };
  }

  return {
    enabled: true,
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    answer,
  };
}
