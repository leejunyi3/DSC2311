"use client";

import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSnapshot } from "@/lib/client/useSnapshot";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ClientAge } from "@/components/common/ClientTime";
import { CardSkeleton, ErrorState } from "@/components/common/Skeleton";
import { CONNECTIVITY_LABEL } from "@/lib/client/format";

const CONNECTION_STYLE: Record<string, string> = {
  connected: "text-status-safe",
  delayed: "text-status-warn",
  unavailable: "text-status-high",
  demo: "text-status-sim",
};

export default function DiagnosticsPage() {
  const { data, isLoading, isError, error, mode, scenario } = useSnapshot();
  const health = useQuery({
    queryKey: ["health", mode, scenario],
    queryFn: async () => {
      const res = await fetch(`/api/health?mode=${mode}&scenario=${scenario}`, {
        cache: "no-store",
      });
      return (await res.json()) as {
        assistant: {
          enabled: boolean;
          provider: "gemini" | "anthropic";
          model: string | null;
        };
      };
    },
  });

  if (isLoading) return <CardSkeleton />;
  if (isError || !data)
    return <ErrorState message={error instanceof Error ? error.message : "Failed."} />;

  const assistantInfo = health.data?.assistant;
  const assistantEnabled = assistantInfo?.enabled ?? false;
  const assistantLabel =
    assistantInfo?.provider === "anthropic"
      ? "Claude API (Anthropic)"
      : "Gemini API (Google AI Studio)";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-white">Data Diagnostics</h1>
        <p className="text-xs text-slate-400">
          {CONNECTIVITY_LABEL[data.connectivity]} · Data confidence {data.confidence.score} ({data.confidence.class})
        </p>
      </div>

      <div className="space-y-2">
        {data.feeds.map((f) => (
          <div key={f.key} className="card flex flex-wrap items-center gap-x-6 gap-y-2">
            <div className="min-w-[200px] flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-100">{f.label}</span>
                <StatusBadge status={f.status} />
              </div>
              <p className="mt-1 text-xs text-slate-400">{f.message}</p>
            </div>
            <Stat label="Connection" value={<span className={`capitalize ${CONNECTION_STYLE[f.connection]}`}>{f.connection}</span>} />
            <Stat label="Data age" value={<ClientAge ageSeconds={f.ageSeconds} />} />
            <Stat label="Expected freshness" value={`${Math.round(f.expectedFreshnessSeconds / 60)} min`} />
            <Stat label="Response time" value={f.responseTimeMs != null ? `${f.responseTimeMs} ms` : "—"} />
            <Stat label="Fallback" value={f.activeFallback ?? "—"} />
            {f.lastError && <Stat label="Last error" value={<span className="text-status-high">{f.lastError}</span>} />}
          </div>
        ))}

        {/* Non-feed services */}
        <div className="card flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="min-w-[200px] flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-100">{assistantLabel}</span>
              <StatusBadge status={assistantEnabled ? "LIVE" : "UNAVAILABLE"} />
            </div>
            <p className="mt-1 text-xs text-slate-400">
              {assistantEnabled
                ? `Assistant enabled${assistantInfo?.model ? ` · model ${assistantInfo.model}` : ""}.`
                : "Assistant disabled — no API key. Offline deterministic summaries are served instead."}
            </p>
          </div>
        </div>
        <div className="card flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="min-w-[200px] flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-100">Cache &amp; Demo provider</span>
              <StatusBadge status={data.mode === "demo" ? "SIMULATED" : "LIVE"} />
            </div>
            <p className="mt-1 text-xs text-slate-400">
              In-process TTL cache active. Demo provider is deterministic and seeded.
            </p>
          </div>
        </div>
      </div>
      <p className="text-[11px] text-slate-500">
        Diagnostics never expose secrets or raw provider errors that could contain credentials.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-[90px]">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-xs text-slate-200">{value}</p>
    </div>
  );
}
