// Force deterministic drafts in unit tests even if a shared .env has a key.
// Use empty string (not delete) so dotenv won't override with the real key.
process.env.OPENAI_API_KEY = "";
process.env.MONGODB_URI = "";
process.env.SEND_MODE = "mock";
process.env.SMTP_PASSWORD = "";
