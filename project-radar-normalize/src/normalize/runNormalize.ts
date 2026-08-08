import { createHash } from "node:crypto";
import { v4 as uuid } from "uuid";
import type {
  CanonicalProject,
  NormalizeRequest,
  NormalizeResult,
  RawRecord,
} from "../schemas/project.js";

/** Prefer ERCOT name when present; else longest name. */
function pickCanonicalName(records: RawRecord[]): string {
  const ercot = records.find((r) => r.source === "ercot_gis");
  if (ercot) return ercot.name;
  return [...records].sort((a, b) => b.name.length - a.name.length)[0]!.name;
}

function pickPrimaryOwner(records: RawRecord[]): string {
  const ercot = records.find((r) => r.source === "ercot_gis");
  if (ercot) return ercot.owner;
  return records[0]!.owner;
}

function avg(nums: number[]): number | undefined {
  if (!nums.length) return undefined;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function groupKey(record: RawRecord): string {
  if (record.clusterId) return `cluster:${record.clusterId}`;
  // Soft match: same county + similar MW + same fuel when no explicit cluster
  const mwBucket = Math.round(record.mw / 25) * 25;
  const county = (record.county ?? "unk").toLowerCase();
  return `soft:${record.fuel}:${county}:${mwBucket}`;
}

function toCanonical(records: RawRecord[]): CanonicalProject {
  const aliases = [...new Set(records.map((r) => r.name))];
  const owners = [...new Set(records.map((r) => r.owner))];
  const sources = records.map((r) => ({
    source: r.source,
    sourceId: r.sourceId,
    recordId: r.id,
    name: r.name,
    milestone: r.milestone,
    evidence: r.evidence,
  }));
  const hardEr = Boolean(records[0]?.clusterId?.startsWith("er-hard"));

  const name = pickCanonicalName(records);
  const hash = createHash("sha1")
    .update(records[0]?.clusterId ?? name)
    .digest("hex")
    .slice(0, 10);

  const lats = records.map((r) => r.lat).filter((n): n is number => n != null);
  const lons = records.map((r) => r.lon).filter((n): n is number => n != null);
  const mws = records.map((r) => r.mw);

  return {
    canonicalId: `proj_${hash}`,
    name,
    aliases,
    owners,
    primaryOwner: pickPrimaryOwner(records),
    fuel: records.find((r) => r.source === "ercot_gis")?.fuel ?? records[0]!.fuel,
    mw: Math.max(...mws),
    county: records.find((r) => r.county)?.county,
    zone: records.find((r) => r.zone)?.zone,
    lat: avg(lats),
    lon: avg(lons),
    codYear: records.find((r) => r.codYear)?.codYear,
    sources,
    hardEr,
    clusterId: records.find((r) => r.clusterId)?.clusterId,
  };
}

/**
 * Entity resolution:
 * 1. Explicit clusterId (hard ER fixtures)
 * 2. Soft key: fuel + county + MW bucket
 */
export function runNormalize(req: NormalizeRequest): NormalizeResult {
  const groups = new Map<string, RawRecord[]>();
  for (const record of req.records) {
    const key = groupKey(record);
    const list = groups.get(key) ?? [];
    list.push(record);
    groups.set(key, list);
  }

  // Merge soft groups that share an owner token across sources when MW close
  // (already handled by clusterId for hard cases).

  const projects = [...groups.values()].map(toCanonical);
  projects.sort((a, b) => {
    if (a.hardEr !== b.hardEr) return a.hardEr ? -1 : 1;
    return b.sources.length - a.sources.length || b.mw - a.mw;
  });

  return {
    normalizeId: uuid(),
    runId: req.runId,
    createdAt: new Date().toISOString(),
    inputCount: req.records.length,
    projectCount: projects.length,
    projects,
  };
}
