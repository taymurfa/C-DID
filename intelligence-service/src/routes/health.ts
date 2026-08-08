import type { FastifyInstance } from "fastify";

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/health",
    {
      schema: {
        summary: "Liveness check",
        tags: ["system"],
        response: {
          200: {
            type: "object",
            required: ["service", "status"],
            properties: {
              service: { type: "string", example: "intelligence" },
              status: { type: "string", example: "ok" },
            },
          },
        },
      },
    },
    async () => ({ service: "intelligence", status: "ok" }),
  );
}
