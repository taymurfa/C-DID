import type { FastifyInstance } from "fastify";
import { env } from "../config/env.js";
import { isRealSendMode, isSmtpConfigured, sendEmail } from "../mail/smtp.js";

function teamInbox(): string {
  return (
    env.testToEmail ||
    env.senderEmail ||
    env.smtpUser ||
    ""
  );
}

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
      /** True only when SMTP can deliver. Sequences never auto-send. */
      canSendDemo: isRealSendMode() && isSmtpConfigured(),
      draftOnly: !isRealSendMode(),
      teamInbox: teamInbox() || null,
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
      const to = body.to?.trim() || teamInbox();

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
          subject: "SMTP test – GridConnects GTM",
          text:
            "This is a test email from the GridConnects GTM backend. SMTP is working.",
          html:
            "<p>This is a test email from the <strong>GridConnects</strong> GTM backend.</p>" +
            "<p>SMTP is working.</p>",
        });
        return reply.status(200).send({ ok: true, to, mode: result.mode });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return reply.status(500).send({ error: `Failed to send: ${message}` });
      }
    },
  );

  /**
   * Demo-only delivery: always routes to TEST_TO_EMAIL (the team inbox).
   * Never emails the lead. No sequence auto-send — this is an explicit click.
   * When SEND_MODE=mock (Render), logs only and returns mode "mock".
   */
  app.post(
    "/mail/send-demo",
    {
      schema: {
        summary: "Send a sequence draft to the team inbox (demo only)",
        tags: ["mail"],
        body: {
          type: "object",
          required: ["subject", "body"],
          properties: {
            subject: { type: "string" },
            body: { type: "string" },
            leadName: { type: "string" },
            company: { type: "string" },
            conference: { type: "string" },
            anchor: { type: "string" },
          },
        },
      },
    },
    async (req, reply) => {
      const body = (req.body ?? {}) as {
        subject?: string;
        body?: string;
        leadName?: string;
        company?: string;
        conference?: string;
        anchor?: string;
      };

      const subject = body.subject?.trim() || "";
      const text = body.body?.trim() || "";
      if (!subject || !text) {
        return reply.status(400).send({
          error: 'Provide non-empty "subject" and "body".',
        });
      }

      const to = teamInbox();
      if (!to) {
        return reply.status(400).send({
          error: "Set TEST_TO_EMAIL (team inbox) in .env.",
        });
      }

      if (isRealSendMode() && !isSmtpConfigured()) {
        return reply.status(503).send({
          error:
            "SMTP is not configured. Set SMTP_USER and SMTP_PASSWORD in .env.",
        });
      }

      const leadLine = [
        body.leadName?.trim(),
        body.company?.trim(),
        body.conference?.trim(),
        body.anchor?.trim(),
      ]
        .filter(Boolean)
        .join(" · ");

      const banner =
        "[GridConnects demo] Delivered to the team inbox only — not the lead.\n" +
        (leadLine ? `Context: ${leadLine}\n\n` : "\n");

      try {
        const result = await sendEmail({
          to,
          subject: `[Demo] ${subject}`,
          text: `${banner}${text}`,
          html:
            `<p><em>GridConnects demo — team inbox only (not the lead).</em></p>` +
            (leadLine ? `<p><strong>Context:</strong> ${escapeHtml(leadLine)}</p>` : "") +
            `<pre style="font-family:inherit;white-space:pre-wrap">${escapeHtml(text)}</pre>`,
        });
        return reply.status(200).send({
          ok: true,
          to,
          mode: result.mode,
          draftOnly: result.mode === "mock",
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return reply.status(500).send({ error: `Failed to send: ${message}` });
      }
    },
  );
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
