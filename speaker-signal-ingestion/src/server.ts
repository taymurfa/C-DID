import { pathToFileURL } from "node:url";
import Fastify from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { env } from "./config/env.js";
import { closeMongo, connectMongo, isMongoConfigured } from "./db/mongo.js";
import { isOpenAiEnabled } from "./extract/openaiExtractor.js";
import {
  isAutoIngestEnabled,
  setAutoIngestLogger,
} from "./ingest/autoIngestQueue.js";
import { autoIngestRoutes } from "./routes/autoIngest.js";
import { discoverRoutes } from "./routes/discover.js";
import { healthRoutes } from "./routes/health.js";
import { ingestRoutes } from "./routes/ingest.js";

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
        title: "Speaker Signal - Ingestion Service",
        description:
          "Conference URL -> discover pages -> fetch public content -> structured conference data.",
        version: "0.1.0",
      },
      servers: [{ url: `http://localhost:${env.port}` }],
      tags: [
        { name: "ingestion", description: "Conference ingestion" },
        { name: "discovery", description: "Conference discovery" },
        { name: "system", description: "Service health" },
      ],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: { docExpansion: "list", deepLinking: true },
  });

  await app.register(healthRoutes);
  await app.register(ingestRoutes);
  await app.register(discoverRoutes);
  await app.register(autoIngestRoutes);

  // Route the auto-ingest queue's background logs through Fastify's logger.
  setAutoIngestLogger(app.log);

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
      openai: isOpenAiEnabled() ? "enabled" : "disabled (deterministic parsing)",
      mongo: isMongoConfigured() ? "configured" : "disabled (no persistence)",
      autoIngest: isAutoIngestEnabled()
        ? "enabled (auto-ingest newly discovered conferences)"
        : "disabled",
    },
    "ingestion service configuration",
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
