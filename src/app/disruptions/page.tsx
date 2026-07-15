"use client";

import { useSnapshot } from "@/lib/client/useSnapshot";
import { DisruptionPanel } from "@/components/alerts/DisruptionPanel";
import { CardSkeleton, ErrorState } from "@/components/common/Skeleton";
import { StatusBadge } from "@/components/common/StatusBadge";

export default function DisruptionsPage() {
  const { data, isLoading, isError, error } = useSnapshot();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">Disruption History</h1>
          <p className="text-xs text-slate-400">
            Sortable, filterable maritime disruption feed. Not every article mentioning Singapore is an active incident.
          </p>
        </div>
        {data && <StatusBadge status={data.disruptions.status} />}
      </div>
      {isLoading ? (
        <CardSkeleton />
      ) : isError || !data ? (
        <ErrorState message={error instanceof Error ? error.message : "Failed to load disruptions."} />
      ) : (
        <DisruptionPanel disruptions={data.disruptions.data ?? []} />
      )}
    </div>
  );
}
