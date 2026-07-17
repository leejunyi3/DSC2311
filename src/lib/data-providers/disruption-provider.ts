/**
 * Maritime disruption provider (§11) — LIVE via reputable maritime-news RSS.
 *
 * We aggregate keyless RSS feeds from established shipping-news outlets
 * (gCaptain, Splash247, The Loadstar), keep only disruption-type items, and map
 * each to the Disruption shape. Severity and Tuas relevance are DERIVED
 * heuristically — each item is a NEWS ARTICLE, not a confirmed incident (§11:
 * "Do not treat every article mentioning Singapore as an active incident").
 * Global items get low relevance so they contribute little to risk; Singapore /
 * Malacca / Tuas items rank first. Results cache for 10 minutes.
 *
 * (GDELT was the original source but its API host is unreachable from some
 * networks; RSS is more reliable and needs no key.)
 */

import type { Disruption, DisruptionSeverity } from "@/types";
import { cacheGet, cacheSet } from "@/lib/cache/memory-cache";

const CACHE_KEY = "disruptions:rss";
const CACHE_TTL_SECONDS = 600;

const FEEDS: ReadonlyArray<{ name: string; url: string }> = [
  { name: "gCaptain", url: "https://gcaptain.com/feed/" },
  { name: "Splash247", url: "https://splash247.com/feed/" },
  { name: "The Loadstar", url: "https://theloadstar.com/feed/" },
];

// Keep only disruption/incident-type items.
const DISRUPTION_RE =
  /\b(disrupt|congest|delay|collision|closure|closed|blockage|blocked|grounding|grounded|accident|capsiz|sank|sunk|fire|explosion|attack|piracy|hijack|strike|shutdown|suspend|detain|backlog|diver(t|sion)|rerout|sanction|blockade|incident|breakdown|outage|typhoon|storm|cyclone)\b/i;

const HIGH_RE =
  /\b(collision|closure|closed|blockade|blockage|blocked|grounding|grounded|capsiz|sank|sunk|fire|explosion|attack|piracy|hijack|strike|shutdown|blockade)\b/i;
const MOD_RE =
  /\b(congest|delay|disrupt|backlog|incident|slowdown|diver(t|sion)|rerout|detain|breakdown|suspend|storm|typhoon|cyclone)\b/i;

function hashId(input: string): string {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `rss-${(h >>> 0).toString(36)}`;
}

function safeCodePoint(n: number): string {
  try {
    return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : "";
  } catch {
    return "";
  }
}

function clean(s: string): string {
  return s
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => safeCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => safeCodePoint(Number(n)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tag(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m ? m[1]! : "";
}

interface RawItem {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  source: string;
}

function parseRss(xml: string, source: string): RawItem[] {
  const items: RawItem[] = [];
  const blocks = xml.split(/<item[\s>]/i).slice(1);
  for (const raw of blocks) {
    const block = raw.split(/<\/item>/i)[0] ?? "";
    const title = clean(tag(block, "title"));
    if (!title) continue;
    items.push({
      title,
      link: clean(tag(block, "link")),
      pubDate: tag(block, "pubDate").trim(),
      description: clean(tag(block, "description")).slice(0, 400),
      source,
    });
  }
  return items;
}

function severityOf(text: string): DisruptionSeverity {
  if (HIGH_RE.test(text)) return "high";
  if (MOD_RE.test(text)) return "moderate";
  return "low";
}

function relevanceOf(text: string): {
  location: string;
  routeRelevance: number;
  locationRelevance: number;
} {
  const t = text.toLowerCase();
  if (t.includes("tuas"))
    return { location: "Tuas", routeRelevance: 0.7, locationRelevance: 0.95 };
  if (t.includes("malacca") || t.includes("melaka"))
    return { location: "Malacca Strait", routeRelevance: 0.9, locationRelevance: 0.75 };
  if (t.includes("singapore"))
    return { location: "Singapore", routeRelevance: 0.6, locationRelevance: 0.8 };
  if (/\b(strait|malaysia|indonesia|south china sea|asia|china|vietnam|hong kong)\b/.test(t))
    return { location: "Asia-Pacific", routeRelevance: 0.5, locationRelevance: 0.45 };
  return { location: "Global", routeRelevance: 0.35, locationRelevance: 0.25 };
}

const IMPACT: Record<DisruptionSeverity, { op: string; sc: string; resp: string }> = {
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

async function fetchFeed(url: string, signal?: AbortSignal): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort, { once: true });
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "tuas-resilience-control-tower/0.1 (student project)" },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`RSS ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

const SEV_ORDER: Record<DisruptionSeverity, number> = {
  critical: 3,
  high: 2,
  moderate: 1,
  low: 0,
};

export async function fetchLiveDisruptions(
  signal?: AbortSignal,
): Promise<Disruption[]> {
  const cached = cacheGet<Disruption[]>(CACHE_KEY);
  if (cached && !cached.expired) return cached.value;

  const settled = await Promise.allSettled(
    FEEDS.map(async (f) => ({ source: f.name, xml: await fetchFeed(f.url, signal) })),
  );

  const raw: RawItem[] = [];
  let anyOk = false;
  for (const r of settled) {
    if (r.status === "fulfilled") {
      anyOk = true;
      raw.push(...parseRss(r.value.xml, r.value.source));
    }
  }
  if (!anyOk) {
    throw new Error("All maritime news feeds unreachable.");
  }

  const retrievedAt = new Date().toISOString();
  const seen = new Set<string>();
  const disruptions: Disruption[] = [];

  for (const item of raw) {
    const text = `${item.title} ${item.description}`;
    if (!DISRUPTION_RE.test(text)) continue;

    const norm = item.title.toLowerCase().replace(/\s+/g, " ");
    if (seen.has(norm)) continue;
    seen.add(norm);

    const severity = severityOf(text);
    const { location, routeRelevance, locationRelevance } = relevanceOf(text);
    const impact = IMPACT[severity];
    const publishedAt = item.pubDate
      ? new Date(item.pubDate)
      : new Date();

    disruptions.push({
      id: hashId(item.link || item.title),
      title: item.title,
      event: severity === "high" ? "Maritime incident (news)" : "Maritime news signal",
      location,
      source: item.source,
      sourceCategory: "maritime-news (RSS)",
      publishedAt: Number.isNaN(publishedAt.getTime())
        ? retrievedAt
        : publishedAt.toISOString(),
      retrievedAt,
      summary: item.description || item.title,
      severity,
      routeRelevance,
      locationRelevance,
      sourceReliability: 0.65,
      supportingSources: 1,
      operationalImpact: impact.op,
      supplyChainImpact: impact.sc,
      suggestedResponse: impact.resp,
      confidence: 55,
      status: "LIVE",
      url: item.link || undefined,
      active: true,
    });
  }

  // Most relevant + most severe first; cap the list.
  disruptions.sort(
    (a, b) =>
      b.locationRelevance - a.locationRelevance ||
      SEV_ORDER[b.severity] - SEV_ORDER[a.severity],
  );
  const top = disruptions.slice(0, 12);

  cacheSet(CACHE_KEY, top, CACHE_TTL_SECONDS);
  return top;
}
