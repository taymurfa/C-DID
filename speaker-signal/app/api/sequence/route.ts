import { NextResponse } from "next/server";
import {
  SequenceRequestSchema,
  SequenceResponseSchema,
} from "@/lib/contracts";
import {
  attachDraftSubjects,
  draftSequenceEmails,
  generateSequence,
} from "@/lib/pipeline/sequence";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = SequenceRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }

  const { lead, conference, now: nowIso } = parsed.data;

  try {
    const start = new Date(conference.startDate);
    if (Number.isNaN(start.getTime())) {
      return NextResponse.json(
        { error: "conference.startDate must be a valid date." },
        { status: 400 },
      );
    }

    const now = nowIso ? new Date(nowIso) : new Date();
    if (Number.isNaN(now.getTime())) {
      return NextResponse.json({ error: "Invalid `now` timestamp." }, { status: 400 });
    }

    const steps = generateSequence(lead, conference, now);
    const drafts = await draftSequenceEmails(lead, conference, steps);
    const withSubjects = attachDraftSubjects(steps, drafts);

    const response = SequenceResponseSchema.parse({
      steps: withSubjects,
      drafts,
    });
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Sequence generation failed.",
      },
      { status: 502 },
    );
  }
}
