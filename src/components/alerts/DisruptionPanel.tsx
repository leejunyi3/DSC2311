"use client";

import { useMemo, useState } from "react";
import type { Disruption, DisruptionSeverity } from "@/types";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ClientTime, ClientAge } from "@/components/common/ClientTime";
import { EmptyState } from "@/components/common/Skeleton";

const SEV_STYLE: Record<DisruptionSeverity, string> = {
  low: "bg-slate-500/20 text-slate-300",
  moderate: "bg-amber-500/15 text-amber-300",
  high: "bg-orange-500/15 text-orange-300",
  critical: "bg-red-600/20 text-red-300",
};
const SEV_ORDER: Record<DisruptionSeverity, number> = {
  low: 0,
  moderate: 1,
  high: 2,
  critical: 3,
};

function DisruptionCard({ d }: { d: Disruption }) {
  return (
    <div className="rounded-lg border border-base-600 bg-base-800 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`badge ${SEV_STYLE[d.severity]}`}>{d.severity.toUpperCase()}</span>
        <span className="text-sm font-semibold text-slate-100">{d.event}</span>
        <span className="text-xs text-slate-400">· {d.location}</span>
        <span className="ml-auto flex items-center gap-2">
          <StatusBadge status={d.status} />
          {!d.active && <span className="badge bg-slate-600/30 text-slate-300">Resolved</span>}
        </span>
      </div>
      <p className="mt-2 text-xs text-slate-300">{d.summary}</p>
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Field label="Operational impact" value={d.operationalImpact} />
        <Field label="Supply-chain impact" value={d.supplyChainImpact} />
        <Field label="Suggested response" value={d.suggestedResponse} />
        <Field label="Source" value={`${d.source} (${d.sourceCategory})`} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
        <span>Published <ClientTime iso={d.publishedAt} pattern="dd MMM HH:mm" /></span>
        <span>Retrieved <ClientTime iso={d.retrievedAt} pattern="HH:mm" /></span>
        <span>Age <ClientAge ageSeconds={ageOf(d.publishedAt)} /></span>
        <span>Confidence {d.confidence}%</span>
        {d.url && (
          <a href={d.url} target="_blank" rel="noreferrer" className="text-status-live hover:underline">
            Source link
          </a>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-xs text-slate-300">{value}</p>
    </div>
  );
}

function ageOf(iso: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
}

export function DisruptionPanel({
  disruptions,
  compact = false,
}: {
  disruptions: Disruption[];
  compact?: boolean;
}) {
  const [severity, setSeverity] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [source, setSource] = useState<string>("all");

  const sources = useMemo(
    () => Array.from(new Set(disruptions.map((d) => d.sourceCategory))),
    [disruptions],
  );

  const filtered = useMemo(() => {
    return disruptions
      .filter((d) => severity === "all" || d.severity === severity)
      .filter((d) =>
        status === "all"
          ? true
          : status === "active"
            ? d.active
            : status === "resolved"
              ? !d.active
              : status === "simulated"
                ? d.status === "SIMULATED"
                : d.status !== "SIMULATED",
      )
      .filter((d) => source === "all" || d.sourceCategory === source)
      .sort((a, b) => SEV_ORDER[b.severity] - SEV_ORDER[a.severity]);
  }, [disruptions, severity, status, source]);

  if (compact) {
    const top = [...disruptions].sort(
      (a, b) => SEV_ORDER[b.severity] - SEV_ORDER[a.severity],
    );
    return (
      <div className="space-y-2">
        {top.length === 0 ? (
          <EmptyState message="No active disruptions relevant to Tuas in this view." />
        ) : (
          top.slice(0, 3).map((d) => <DisruptionCard key={d.id} d={d} />)
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-xs">
        <Select label="Severity" value={severity} onChange={setSeverity} options={["all", "critical", "high", "moderate", "low"]} />
        <Select label="Status" value={status} onChange={setStatus} options={["all", "active", "resolved", "simulated", "live"]} />
        <Select label="Source" value={source} onChange={setSource} options={["all", ...sources]} />
      </div>
      {filtered.length === 0 ? (
        <EmptyState message="No disruptions match these filters." />
      ) : (
        <div className="space-y-2">
          {filtered.map((d) => (
            <DisruptionCard key={d.id} d={d} />
          ))}
        </div>
      )}
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <label className="flex items-center gap-1.5 text-slate-400">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-base-500 bg-base-700 px-2 py-1 text-slate-200 capitalize"
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
