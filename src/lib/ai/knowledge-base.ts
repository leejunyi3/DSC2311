/**
 * In-code institutional knowledge index backing the `search_institutional_knowledge`
 * tool. The canonical human-readable versions live in `src/knowledge/*.md`; these
 * entries are the searchable, deployment-safe copies (no filesystem access at
 * runtime). Keep the two in sync when policy changes.
 */

export interface KnowledgeEntry {
  id: string;
  title: string;
  tags: string[];
  content: string;
}

export const KNOWLEDGE_ENTRIES: KnowledgeEntry[] = [
  {
    id: "operating-principles",
    title: "Operating Principles (Project Policy)",
    tags: ["safety", "cold-chain", "reversible", "escalation", "authority"],
    content:
      "Human safety first. Pharmaceutical/medical cold-chain integrity before cost. Mission-critical cargo prioritised. Prefer reversible actions when evidence is weak. Escalate high-impact decisions. Explain trade-offs. Do not claim operational authority. High-impact recommendations require human authorisation.",
  },
  {
    id: "cargo-priority-policy",
    title: "Cargo Priority Policy (Project Policy)",
    tags: ["cargo", "priority", "pharmaceuticals", "perishables", "customer"],
    content:
      "Priority order: 1 human safety, 2 pharmaceutical/medical cold-chain, 3 mission-critical, 4 perishable, 5 high-priority customer commitments, 6 general cargo, 7 cost optimisation. This is a project policy, not official PSA policy.",
  },
  {
    id: "source-hierarchy",
    title: "Source Hierarchy",
    tags: ["sources", "conflict", "authority", "confidence"],
    content:
      "When sources conflict, prioritise: 1 government/maritime authority, 2 direct weather/sensor/AIS data, 3 official port/carrier notices, 4 established data providers, 5 reputable maritime reporting, 6 user assumptions, 7 simulated data. Never silently resolve a conflict; explain which sources conflict, which was weighted more, why, and how confidence was affected.",
  },
  {
    id: "risk-methodology",
    title: "Risk Methodology",
    tags: ["risk", "weather", "congestion", "disruption", "weights", "formula"],
    content:
      "Overall risk = weather 0.30 + estimated congestion 0.30 + maritime disruption 0.20 + cargo exposure 0.15 + data-quality penalty 0.05, clamped 0-100. Categories: 0-24 Low, 25-49 Moderate, 50-74 High, 75-100 Critical. Thresholds are project assumptions, not official shutdown limits.",
  },
  {
    id: "data-limitations",
    title: "Data Limitations",
    tags: ["psa", "berth", "crane", "queue", "waiting-time", "ais", "estimate"],
    content:
      "No confirmed access to official PSA berth occupancy, allocation, crane availability, yard capacity, queue length, waiting times or customs times. Never claim official PSA data. AIS density is an estimate, not official berth congestion. Estimated Tuas Congestion carries a required disclaimer.",
  },
  {
    id: "human-approval-policy",
    title: "Human Approval Policy (Project Policy)",
    tags: ["approval", "human", "reroute", "airfreight", "notify", "escalate"],
    content:
      "Rerouting, airfreight, emergency replenishment and customer notifications require explicit human authorisation. Reversible low-regret actions may be recommended more readily. Every high-impact recommendation ends with: Human review and authorisation required before operational action.",
  },
];

export interface KnowledgeSearchResult {
  entry: KnowledgeEntry;
  score: number;
}

/** Deterministic keyword search — no external calls, safe to run anywhere. */
export function searchKnowledge(
  query: string,
  limit = 3,
): KnowledgeSearchResult[] {
  const terms = query
    .toLowerCase()
    .split(/[^a-z0-9-]+/)
    .filter((t) => t.length > 2);

  const scored = KNOWLEDGE_ENTRIES.map((entry) => {
    const haystack =
      `${entry.title} ${entry.tags.join(" ")} ${entry.content}`.toLowerCase();
    let score = 0;
    for (const term of terms) {
      if (entry.tags.includes(term)) score += 3;
      else if (haystack.includes(term)) score += 1;
    }
    return { entry, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
