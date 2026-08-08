/**
 * One-shot SMTP test. Usage:
 *   npx tsx scripts/send-test-email.ts [to@example.com]
 *
 * Requires SEND_MODE=real and SMTP_USER/SMTP_PASSWORD in repo-root .env (Zoho).
 */
import { env } from "../src/config/env.js";
import { isSmtpConfigured, sendEmail } from "../src/mail/smtp.js";

async function main() {
  const to =
    process.argv[2]?.trim() ||
    env.testToEmail ||
    "faruquitaymur@gmail.com";

  console.log("SMTP test");
  console.log(`  SEND_MODE=${env.sendMode}`);
  console.log(`  SMTP_HOST=${env.smtpHost}:${env.smtpPort}`);
  console.log(`  SMTP_USER=${env.smtpUser}`);
  console.log(`  SMTP_FROM=${env.senderEmail}`);
  console.log(`  configured=${isSmtpConfigured()}`);
  console.log(`  to=${to}`);

  if (env.sendMode !== "real") {
    console.error("FAIL: Set SEND_MODE=real in .env to actually send.");
    process.exit(1);
  }
  if (!isSmtpConfigured()) {
    console.error(
      "FAIL: Set SMTP_USER and SMTP_PASSWORD (Zoho) in the repo-root .env.",
    );
    process.exit(1);
  }

  const result = await sendEmail({
    to,
    subject: "SMTP test – Speaker Signal GTM",
    text: "This is a test email from the Speaker Signal GTM backend. SMTP is working.",
    html:
      "<p>This is a test email from the <strong>Speaker Signal</strong> GTM backend.</p>" +
      "<p>SMTP is working.</p>",
  });
  console.log(`OK: sent (${result.mode}) → ${to}`);
}

main().catch((err) => {
  console.error("FAIL:", err instanceof Error ? err.message : err);
  process.exit(1);
});
