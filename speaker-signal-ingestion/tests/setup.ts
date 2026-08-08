// Ensure tests are hermetic: never load the repo-root .env and never hit
// OpenAI or MongoDB. This runs before any source module (and thus env.ts) is
// imported, so the config picks up these values.
process.env.ENV_FILE = "___tests_no_env_file___";
delete process.env.OPENAI_API_KEY;
delete process.env.MONGODB_URI;
// Keep retry backoff tiny so retry tests stay fast.
process.env.CRAWL_RETRY_BASE_MS = process.env.CRAWL_RETRY_BASE_MS ?? "1";
// Auto-ingestion fires background runs on discovery; disable it by default so
// route/agent tests stay hermetic. The auto-ingest test opts back in explicitly.
process.env.AUTO_INGEST_ENABLED = process.env.AUTO_INGEST_ENABLED ?? "false";
// The Agent 2 hand-off makes a network call; disable by default in tests. The
// hand-off test opts back in explicitly with a mocked fetch.
process.env.HANDOFF_ENABLED = process.env.HANDOFF_ENABLED ?? "false";
