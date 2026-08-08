import OpenAI from "openai";
import { env } from "../config/env.js";

let client: OpenAI | null = null;

export function isOpenAiEnabled(): boolean {
  return Boolean(env.openaiApiKey);
}

function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({ apiKey: env.openaiApiKey });
  }
  return client;
}

/**
 * Call the chat model in JSON mode and return the parsed object, or null on any
 * failure. Never throws — callers fall back to deterministic templates.
 */
export async function chatJson(
  system: string,
  user: string,
  maxTokens = 2000,
): Promise<unknown | null> {
  if (!isOpenAiEnabled()) return null;
  try {
    const completion = await getClient().chat.completions.create(
      {
        model: env.openaiModel,
        temperature: 0.2,
        max_tokens: maxTokens,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      },
      { timeout: 20_000 },
    );
    const raw = completion.choices[0]?.message?.content;
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
