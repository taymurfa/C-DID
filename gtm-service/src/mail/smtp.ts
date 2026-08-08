import nodemailer from "nodemailer";
import { env } from "../config/env.js";

export function isSmtpConfigured(): boolean {
  return Boolean(env.smtpUser && env.smtpPassword);
}

export function isRealSendMode(): boolean {
  return env.sendMode === "real";
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<{ mode: "real" | "mock" }> {
  const to = opts.to.trim();
  if (!to) throw new Error("Missing recipient address");

  if (!isRealSendMode()) {
    console.log(`[mail:mock] would send → ${to} | ${opts.subject}`);
    return { mode: "mock" };
  }

  if (!isSmtpConfigured()) {
    throw new Error(
      "SEND_MODE=real but SMTP is not configured. Set SMTP_USER and SMTP_PASSWORD.",
    );
  }

  const transporter = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpPort === 465,
    auth: {
      user: env.smtpUser,
      pass: env.smtpPassword,
    },
  });

  const fromName = env.senderName;
  const fromEmail = env.senderEmail || env.smtpUser!;

  await transporter.sendMail({
    from: fromName ? `${fromName} <${fromEmail}>` : fromEmail,
    to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
  });

  console.log(`[mail:real] sent → ${to} | ${opts.subject}`);
  return { mode: "real" };
}
