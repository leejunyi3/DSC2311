/**
 * Maritime disruption provider (§11) — LIVE via GDELT DOC 2.0.
 *
 * GDELT is a keyless, open global-news API. We query recent maritime news
 * relevant to Tuas / Singapore / the Malacca Strait and map each article to the
 * Disruption shape. GDELT returns only thin metadata (title, domain, date), so
 * severity, location and relevance are DERIVED heuristically and each item is
 * clearly a NEWS ARTICLE, not a confirmed incident (§11: "Do not treat every
 * article mentioning Singapore as an active incident"). Results are cached for
 * 10 minutes to respect GDELT's rate guidance.
 *
 * Docs: https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/
 */

import type { Disruption, DisruptionSeverity } from "@/types";
import { gdeltDocSchema } from "@/lib/schemas/providers";
import { safeFetchJson } from "@/lib/utils/fetch";
import { cacheGet, cacheSet } from "@/lib/cache/memory-cache";

const CACHE_KEY = "gdelt:disruptions";
const CACHE_TTL_SECONDS = 600;

const QUERY =
  '(Singapore OR Malacca OR Tuas OR "Singapore Strait") ' +
  "(port OR shipping OR vessel OR strait OR container OR cargo OR maritime) " +
  "(disruption OR congestion OR collision OR closure OR delay OR grounding OR accident OR blockage OR strike OR piracy)";

const GDELT_URL =
  "https://api.gdeltproject.org/api/v2/doc/doc?query=" +
  encodeURIComponent(QUERY) +
  "&mode=artlist&format=json&maxrecords=25&timespan=10d&sort=datedesc";

// Keep only clearly-maritime titles to avoid "every Singapore article" noise.
const MARITIME_RE =
  /\b(port|ship|shipping|vessel|strait|cargo|container|maritime|berth|tanker|freight|dock|terminal|tug|barge|anchorage|reefer)\b/i;

const HIGH_RE =
  /\b(collision|closure|closed|blockage|blocked|grounding|grounded|accident|capsiz|sank|sunk|fire|explosion|attack|piracy|hijack|strike|shutdown)\b/i;
const MOD_RE =
  /\b(congestion|delay|delayed|disruption|backlog|incident|slowdown|diversion|reroute|detained|breakdown)\b/i;

const RELIABLE_DOMAINS = new Set([
  "reuters.com",
  "bloomberg.com",
  "maritime-executive.com",
  "tradewindsnews.com",
  "lloydslist.com",
  "splash247.com",
  "gcaptain.com",
  "seatrade-maritime.com",
  "channelnewsasia.com",
  "straitstimes.com",
  "businesstimes.com.sg",
]);

function hashId(input: string): string {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `gdelt-${(h >>> 0).toString(36)}`;
}

/** GDELT seendate is "YYYYMMDDTHHMMSSZ". */
function parseSeenDate(s: string | undefined): string {
  if (!s) return new Date().toISOString();
  const m = s.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (!m) return new Date().toISOString();
  const [, y, mo, d, h, mi, se] = m;
  const iso = `${y}-${mo}-${d}T${h}:${mi}:${se}Z`;
  const t = new Date(iso);
  return Number.isNaN(t.getTime()) ? new Date().toISOString() : t.toISOString();
}

function severityOf(title: string): DisruptionSeverity {
  if (HIGH_RE.test(title)) return "high";
  if (MOD_RE.test(title)) return "moderate";
  return "low";
}

function relevanceOf(title: string): {
  location: string;
  routeRelevance: number;
  locationRelevance: number;
} {
  const t = title.toLowerCase();
  if (t.includes("tuas"))
    return { location: "Tuas", routeRelevance: 0.7, locationRelevance: 0.95 };
  if (t.includes("malacca") || t.includes("melaka"))
    return {
      location: "Malacca Strait",
      routeRelevance: 0.9,
      locationRelevance: 0.75,
    };
  if (t.includes("singapore strait"))
    return {
      location: "Singapore Strait",
      routeRelevance: 0.8,
      locationRelevance: 0.85,
    };
  if (t.includes("singapore"))
    return { location: "Singapore", routeRelevance: 0.6, locationRelevance: 0.8 };
  return { location: "Regional", routeRelevance: 0.45, locationRelevance: 0.4 };
}

