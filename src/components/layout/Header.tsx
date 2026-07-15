"use client";

import Link from "next/link";
import { RefreshCw, Activity, BookOpen, Settings, Ship } from "lucide-react";
import type { DemoScenarioId, AppMode } from "@/types";
import { useSnapshot } from "@/lib/client/useSnapshot";
import { useAppState } from "@/components/providers/AppStateProvider";
import { LiveClock, ClientTime } from "@/components/common/ClientTime";
import { CONNECTIVITY_LABEL, CONNECTIVITY_STYLE } from "@/lib/client/format";

const SCENARIOS: { id: DemoScenarioId; label: string }[] = [
  { id: "normal-operations", label: "Normal Operations" },
  { id: "thunderstorm", label: "Thunderstorm & Lightning" },
  { id: "regional-disruption", label: "Regional Disruption" },
  { id: "pharmaceutical-crisis", label: "Pharmaceutical Crisis" },
];

export function Header() {
  const { mode, scenario, setMode, setScenario } = useAppState();
  const { data, isFetching, refetch } = useSnapshot();
  const connectivity = data?.connectivity ?? "demo";

  return (
    <header className="sticky top-0 z-20 border-b border-base-600 bg-base-800/95 backdrop-blur">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
        <div className="flex items-center gap-2 md:hidden">
          <Ship className="h-5 w-5 text-status-live" aria-hidden />
          <span className="text-sm font-bold">Tuas Control Tower</span>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`h-2.5 w-2.5 rounded-full ${connectivity === "operational" ? "bg-status-safe" : connectivity === "degraded" ? "bg-status-warn" : connectivity === "critical" ? "bg-status-high" : "bg-status-sim"}`}
            aria-hidden
          />
          <span className={`text-xs font-semibold ${CONNECTIVITY_STYLE[connectivity]}`}>
            {CONNECTIVITY_LABEL[connectivity]}
          </span>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-3">
          {/* Mode toggle */}
          <div className="flex overflow-hidden rounded-lg border border-base-500 text-xs">
            {(["demo", "live"] as AppMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-3 py-1.5 font-semibold capitalize transition-colors ${mode === m ? "bg-status-live/20 text-status-live" : "text-slate-400 hover:text-white"}`}
              >
                {m} Mode
              </button>
            ))}
          </div>

          {/* Scenario selector (demo only) */}
          {mode === "demo" && (
            <select
              value={scenario}
              onChange={(e) => setScenario(e.target.value as DemoScenarioId)}
              className="rounded-lg border border-base-500 bg-base-700 px-2 py-1.5 text-xs text-slate-200"
              aria-label="Demo scenario"
            >
              {SCENARIOS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          )}

          <div className="hidden text-xs text-slate-400 sm:block">
            <LiveClock />
          </div>

          <div className="hidden text-[11px] text-slate-500 lg:block">
            Last refresh:{" "}
            {data ? <ClientTime iso={data.generatedAt} pattern="HH:mm:ss" /> : "—"}
          </div>

          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 rounded-lg border border-base-500 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-base-600"
            aria-label="Refresh data"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </button>

          <div className="flex items-center gap-1">
            <Link href="/diagnostics" className="rounded p-1.5 text-slate-400 hover:bg-base-600 hover:text-white" title="Data Diagnostics">
              <Activity className="h-4 w-4" />
            </Link>
            <Link href="/methodology" className="rounded p-1.5 text-slate-400 hover:bg-base-600 hover:text-white" title="Methodology">
              <BookOpen className="h-4 w-4" />
            </Link>
            <Link href="/settings" className="rounded p-1.5 text-slate-400 hover:bg-base-600 hover:text-white" title="Settings">
              <Settings className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Mobile nav row */}
      <nav className="flex gap-1 overflow-x-auto border-t border-base-700 px-2 py-1 md:hidden">
        {([
          ["/dashboard", "Dashboard"],
          ["/assistant", "Assistant"],
          ["/simulator", "Simulator"],
          ["/disruptions", "Disruptions"],
          ["/methodology", "Methodology"],
          ["/diagnostics", "Diagnostics"],
          ["/settings", "Settings"],
        ] as const).map(([href, label]) => (
          <Link
            key={href}
            href={href}
            className="whitespace-nowrap rounded px-2.5 py-1 text-xs text-slate-300 hover:bg-base-600"
          >
            {label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
