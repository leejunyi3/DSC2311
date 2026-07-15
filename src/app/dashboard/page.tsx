"use client";

import { useSnapshot } from "@/lib/client/useSnapshot";
import { KpiCards } from "@/components/dashboard/KpiCards";
import { MapPanel } from "@/components/map/MapPanel";
import { DashboardCharts } from "@/components/charts/DashboardCharts";
import { DisruptionPanel } from "@/components/alerts/DisruptionPanel";
import { OptionComparisonView } from "@/components/simulator/OptionComparisonView";
import { CardSkeleton, ErrorState } from "@/components/common/Skeleton";
import { Disclaimer } from "@/components/common/Disclaimer";
import { PROJECT_DISCLAIMER } from "@/lib/constants/geo";
import Link from "next/link";

export default function DashboardPage() {
  const { data, isLoading, isError, error } = useSnapshot();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    );
  }
  if (isError || !data) {
    return <ErrorState message={error instanceof Error ? error.message : "Failed to load snapshot."} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold text-white">Dashboard Overview</h1>
          <p className="text-xs text-slate-400">
            {data.scenarioName} · {data.mode.toUpperCase()} mode
          </p>
        </div>
        <p className="max-w-lg text-right text-[11px] text-slate-500">{data.scenarioNarrative}</p>
      </div>

      <KpiCards snapshot={data} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <MapPanel snapshot={data} />
        </div>
        <div className="card">
          <div className="mb-3 flex items-center justify-between">
            <span className="card-title">Active Disruptions</span>
            <Link href="/disruptions" className="text-xs text-status-live hover:underline">
              View all
            </Link>
          </div>
          <DisruptionPanel disruptions={data.disruptions.data ?? []} compact />
        </div>
      </div>

      <DashboardCharts history={data.history} />

      <div className="card">
        <div className="mb-3 flex items-center justify-between">
          <span className="card-title">What-If Simulator — {data.scenarioName}</span>
          <Link href="/simulator" className="text-xs text-status-live hover:underline">
            Open simulator
          </Link>
        </div>
        <OptionComparisonView result={data.simulation} input={data.simulatorDefaults} />
      </div>

      <Disclaimer text={PROJECT_DISCLAIMER} />
    </div>
  );
}
