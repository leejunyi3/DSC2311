import type { ReactNode } from "react";
import {
  RISK_WEIGHTS,
  RISK_CATEGORY_THRESHOLDS,
  WEATHER_THRESHOLDS,
  CONGESTION_SUBWEIGHTS,
  CONGESTION_CONFIG,
  DISRUPTION_CONFIG,
} from "@/lib/risk/risk-config";
import { PROJECT_DISCLAIMER, CONGESTION_DISCLAIMER } from "@/lib/constants/geo";

export const metadata = { title: "Methodology — Tuas Resilience Control Tower" };

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card">
      <h2 className="mb-2 text-sm font-bold text-status-live">{title}</h2>
      <div className="space-y-1 text-sm text-slate-300">{children}</div>
    </section>
  );
}

export default function MethodologyPage() {
  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-lg font-bold text-white">Data Sources &amp; Methodology</h1>
      </div>

      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100">
        {PROJECT_DISCLAIMER}
      </div>

      <Section title="System architecture & data flow">
        <p>
          Browser → Next.js dashboard/chat → server API &amp; Claude tool orchestrator → normalised
          data-provider layer → weather / lightning / marine / AIS / disruption sources → cache &amp;
          deterministic risk engine → Claude explanation → human planner decision.
        </p>
        <p className="text-slate-400">
          All numbers are computed by deterministic TypeScript BEFORE Claude sees them. Claude explains
          the figures and compares options; it never invents or recomputes them.
        </p>
      </Section>

      <Section title="API sources">
        <ul className="list-inside list-disc text-slate-300">
          <li>Singapore weather — data.gov.sg (NEA) realtime readings, nearest station to Tuas.</li>
          <li>Marine forecast — Open-Meteo Marine (forecast only; not for navigation).</li>
          <li>Lightning — NEA Lightning Observation via data.gov.sg (keyless, ~2 min updates).</li>
          <li>AIS vessels — AISStream via a long-running collector, or deterministic demo data.</li>
          <li>Maritime disruptions — documented news/advisory source (disabled by default).</li>
        </ul>
      </Section>

      <Section title="Source hierarchy (conflict resolution)">
        <ol className="list-inside list-decimal text-slate-300">
          <li>Government / maritime authority information.</li>
          <li>Direct weather / sensor / AIS data.</li>
          <li>Official port or carrier notices.</li>
          <li>Established data providers.</li>
          <li>Reputable maritime reporting.</li>
          <li>User-entered assumptions.</li>
          <li>Simulated data.</li>
        </ol>
        <p className="text-slate-400">
          The assistant must never silently resolve a conflict — it states the conflict, which source it
          weighted more and why, reduces confidence, and flags HUMAN REVIEW REQUIRED.
        </p>
      </Section>

      <Section title="Risk formula & weights">
        <pre className="overflow-x-auto rounded bg-base-800 p-2 font-mono text-xs text-slate-300">
{`Overall Risk =
  Weather            × ${RISK_WEIGHTS.weather}
+ Estimated Congestion × ${RISK_WEIGHTS.congestion}
+ Maritime Disruption  × ${RISK_WEIGHTS.disruption}
+ Cargo Exposure       × ${RISK_WEIGHTS.cargo}
+ Data Quality Penalty × ${RISK_WEIGHTS.dataQuality}   (clamped 0–100)`}
        </pre>
        <p className="text-slate-400">
          Categories:{" "}
          {RISK_CATEGORY_THRESHOLDS.map((b) => `${b.category} ≤ ${b.max}`).join(", ")}.
        </p>
      </Section>

      <Section title="Weather thresholds (project assumptions)">
        <ul className="list-inside list-disc text-slate-300">
          <li>Rainfall: 0 → {WEATHER_THRESHOLDS.rainfallMmPerHr.high} mm/hr maps 0 → 100.</li>
          <li>Wind: {WEATHER_THRESHOLDS.windSpeedKnots.low} → {WEATHER_THRESHOLDS.windSpeedKnots.high} kt maps 0 → 100.</li>
          <li>Lightning: ≤ {WEATHER_THRESHOLDS.lightningNearestKm.dangerKm} km = 100, ≥ {WEATHER_THRESHOLDS.lightningNearestKm.safeKm} km = 0.</li>
          <li>Wave: {WEATHER_THRESHOLDS.waveHeightM.low} → {WEATHER_THRESHOLDS.waveHeightM.high} m maps 0 → 100.</li>
        </ul>
        <p className="text-slate-400">These are project assumptions, not official port-shutdown limits.</p>
      </Section>

      <Section title="Estimated-congestion method">
        <pre className="overflow-x-auto rounded bg-base-800 p-2 font-mono text-xs text-slate-300">
{`Estimated Congestion =
  Normalised Density        × ${CONGESTION_SUBWEIGHTS.density}
+ Slow-Moving Ratio         × ${CONGESTION_SUBWEIGHTS.slowMoving}
+ Apparently Stationary     × ${CONGESTION_SUBWEIGHTS.stationary}`}
        </pre>
        <p className="text-slate-400">
          Slow &lt; {CONGESTION_CONFIG.slowSpeedKnots} kt, stationary &lt; {CONGESTION_CONFIG.stationarySpeedKnots} kt.
          {" "}{CONGESTION_DISCLAIMER}
        </p>
      </Section>

      <Section title="Maritime disruption decay">
        <p>
          Severity × relevance × source reliability × exponential recency decay
          ({DISRUPTION_CONFIG.recencyHalfLifeHours} h half-life), plus a small corroboration bonus. The
          worst active disruption drives the component.
        </p>
      </Section>

      <Section title="Simulator formulas">
        <pre className="overflow-x-auto rounded bg-base-800 p-2 font-mono text-xs text-slate-300">
{`Delay Days = Delay Hours ÷ 24
Remaining Coverage = Safety Stock Days − Effective Delay Days
Coverage Gap = max(0, Effective Delay Days − Safety Stock Days)
Shortage Units = Coverage Gap × Daily Demand
Inventory Exposure = 100 if SS ≤ 0 and delay > 0
                     else min(100, Delay ÷ max(SS, 0.25) × 100)
Shortage Cost = Shortage Units × Unit Shortage Cost
Total Cost = Rerouting + Shortage + Emergency Replenishment`}
        </pre>
      </Section>

      <Section title="Freshness, confidence & classification">
        <p>
          Freshness classes (FRESH/RECENT/STALE/EXPIRED) are multiples of each feed&apos;s expected window
          and discount confidence. Confidence is derived from source reliability, freshness, geographic
          relevance, feed availability, agreement and live-vs-cached/estimated/simulated status — it is NOT
          computed as 100 − risk. Every data point is classified LIVE, CACHED, ESTIMATED, SIMULATED or
          UNAVAILABLE.
        </p>
      </Section>

      <Section title="Hallucination controls & human approval">
        <ul className="list-inside list-disc text-slate-300">
          <li>Deterministic engines compute every number; the model only explains them.</li>
          <li>Server-generated snapshot grounds the assistant; client-submitted scores are not trusted.</li>
          <li>Disruption text is treated as data, never as instructions (prompt-injection defence).</li>
          <li>Strict tool schemas, tool-loop limits and a safe audit trail.</li>
          <li>High-impact recommendations require: “Human review and authorisation required before operational action.”</li>
        </ul>
      </Section>

      <Section title="Known limitations">
        <ul className="list-inside list-disc text-slate-300">
          <li>No official PSA berth, crane, queue or waiting-time data.</li>
          <li>Congestion is an AIS-based estimate; AIS can be sparse, delayed or spoofed.</li>
          <li>Marine data is a forecast and must not be used for navigation.</li>
          <li>News-source conflicts and geolocation errors are possible.</li>
        </ul>
      </Section>
    </div>
  );
}
