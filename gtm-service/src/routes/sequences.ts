import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import {
  getSequence,
  getSequenceByLeadId,
  listSequences,
  patchSequenceStep,
  saveSequence,
} from "../db/mongo.js";
import {
  attachDraftSubjects,
  draftSequenceEmails,
  generateSequence,
} from "../pipeline/sequence.js";
import {
  PatchStepSchema,
  SequenceRequestSchema,
  type SequenceRecord,
} from "../schemas/gtm.js";

function sequencePayload(record: SequenceRecord) {
  return {
    id: record.id,
    leadId: record.leadId,
    lead: record.lead,
    conference: record.conference,
    steps: record.steps,
    drafts: record.drafts,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export async function sequenceRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/sequences",
    {
      schema: {
        summary: "Generate and persist an event-anchored outreach sequence",
        tags: ["gtm"],
        body: {
          type: "object",
          additionalProperties: true,
          required: ["lead", "conference"],
          properties: {
            lead: { type: "object", additionalProperties: true },
            conference: { type: "object", additionalProperties: true },
            now: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = SequenceRequestSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.issues[0]?.message ?? "Invalid request.",
        });
      }

      const { lead, conference, now: nowIso } = parsed.data;
      const start = new Date(conference.startDate);
      if (Number.isNaN(start.getTime())) {
        return reply
          .status(400)
          .send({ error: "conference.startDate must be a valid date." });
      }
      const now = nowIso ? new Date(nowIso) : new Date();
      if (Number.isNaN(now.getTime())) {
        return reply.status(400).send({ error: "Invalid `now` timestamp." });
      }

      try {
        // Prefer an already-imported Agent 3 / persisted sequence for this lead.
        const existing = await getSequenceByLeadId(lead.id);
        if (existing?.steps?.length) {
          return reply.status(200).send(sequencePayload(existing));
        }

        const steps = generateSequence(lead, conference, now);
        const drafts = await draftSequenceEmails(lead, conference, steps);
        const withSubjects = attachDraftSubjects(steps, drafts);
        const stamp = new Date().toISOString();
        const record: SequenceRecord = {
          id: randomUUID(),
          leadId: lead.id,
          lead,
          conference,
          steps: withSubjects,
          drafts,
          createdAt: stamp,
          updatedAt: stamp,
        };
        await saveSequence(record);
        return reply.status(200).send(sequencePayload(record));
      } catch (error) {
        return reply.status(502).send({
          error:
            error instanceof Error
              ? error.message
              : "Sequence generation failed.",
        });
      }
    },
  );

  app.get(
    "/sequences",
    {
      schema: {
        summary: "List persisted sequences (Agent 3 + dashboard shapes)",
        tags: ["gtm"],
      },
    },
    async (_request, reply) => {
      const sequences = await listSequences();
      return reply.status(200).send({
        sequences: sequences.map(sequencePayload),
      });
    },
  );

  app.get(
    "/sequences/by-lead/:leadId",
    {
      schema: {
        summary: "Get a sequence by lead / speaker id",
        tags: ["gtm"],
      },
    },
    async (request, reply) => {
      const { leadId } = request.params as { leadId: string };
      const sequence = await getSequenceByLeadId(leadId);
      if (!sequence) {
        return reply.status(404).send({ error: "Sequence not found." });
      }
      return reply.status(200).send(sequencePayload(sequence));
    },
  );

  app.get(
    "/sequences/:id",
    {
      schema: {
        summary: "Get a sequence by id",
        tags: ["gtm"],
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const sequence = await getSequence(id);
      if (!sequence) {
        return reply.status(404).send({ error: "Sequence not found." });
      }
      return reply.status(200).send(sequencePayload(sequence));
    },
  );

  app.patch(
    "/sequences/:id/steps/:stepId",
    {
      schema: {
        summary: "Update a sequence step status or subject",
        tags: ["gtm"],
        body: {
          type: "object",
          additionalProperties: false,
          properties: {
            status: {
              type: "string",
              enum: ["Sent", "Scheduled", "Planned", "Opportunity"],
            },
            subject: { type: ["string", "null"] },
          },
        },
      },
    },
    async (request, reply) => {
      const { id, stepId } = request.params as { id: string; stepId: string };
      const parsed = PatchStepSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.issues[0]?.message ?? "Invalid patch.",
        });
      }
      if (
        parsed.data.status === undefined &&
        parsed.data.subject === undefined
      ) {
        return reply
          .status(400)
          .send({ error: "Provide status and/or subject." });
      }

      const updated = await patchSequenceStep(id, stepId, parsed.data);
      if (!updated) {
        return reply.status(404).send({ error: "Sequence or step not found." });
      }
      return reply.status(200).send(sequencePayload(updated));
    },
  );
}
