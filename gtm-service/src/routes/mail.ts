import type { FastifyInstance } from "fastify";
import { env } from "../config/env.js";
import { isRealSendMode, isSmtpConfigured, sendEmail } from "../mail/smtp.js";

export async function mailRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/mail/status",
    {
      schema: {
        summary: "SMTP configuration status",
        tags: ["mail"],
      },
    },
    async () => ({
      smtpConfigured: isSmtpConfigured(),
      sendMode: env.sendMode,
      senderEmail: env.senderEmail || env.smtpUser || null,
      smtpHost: env.smtpHost,
    }),
  );

  app.post(
    "/mail/test",
    {
      schema: {
        summary: "Send a test email via SMTP",
        tags: ["mail"],
        body: {
          type: "object",
          properties: {
            to: {
              type: "string",
              description: "Recipient. Defaults to TEST_TO_EMAIL / SMTP_FROM.",
            },
          },
        },
      },
    },
    async (req, reply) => {
      const body = (req.body ?? {}) as { to?: string };
      const to =
        body.to?.trim() ||
        env.testToEmail ||
        env.senderEmail ||
        env.smtpUser ||
        "";

      if (!to) {
        return reply.status(400).send({
          error:
            'Provide "to" in the body, or set TEST_TO_EMAIL / SENDER_EMAIL in .env.',
        });
      }

      if (isRealSendMode() && !isSmtpConfigured()) {
        return reply.status(503).send({
          error:
            "SMTP is not configured. Set SMTP_USER and SMTP_PASSWORD in .env.",
        });
      }

      try {
        const result = await sendEmail({
          to,
          subject: "SMTP test – Speaker Signal GTM",
          text:
            "This is a test email from the Speaker Signal GTM backend. SMTP is working.",
          html:
            "<p>This is a test email from the <strong>Speaker Signal</strong> GTM backend.</p>" +
            "<p>SMTP is working.</p>",
        });
        return reply.status(200).send({ ok: true, to, mode: result.mode });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return reply.status(500).send({ error: `Failed to send: ${message}` });
      }
    },
  );
}
