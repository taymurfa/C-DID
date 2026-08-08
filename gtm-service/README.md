# GTM Service (Agent 3 — TypeScript)

Event-anchored outreach sequences, draft emails, optional **Gmail SMTP** delivery,
and funnel persistence for Speaker Signal (port **8003**).

## SMTP

Copy Zoho SMTP settings from `HackathonTemplate/backend/.env` into the repo-root `.env`:

```
SEND_MODE=real
SMTP_HOST=smtp.zoho.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASSWORD=...
SMTP_FROM=info@jobersteadt.com
TEST_TO_EMAIL=kirill.cheldishkin2105@gmail.com
```

Send a test email:

```bash
npx tsx scripts/send-test-email.ts kirill.cheldishkin2105@gmail.com
# or, with the service running:
curl -X POST http://localhost:8003/mail/test -H "content-type: application/json" -d "{\"to\":\"kirill.cheldishkin2105@gmail.com\"}"
```

`SEND_MODE=mock` (default) logs only and does not leave the machine.
