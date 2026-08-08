type FirecrawlDocument = {
  markdown?: string;
  metadata?: { title?: string; sourceURL?: string; statusCode?: number };
};

type FirecrawlResponse = {
  success: boolean;
  data?: FirecrawlDocument;
  error?: string;
};

export async function scrapePublicPage(url: string): Promise<FirecrawlDocument | null> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) return null;

  const response = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      formats: ["markdown"],
      onlyMainContent: true,
      removeBase64Images: true,
      timeout: 30000,
    }),
    signal: AbortSignal.timeout(35_000),
  });

  const payload = (await response.json()) as FirecrawlResponse;
  if (!response.ok || !payload.success || !payload.data) {
    throw new Error(payload.error || `Firecrawl returned ${response.status}`);
  }

  return payload.data;
}
