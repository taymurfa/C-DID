// Keep the pipeline tests deterministic: never call OpenAI. The pipeline falls
// back to deterministic ICP scoring when no key is present.
delete process.env.OPENAI_API_KEY;
