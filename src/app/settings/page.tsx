"use client";

import { useAppState } from "@/components/providers/AppStateProvider";
import type { AppMode, DemoScenarioId } from "@/types";

const SCENARIOS: { id: DemoScenarioId; label: string; desc: string }[] = [
  { id: "normal-operations", label: "Normal Operations", desc: "Calm baseline, high confidence." },
  { id: "thunderstorm", label: "Thunderstorm & Lightning", desc: "Severe storm near Tuas." },
  { id: "regional-disruption", label: "Regional Disruption", desc: "Malacca Strait route disruption." },
  { id: "pharmaceutical-crisis", label: "Pharmaceutical Crisis", desc: "Cold-chain crisis, 1.5-day stock." },
];

export default function SettingsPage() {
  const { mode, scenario, setMode, setScenario } = useAppState();

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-lg font-bold text-white">System Settings</h1>
        <p className="text-xs text-slate-400">
          Mode and scenario are shared across the dashboard, simulator and assistant.
        </p>
      </div>

      <section className="card space-y-3">
        <h2 className="text-sm font-semibold text-slate-200">Data mode</h2>
        <div className="flex gap-2">
          {(["demo", "live"] as AppMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm capitalize ${mode === m ? "border-status-live bg-status-live/10 text-status-live" : "border-base-500 text-slate-300"}`}
            >
              {m} Mode
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500">
          Demo Mode uses deterministic seeded fixtures and works with zero API keys. Live Mode attempts public sources
          (data.gov.sg weather, Open-Meteo marine) and marks any failed feed as cached or unavailable — it never
          substitutes simulated data for live data.
        </p>
      </section>

      <section className="card space-y-3">
        <h2 className="text-sm font-semibold text-slate-200">Demo scenario</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              onClick={() => setScenario(s.id)}
              className={`rounded-lg border p-3 text-left ${scenario === s.id ? "border-status-sim bg-status-sim/10" : "border-base-500"}`}
            >
              <p className="text-sm font-semibold text-slate-100">{s.label}</p>
              <p className="text-xs text-slate-400">{s.desc}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="card space-y-2">
        <h2 className="text-sm font-semibold text-slate-200">Live source configuration</h2>
        <p className="text-xs text-slate-400">
          Live feeds and the AI assistant are configured via server environment variables (never in the browser):
        </p>
        <ul className="list-inside list-disc text-xs text-slate-400">
          <li><code className="text-slate-300">ANTHROPIC_API_KEY</code> / <code className="text-slate-300">ANTHROPIC_MODEL</code> — enable the assistant.</li>
          <li><code className="text-slate-300">AIS_PROVIDER_MODE=aisstream</code> + <code className="text-slate-300">AISSTREAM_API_KEY</code> — live vessels via the collector.</li>
          <li><code className="text-slate-300">ENABLE_LIVE_WEATHER / _MARINE / _LIGHTNING / _DISRUPTIONS</code> — per-feed toggles.</li>
        </ul>
        <p className="text-[11px] text-slate-500">
          These are read server-side only. No keys are ever exposed to frontend code.
        </p>
      </section>
    </div>
  );
}
