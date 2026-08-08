import { pathToFileURL } from "node:url";
import Fastify from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { env } from "./config/env.js";
import { closeMongo, connectMongo, isMongoConfigured } from "./db/mongo.js";
import { isOpenAiEnabled } from "./openai/openaiClient.js";
import { healthRoutes } from "./routes/health.js";
import { qualifyRoutes } from "./routes/qualify.js";

export async function buildServer() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info",
    },
    ajv: {
      // `example` is an OpenAPI annotation, not a JSON Schema keyword; register
      // it as a no-op so it can live alongside validation schemas.
      customOptions: { keywords: ["example"] },
    },
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: "Speaker Signal - Intelligence Service",
        description:
          "Raw scraped conference data -> normalized, deduplicated, ICP-scored, " +
          "ranked qualified leads with explanations (Agent 2).",
        version: "0.1.0",
      },
      servers: [{ url: `http://localhost:${env.port}` }],
      tags: [
        { name: "intelligence", description: "Lead qualification" },
        { name: "system", description: "Service health" },
      ],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: { docExpansion: "list", deepLinking: true },
  });

  await app.register(healthRoutes);
  await app.register(qualifyRoutes);

  return app;
}

async function start() {
  const app = await buildServer();

  try {
    await connectMongo();
  } catch (err) {
    app.log.warn(
      { err },
      "MongoDB connection failed; continuing without persistence",
    );
  }

  app.log.info(
    {
      openai: isOpenAiEnabled()
        ? "enabled"
        : "disabled (deterministic scoring)",
      mongo: isMongoConfigured() ? "configured" : "disabled (no persistence)",
    },
    "intelligence service configuration",
  );

  const close = async () => {
    await app.close();
    await closeMongo();
    process.exit(0);
  };
  process.on("SIGINT", close);
  process.on("SIGTERM", close);

  try {
    await app.listen({ port: env.port, host: env.host });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

// Only auto-start when run directly (not when imported by tests).
const isDirectRun =
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  void start();
}
