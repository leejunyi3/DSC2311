"use client";

import type { OptionComparisonResult, SimulationInput } from "@/types";
import { money, fmt } from "@/lib/client/format";
import { CheckCircle2, ShieldAlert } from "lucide-react";

const COLD_STYLE: Record<string, string> = {
  none: "text-slate-400",
  monitor: "text-sky-300",
  elevated: "text-amber-300",
  critical: "text-red-300",
};

export function OptionComparisonView({
  result,
  input,
}: {
  result: OptionComparisonResult;
  input: SimulationInput;
}) {
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
              <th className="p-2">Option</th>
              <th className="p-2">Delay</th>
              <th className="p-2">Coverage gap</th>
              <th className="p-2">Shortage units</th>
              <th className="p-2">Exposure</th>
              <th className="p-2">Cold-chain</th>
              <th className="p-2">Total cost</th>
            </tr>
          </thead>
          <tbody>
            {result.options.map((o) => {
              const rec = o.kind === result.recommendedKind;
              return (
                <tr
                  key={`${o.kind}-${o.label}`}
                  className={`border-t border-base-600 ${rec ? "bg-emerald-500/5" : ""}`}
                >
                  <td className="p-2 font-medium text-slate-100">
                    <span className="flex items-center gap-1.5">
                      {rec && <CheckCircle2 className="h-3.5 w-3.5 text-status-safe" />}
                      {o.label}
                    </span>
                  </td>
                  <td className="p-2 text-slate-300">{fmt(o.inventory.effectiveDelayHours)} h</td>
                  <td className="p-2 text-slate-300">{fmt(o.inventory.coverageGapDays, 2)} d</td>
                  <td className="p-2 text-slate-300">{fmt(o.inventory.potentialShortageUnits)}</td>
                  <td className="p-2 text-slate-300">{fmt(o.inventory.inventoryExposureScore)}</td>
                  <td className={`p-2 capitalize ${COLD_STYLE[o.inventory.coldChainExposure]}`}>
                    {o.inventory.coldChainExposure}
                  </td>
                  <td className="p-2 font-semibold text-slate-100">{money(o.inventory.totalScenarioCost)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-status-safe">
          Recommended response
        </p>
        <p className="mt-1 text-sm text-slate-100">{result.recommendationReason}</p>
      </div>

      <details className="rounded-lg border border-base-600 bg-base-800 p-3">
        <summary className="cursor-pointer text-xs font-semibold text-slate-300">
          Formulas &amp; working steps
        </summary>
        <div className="mt-2 space-y-1 font-mono text-[11px] text-slate-400">
          <p>Delay Days = Delay Hours ÷ 24</p>
          <p>Remaining Coverage = Safety Stock Days − Effective Delay Days</p>
          <p>Coverage Gap = max(0, Effective Delay Days − Safety Stock Days)</p>
          <p>Shortage Units = Coverage Gap × Daily Demand ({fmt(input.dailyDemand)}/day)</p>
          <p>Shortage Cost = Shortage Units × Unit Shortage Cost ({money(input.unitShortageCost)})</p>
          <p>Total Cost = Rerouting + Shortage + Emergency Replenishment</p>
        </div>
      </details>

      <div className="rounded-lg border border-base-600 p-3">
        <p className="text-xs font-semibold text-slate-300">Assumptions</p>
        <ul className="mt-1 list-inside list-disc text-xs text-slate-400">
          {result.assumptions.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ul>
      </div>

      {result.requiresHumanApproval && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-status-warn" />
          <p className="text-sm text-amber-200">
            Human review and authorisation required before operational action.
          </p>
        </div>
      )}
    </div>
  );
}
