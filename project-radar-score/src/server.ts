import { pathToFileURL } from "node:url";
import Fastify from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { env } from "./config/env.js";
import { closeMongo, connectMongo, isMongoConfigured } from "./db/mongo.js";
import { healthRoutes } from "./routes/health.js";
import { scoreRoutes } from "./routes/score.js";

export async function buildServer() {
  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? "info" },
    ajv: { customOptions: { keywords: ["example"] } },
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: "Project Radar - Score (R3)",
        description: "Stage inference, ranking, and light people↔project join.",
        version: "0.1.0",
      },
      servers: [{ url: `http://localhost:${env.port}` }],
      tags: [
        { name: "radar", description: "Score + join" },
        { name: "system", description: "Service health" },
      ],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: { docExpansion: "list", deepLinking: true },
  });

  await app.register(healthRoutes);
  await app.register(scoreRoutes);

  return app;
}

async function start() {
  const app = await buildServer();

  try {
    await connectMongo();
  } catch (err) {
    app.log.warn({ err }, "MongoDB connection failed; continuing without persistence");
  }

  app.log.info(
    {
      mongo: isMongoConfigured() ? "configured" : "disabled (no persistence)",
    },
    "project-radar-score configuration",
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

const isDirectRun =
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  void start();
}
