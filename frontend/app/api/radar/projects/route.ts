import { radarScoreApiUrl } from "@/lib/radar-agents";

export async function GET() {
  try {
    const res = await fetch(`${radarScoreApiUrl()}/projects`, {
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    return Response.json(data, { status: res.status });
  } catch (err) {
    return Response.json(
      {
        error: "radar projects unreachable",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }
}
