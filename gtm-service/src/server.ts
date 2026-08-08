import { pathToFileURL } from "node:url";
import Fastify from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { env } from "./config/env.js";
import { closeMongo, connectMongo, isMongoConfigured } from "./db/mongo.js";
import { isOpenAiEnabled } from "./openai/openaiClient.js";
import { funnelRoutes } from "./routes/funnel.js";
import { healthRoutes } from "./routes/health.js";
import { mailRoutes } from "./routes/mail.js";
import { sequenceRoutes } from "./routes/sequences.js";
import { isRealSendMode, isSmtpConfigured } from "./mail/smtp.js";

export async function buildServer() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info",
    },
    ajv: {
      customOptions: { keywords: ["example"] },
    },
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: "Speaker Signal - GTM Service",
        description:
          "Event-anchored outreach sequences, draft emails, optional SMTP " +
          "delivery, and funnel persistence (Agent 3).",
        version: "0.1.0",
      },
      servers: [{ url: `http://localhost:${env.port}` }],
      tags: [
        { name: "gtm", description: "Sequences and funnel" },
        { name: "mail", description: "SMTP status and test send" },
        { name: "system", description: "Service health" },
      ],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: { docExpansion: "list", deepLinking: true },
  });

  await app.register(healthRoutes);
  await app.register(sequenceRoutes);
  await app.register(funnelRoutes);
  await app.register(mailRoutes);

  return app;
}

async function start() {
  const app = await buildServer();

  try {
    await connectMongo();
  } catch (err) {
    app.log.warn(
      { err },
      "MongoDB connection failed; continuing with in-memory persistence",
    );
  }

  app.log.info(
    {
      openai: isOpenAiEnabled()
        ? "enabled"
        : "disabled (template drafts)",
      mongo: isMongoConfigured() ? "configured" : "disabled (in-memory)",
      smtp: isSmtpConfigured()
        ? isRealSendMode()
          ? "real"
          : "configured (mock mode)"
        : "not configured",
    },
    "gtm service configuration",
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