const IMPACT: Record<
  DisruptionSeverity,
  { op: string; sc: string; resp: string }
> = {
  critical: {
    op: "Major route or port-level disruption reported — verify urgently with the operator.",
    sc: "Significant arrival delays likely; assess safety-stock and reroute options.",
    resp: "Escalate for human decision; prepare contingency for the affected route.",
  },
  high: {
    op: "Potential route or port-level impact — verify with the operator.",
    sc: "Possible arrival delays; review safety-stock exposure for affected lanes.",
    resp: "Monitor closely; prepare contingency for the affected route.",
  },
  moderate: {
    op: "Possible localized delays or slower handling.",
    sc: "Minor schedule risk; low inventory impact for well-stocked lines.",
    resp: "Continue monitoring; confirm actual status with the carrier.",
  },
  low: {
    op: "Low expected operational impact.",
    sc: "Minimal supply-chain effect.",
    resp: "Awareness only.",
  },
};

export async function fetchLiveDisruptions(
  signal?: AbortSignal,
): Promise<Disruption[]> {
  const cached = cacheGet<Disruption[]>(CACHE_KEY);
  if (cached && !cached.expired) return cached.value;

  const json = await safeFetchJson<unknown>(GDELT_URL, {
    // GDELT throttles rapid queries; a single attempt + the 10-min cache keeps
    // us well within its rate guidance (retrying a 429 only makes it worse).
    // Short-ish timeout so a slow/blocked GDELT doesn't hang the live dashboard.
    timeoutMs: 8000,
    retries: 0,
    headers: { "User-Agent": "tuas-resilience-control-tower/0.1 (student project)" },
    signal,
  });
  const parsed = gdeltDocSchema.parse(json);
  const retrievedAt = new Date().toISOString();

  const seenTitles = new Set<string>();
  const disruptions: Disruption[] = [];

  for (const a of parsed.articles) {
    const title = a.title.trim();
    if (!title || !MARITIME_RE.test(title)) continue;

    const norm = title.toLowerCase().replace(/\s+/g, " ");
    if (seenTitles.has(norm)) continue;
    seenTitles.add(norm);

    const severity = severityOf(title);
    const { location, routeRelevance, locationRelevance } = relevanceOf(title);
    const domain = a.domain ?? "news";
    const reliable = RELIABLE_DOMAINS.has(domain);
    const impact = IMPACT[severity];

    disruptions.push({
      id: hashId(a.url),
      title,
      event: severity === "high" ? "Maritime incident (news)" : "Maritime news signal",
      location,
      source: domain,
      sourceCategory: "maritime-news (GDELT)",
      publishedAt: parseSeenDate(a.seendate),
      retrievedAt,
      summary: title,
      severity,
      routeRelevance,
      locationRelevance,
      sourceReliability: reliable ? 0.7 : 0.5,
      supportingSources: 1,
      operationalImpact: impact.op,
      supplyChainImpact: impact.sc,
      suggestedResponse: impact.resp,
      confidence: reliable ? 55 : 45,
      status: "LIVE",
      url: a.url,
      active: true,
    });

    if (disruptions.length >= 10) break;
  }

  // Worst / most-relevant first.
  const order: Record<DisruptionSeverity, number> = {
    critical: 3,
    high: 2,
    moderate: 1,
    low: 0,
  };
  disruptions.sort(
    (x, y) =>
      order[y.severity] - order[x.severity] ||
      y.locationRelevance - x.locationRelevance,
  );

  cacheSet(CACHE_KEY, disruptions, CACHE_TTL_SECONDS);
  return disruptions;
}
