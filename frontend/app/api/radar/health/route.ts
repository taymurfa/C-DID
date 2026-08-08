import {
  radarIngestApiUrl,
  radarNormalizeApiUrl,
  radarScoreApiUrl,
} from "@/lib/radar-agents";

export async function GET() {
  const targets = [
    { name: "ingest", url: `${radarIngestApiUrl()}/health` },
    { name: "normalize", url: `${radarNormalizeApiUrl()}/health` },
    { name: "score", url: `${radarScoreApiUrl()}/health` },
  ] as const;

  const agents = await Promise.all(
    targets.map(async ({ name, url }) => {
      try {
        const res = await fetch(url, { cache: "no-store" });
        const body = (await res.json().catch(() => ({}))) as {
          status?: string;
          mongo?: string;
        };
        return {
          name,
          ok: res.ok,
          status: body.status ?? (res.ok ? "ok" : "down"),
          mongo: body.mongo,
        };
      } catch {
        return { name, ok: false, status: "down" as const };
      }
    }),
  );

  const ok = agents.every((a) => a.ok);
  return Response.json(
    { ok, agents },
    { status: ok ? 200 : 503 },
  );
}
