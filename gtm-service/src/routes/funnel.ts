import type { FastifyInstance } from "fastify";
import { appendFunnelEvent, getFunnel } from "../db/mongo.js";
import { FunnelEventRequestSchema } from "../schemas/gtm.js";

export async function funnelRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/funnel/events",
    {
      schema: {
        summary: "Record a funnel stage change for a lead",
        tags: ["gtm"],
        body: {
          type: "object",
          additionalProperties: true,
          required: ["leadId", "status"],
          properties: {
            leadId: { type: "string" },
            status: { type: "string" },
            at: { type: "string" },
            conferenceName: { type: ["string", "null"] },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = FunnelEventRequestSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.issues[0]?.message ?? "Invalid request.",
        });
      }
      const event = await appendFunnelEvent(parsed.data);
      return reply.status(201).send({ event });
    },
  );

  app.get(
    "/funnel",
    {
      schema: {
        summary: "Compute the rolled-up outreach funnel from recorded events",
        tags: ["gtm"],
      },
    },
    async (_request, reply) => {
      const funnel = await getFunnel();
      return reply.status(200).send(funnel);
    },
  );
}
