import { NextResponse } from "next/server";
import { demoProjects, projectRadarSourceCount } from "@/lib/project-radar-data";
import {
  ProjectRefreshRequestSchema,
  ProjectRefreshResponseSchema,
  projectFromDocument,
  resolveProjects,
} from "@/lib/project-radar";
import { scrapePublicPage } from "@/lib/firecrawl";

function isBlockedHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname.endsWith(".local") ||
    /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname)
  );
}

function demoResponse() {
  return ProjectRefreshResponseSchema.parse({
    mode: "demo",
    refreshedAt: new Date().toISOString(),
    sourceCount: projectRadarSourceCount,
    projects: demoProjects,
  });
}

export async function GET() {
  return NextResponse.json(demoResponse());
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = ProjectRefreshRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid refresh request." },
      { status: 400 },
    );
  }

  if (parsed.data.demoMode) return NextResponse.json(demoResponse());

  const sourceUrls = parsed.data.sourceUrls ?? [];
  const blocked = sourceUrls.find((value) => {
    const target = new URL(value);
    return !/^https?:$/.test(target.protocol) || isBlockedHost(target.hostname);
  });
  if (blocked) {
    return NextResponse.json(
      { error: "Only public HTTP(S) project-source pages are allowed." },
      { status: 400 },
    );
  }

  try {
    const documents = await Promise.all(
      sourceUrls.map(async (sourceUrl) => {
        const document = await scrapePublicPage(sourceUrl);
        if (!document) {
          throw new Error("Live Project Radar requires FIRECRAWL_API_KEY. Demo mode remains available without credentials.");
        }
        return projectFromDocument({
          url: sourceUrl,
          title: document.metadata?.title,
          markdown: document.markdown ?? "",
        });
      }),
    );

    const projects = resolveProjects(documents);
    const response = ProjectRefreshResponseSchema.parse({
      mode: "live",
      refreshedAt: new Date().toISOString(),
      sourceCount: sourceUrls.length,
      projects,
    });
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Project refresh failed." },
      { status: 502 },
    );
  }
}
