import { NextResponse } from "next/server";
import { ChatRequestSchema } from "@/lib/contracts";
import { answerDeskChat } from "@/lib/pipeline/desk-chat";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = ChatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid chat request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const last = parsed.data.messages[parsed.data.messages.length - 1];
  if (!last || last.role !== "user") {
    return NextResponse.json(
      { error: "Last message must be from the user" },
      { status: 400 },
    );
  }

  const result = await answerDeskChat(parsed.data.messages, parsed.data.context);
  return NextResponse.json(result);
}
