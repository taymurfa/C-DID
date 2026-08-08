import { NextResponse } from "next/server";
import { AnalyzeRequestSchema, AnalyzeResponseSchema } from "@/lib/contracts";
import { scrapePublicPage } from "@/lib/firecrawl";

function isBlockedHost(hostname: string) {
  return hostname === "localhost" || hostname.endsWith(".local") || /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname);
}

export async function POST(request: Request) {
  const parsed = AnalyzeRequestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid public conference URL." }, { status: 400 });
  }

  if (parsed.data.demoMode) {
    return NextResponse.json(
      { error: "Demo mode is disabled. Provide a real public conference URL." },
      { status: 400 },
    );
  }

  const target = new URL(parsed.data.url);
  if (!/^https?:$/.test(target.protocol) || isBlockedHost(target.hostname)) {
    return NextResponse.json({ error: "Only public HTTP(S) conference pages are allowed." }, { status: 400 });
  }

  try {
    const document = await scrapePublicPage(target.href);
    if (!document) {
      return NextResponse.json(
        { error: "Could not fetch the conference page. Check FIRECRAWL_API_KEY and try again." },
        { status: 502 },
      );
    }
    const markdown = document.markdown ?? "";
    const signalMatches =
      markdown.match(/speaker|agenda|session|power|energy|infrastructure/gi)?.length ?? 0;
    const title = document.metadata?.title || `${target.hostname} conference intelligence`;
    const excerpt = markdown.slice(0, 180) || "Public conference page";
    const response = AnalyzeResponseSchema.parse({
      sourceUrl: target.href,
      mode: "live",
      pageTitle: title,
      message:
        "Public page fetched through Firecrawl. Evidence is ready for structured extraction and scoring.",
      pagesProcessed: 1,
      entitiesExtracted: Math.max(1, Math.min(signalMatches, 24)),
      speaker: {
        id: `live-${Date.now()}`,
        name: "Pending extraction",
        title: "See full ingest for speakers",
        company: target.hostname,
        conference: title,
        session: null,
        score: 0,
        tier: "D",
        scoreReason: "Preview only — run Analyze/Qualify for ranked leads.",
        confidence: 0.5,
        scoreBreakdown: {
          roleFit: 0,
          companyFit: 0,
          topicRelevance: 0,
          seniority: 0,
          buyingInfluence: 0,
          eventProximity: 0,
        },
        evidence: [
          {
            label: "Live conference page",
            excerpt,
            sourceUrl: target.href,
            confidence: 0.8,
          },
        ],
        outreachStage: "Identified",
      },
    });
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Conference analysis failed." },
      { status: 502 },
    );
  }
}
