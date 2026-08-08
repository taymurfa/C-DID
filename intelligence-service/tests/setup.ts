// Ensure tests are hermetic: never load the repo-root .env and never hit
// OpenAI or MongoDB. This runs before any source module (and thus env.ts) is
// imported, so the config picks up these values.
process.env.ENV_FILE = "___tests_no_env_file___";
delete process.env.OPENAI_API_KEY;
delete process.env.MONGODB_URI;
