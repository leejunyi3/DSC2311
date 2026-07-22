"use client";

import { useEffect, useState } from "react";
import type {
  SimulationInput,
  OptionComparisonResult,
  CargoClass,
  ShipmentCriticality,
  CustomerPriority,
  AlternativeKind,
} from "@/types";
import { OptionComparisonView } from "./OptionComparisonView";
import { ErrorState } from "@/components/common/Skeleton";

const CARGO: CargoClass[] = ["general", "perishables", "pharmaceuticals", "industrial", "medical"];
const CRIT: ShipmentCriticality[] = ["low", "standard", "high", "critical"];
const CUST: CustomerPriority[] = ["standard", "priority", "key-account"];
const ALT: AlternativeKind[] = [
  "wait",
  "tanjung-pelepas",
  "port-klang",
  "johor-pasir-gudang",
  "batam",
  "penang",
  "jurong-port",
  "airfreight-changi",
  "custom",
];

function NumField({
  label,
  value,
  onChange,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-slate-400">
      {label}
      <input
        type="number"
        value={value}
        step={step}
        min={0}
        onChange={(e) => onChange(Number(e.target.value))}
        className="rounded border border-base-500 bg-base-800 px-2 py-1.5 text-slate-100"
      />
    </label>
  );
}

function SelField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-slate-400">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="rounded border border-base-500 bg-base-800 px-2 py-1.5 capitalize text-slate-100"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

export function SimulatorForm({ initial }: { initial: SimulationInput }) {
  const [input, setInput] = useState<SimulationInput>(initial);
  const [result, setResult] = useState<OptionComparisonResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Re-seed the form when the scenario default changes.
  useEffect(() => setInput(initial), [initial]);

  const set = <K extends keyof SimulationInput>(key: K, value: SimulationInput[K]) =>
    setInput((prev) => ({ ...prev, [key]: value }));

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/simulator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? "Simulation failed.");
        setResult(null);
      } else {
        setResult(json.result as OptionComparisonResult);
      }
    } catch {
      setError("Network error while running the simulation.");
    } finally {
      setLoading(false);
    }
  }

  // Auto-run on first mount and whenever the seeded default changes.
  useEffect(() => {
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="card space-y-4">
        <h2 className="text-sm font-semibold text-slate-200">Scenario inputs</h2>
        <div className="grid grid-cols-2 gap-3">
          <SelField label="Cargo type" value={input.cargoType} options={CARGO} onChange={(v) => set("cargoType", v)} />
          <SelField label="Criticality" value={input.criticality} options={CRIT} onChange={(v) => set("criticality", v)} />
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-300">
          <input type="checkbox" checked={input.coldChain} onChange={(e) => set("coldChain", e.target.checked)} />
          Cold-chain requirement
        </label>
        <div className="grid grid-cols-2 gap-3">
          <NumField label="Safety stock (days)" value={input.safetyStockDays} step={0.5} onChange={(v) => set("safetyStockDays", v)} />
          <NumField label="Daily demand (units)" value={input.dailyDemand} onChange={(v) => set("dailyDemand", v)} />
          <NumField label="Expected delay (hours)" value={input.expectedDelayHours} onChange={(v) => set("expectedDelayHours", v)} />
          <NumField label="Unit shortage cost ($)" value={input.unitShortageCost} onChange={(v) => set("unitShortageCost", v)} />
        </div>

        <h3 className="pt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Alternative route</h3>
        <div className="grid grid-cols-2 gap-3">
          <SelField label="Alternative" value={input.alternativeKind} options={ALT} onChange={(v) => set("alternativeKind", v)} />
          <SelField label="Customer priority" value={input.customerPriority} options={CUST} onChange={(v) => set("customerPriority", v)} />
          <NumField label="Alt. transit (hours)" value={input.alternativeTransitHours} onChange={(v) => set("alternativeTransitHours", v)} />
          <NumField label="Extra handling (hours)" value={input.additionalHandlingHours} onChange={(v) => set("additionalHandlingHours", v)} />
          <NumField label="Rerouting cost ($)" value={input.additionalReroutingCost} onChange={(v) => set("additionalReroutingCost", v)} />
        </div>

        <h3 className="pt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Emergency replenishment</h3>
        <div className="grid grid-cols-3 gap-3">
          <NumField label="Qty" value={input.emergencyReplenishmentQty} onChange={(v) => set("emergencyReplenishmentQty", v)} />
          <NumField label="Lead (hours)" value={input.emergencyReplenishmentLeadHours} onChange={(v) => set("emergencyReplenishmentLeadHours", v)} />
          <NumField label="Cost ($)" value={input.emergencyReplenishmentCost} onChange={(v) => set("emergencyReplenishmentCost", v)} />
        </div>

        <button
          onClick={run}
          disabled={loading}
          className="w-full rounded-lg bg-status-live/20 py-2 text-sm font-semibold text-status-live hover:bg-status-live/30 disabled:opacity-50"
        >
          {loading ? "Calculating…" : "Run simulation"}
        </button>
        <p className="text-[11px] text-slate-500">
          Alternative-port transit times and costs are your assumptions — the system holds no live availability or pricing for other ports.
        </p>
      </div>

      <div className="card">
        <h2 className="mb-3 text-sm font-semibold text-slate-200">Results</h2>
        {error ? (
          <ErrorState message={error} />
        ) : result ? (
          <OptionComparisonView result={result} input={input} />
        ) : (
          <p className="text-sm text-slate-400">Running…</p>
        )}
      </div>
    </div>
  );
}
