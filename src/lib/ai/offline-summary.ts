/**
 * Deterministic offline assistant summary. Used when ANTHROPIC_API_KEY is not
 * set so the assistant panel still gives a useful, data-grounded answer in Demo
 * Mode WITHOUT pretending to be Claude. It only restates figures the engines
 * already computed and is clearly labelled as an automated summary.
 */

import type { DashboardSnapshot } from "@/types/snapshot";

export function buildOfflineSummary(
  snapshot: DashboardSnapshot,
  userQuestion: string,
): string {
  const s = snapshot;
  const rec = s.simulation.options.find(
    (o) => o.kind === s.simulation.recommendedKind,
  );
  const alerts = s.disruptions.data ?? [];
  const congestion = s.congestion.data;

  const lines: string[] = [];
  lines.push(
    "_Automated offline summary (the AI assistant is disabled because no LLM API key is set). All figures below are computed deterministically and shown with their data classification._",
  );
  lines.push("");
  lines.push("## Current Situation");
  lines.push(
    `Mode **${s.mode.toUpperCase()}**, scenario **${s.scenarioName}**. Overall resilience risk is **${s.risk.overall} (${s.risk.category})**, change ${s.risk.delta ?? "n/a"} vs the previous reading. ${s.scenarioNarrative}`,
  );

  lines.push("");
  lines.push("## Supporting Evidence");
  lines.push(
    `- Top risk drivers: ${s.risk.drivers.map((d) => `${d.label} (+${d.contribution})`).join(", ")}.`,
  );
  if (congestion) {
    lines.push(
      `- Estimated Tuas Congestion: **${congestion.score} (${congestion.status})**. ${s.congestion.limitations[0] ?? ""} (${s.congestion.status}).`,
    );
  }
  lines.push(
    `- Data confidence: **${s.confidence.score} (${s.confidence.class})**, ${s.confidence.availableFeeds}/${s.confidence.totalFeeds} feeds available. ${s.confidence.mainLimitation}`,
  );

  lines.push("");
  lines.push("## Supply-Chain Impact");
  if (alerts.length > 0) {
    for (const a of alerts) {
      lines.push(`- [${a.severity}] ${a.event} @ ${a.location} — ${a.supplyChainImpact} (${a.status}).`);
    }
  } else {
    lines.push("- No active disruptions relevant to Tuas in this scenario.");
  }

  lines.push("");
  lines.push("## Options Considered");
  for (const o of s.simulation.options) {
    lines.push(
      `- **${o.label}** — delay ${o.inventory.effectiveDelayHours}h, coverage gap ${o.inventory.coverageGapDays}d, exposure ${o.inventory.inventoryExposureScore}, total scenario cost ${o.inventory.totalScenarioCost.toLocaleString()}, cold-chain ${o.inventory.coldChainExposure}.`,
    );
  }

  lines.push("");
  lines.push("## Recommended Action");
  lines.push(
    `${rec ? `**${rec.label}** — ${s.simulation.recommendationReason}` : "See simulator."}`,
  );

  lines.push("");
  lines.push("## Assumptions and Uncertainty");
  for (const l of s.limitations.slice(0, 6)) lines.push(`- ${l}`);

  lines.push("");
  lines.push("## Sources and Timestamps");
  for (const f of s.feeds) {
    lines.push(`- ${f.label}: ${f.status} — ${f.message}`);
  }
  lines.push(`- Snapshot generated: ${s.generatedAt}`);

  lines.push("");
  lines.push("## Human Decision Required");
  if (s.simulation.requiresHumanApproval) {
    lines.push("Human review and authorisation required before operational action.");
  } else {
    lines.push(
      "No high-impact action recommended; continue monitoring. A human planner retains the decision.",
    );
  }

  // Echo the question so the panel clearly ties the answer to it.
  lines.unshift(`> Question: ${userQuestion}`, "");

  return lines.join("\n");
}
