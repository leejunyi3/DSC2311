"use client";

import dynamic from "next/dynamic";
import type { DashboardSnapshot } from "@/types/snapshot";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Disclaimer } from "@/components/common/Disclaimer";
import { ClientTime } from "@/components/common/ClientTime";
import { Skeleton } from "@/components/common/Skeleton";
import { GEOFENCE_DISCLAIMER } from "@/lib/constants/geo";

// Leaflet touches `window` at import time, so load it client-side only (§33.4).
const VesselMap = dynamic(() => import("./VesselMap"), {
  ssr: false,
  loading: () => <Skeleton className="h-[420px] w-full" />,
});

export function MapPanel({ snapshot }: { snapshot: DashboardSnapshot }) {
  return (
    <div className="card">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="card-title">Vessel Map — Tuas &amp; Western Waters</span>
          <StatusBadge status={snapshot.vessels.status} />
        </div>
        <span className="text-[11px] text-slate-500">
          Updated <ClientTime iso={snapshot.vessels.observedAt ?? snapshot.generatedAt} pattern="HH:mm:ss" /> SGT
        </span>
      </div>
      <VesselMap snapshot={snapshot} />
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <Legend color="#22d3ee" label="Normal" />
        <Legend color="#f59e0b" label="Slow-moving" />
        <Legend color="#ef4444" label="Apparently stationary" />
      </div>
      <div className="mt-2">
        <Disclaimer text={GEOFENCE_DISCLAIMER} />
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
