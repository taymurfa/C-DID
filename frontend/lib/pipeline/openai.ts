import OpenAI from "openai";

let client: OpenAI | null = null;

export function isOpenAiEnabled(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

function getClient(): OpenAI | null {
  if (!isOpenAiEnabled()) return null;
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

/**
 * Ask the model for a JSON object. Returns `null` on any error (missing key,
 * network, bad JSON) so callers can fall back to deterministic logic and the
 * pipeline never fails because of the AI layer.
 */
export async function chatJson(
  system: string,
  user: string,
): Promise<unknown | null> {
  const openai = getClient();
  if (!openai) return null;
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  try {
    const completion = await openai.chat.completions.create({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    const content = completion.choices[0]?.message?.content;
    if (!content) return null;
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export type ChatTurn = { role: "user" | "assistant"; content: string };

/**
 * Conversational text completion. Returns `null` when OpenAI is disabled or
 * the request fails so the desk can show a clear fallback message.
 */
export async function chatText(
  system: string,
  messages: ChatTurn[],
  options?: { temperature?: number },
): Promise<string | null> {
  const openai = getClient();
  if (!openai) return null;
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  try {
    const completion = await openai.chat.completions.create({
      model,
      temperature: options?.temperature ?? 0.35,
      messages: [{ role: "system", content: system }, ...messages],
    });
    const content = completion.choices[0]?.message?.content?.trim();
    return content || null;
  } catch {
    return null;
  }
}
