"use client";

import { useSnapshot } from "@/lib/client/useSnapshot";
import { SimulatorForm } from "@/components/simulator/SimulatorForm";
import { CardSkeleton, ErrorState } from "@/components/common/Skeleton";

export default function SimulatorPage() {
  const { data, isLoading, isError, error } = useSnapshot();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-white">What-If Supply-Chain Simulator</h1>
        <p className="text-xs text-slate-400">
          Deterministic inventory &amp; option comparison. Numbers are computed in TypeScript; the assistant only explains them.
        </p>
      </div>
      {isLoading ? (
        <CardSkeleton />
      ) : isError || !data ? (
        <ErrorState message={error instanceof Error ? error.message : "Failed to load defaults."} />
      ) : (
        <SimulatorForm initial={data.simulatorDefaults} />
      )}
    </div>
  );
}
