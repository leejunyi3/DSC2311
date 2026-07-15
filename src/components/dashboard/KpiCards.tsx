"use client";

import {
  Gauge,
  Ship,
  CloudRain,
  Waves,
  AlertTriangle,
  ShieldCheck,
  Zap,
} from "lucide-react";
import type { ReactNode } from "react";
import type { DashboardSnapshot } from "@/types/snapshot";
import type { RiskCategory } from "@/types";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Disclaimer } from "@/components/common/Disclaimer";
import { ClientTime } from "@/components/common/ClientTime";
import { RISK_STYLES, deltaLabel, fmt } from "@/lib/client/format";
import { CONGESTION_DISCLAIMER } from "@/lib/constants/geo";

function scoreCategory(score: number): RiskCategory {
  if (score <= 24) return "Low";
  if (score <= 49) return "Moderate";
  if (score <= 74) return "High";
  return "Critical";
}

function Metric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-sm font-semibold text-slate-100">{value}</p>
    </div>
  );
}

export function KpiCards({ snapshot }: { snapshot: DashboardSnapshot }) {
  const { risk, congestion, weather, marine, disruptions, confidence } = snapshot;
  const cong = congestion.data;
  const w = weather.data;
  const m = marine.data;
  const alerts = disruptions.data ?? [];
  const riskStyle = RISK_STYLES[risk.category];
  const rd = deltaLabel(risk.delta);
  const congDelta = deltaLabel(cong?.deltaVesselCount ?? null);

  const highestSeverity =
    alerts.length > 0
      ? alerts.reduce((max, a) => {
          const order = { low: 0, moderate: 1, high: 2, critical: 3 } as const;
          return order[a.severity] > order[max.severity] ? a : max;
        }).severity
      : "none";

  const weatherCat = scoreCategory(risk.components.weather);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {/* 1. Overall Resilience Risk */}
      <div className={`card ring-1 ${riskStyle.ring}`}>
        <div className="flex items-center justify-between">
          <span className="card-title flex items-center gap-1.5">
            <Gauge className="h-3.5 w-3.5" /> Overall Resilience Risk
          </span>
          <StatusBadge status="ESTIMATED" />
        </div>
        <div className="mt-2 flex items-end gap-2">
          <span className={`text-4xl font-bold ${riskStyle.text}`}>{fmt(risk.overall)}</span>
          <span className={`mb-1 rounded px-2 py-0.5 text-xs font-bold ${riskStyle.bg} ${riskStyle.text}`}>
            {risk.category}
          </span>
          <span className={`mb-1 text-xs ${rd.cls}`}>{rd.text}</span>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Drivers: {risk.drivers.map((d) => d.label).join(", ")}
        </p>
        <p className="mt-1 text-[11px] text-slate-500">
          Confidence {confidence.score} ({confidence.class})
        </p>
      </div>

      {/* 2. Estimated Tuas Congestion */}
      <div className="card">
        <div className="flex items-center justify-between">
          <span className="card-title flex items-center gap-1.5">
            <Ship className="h-3.5 w-3.5" /> Estimated Tuas Congestion
          </span>
          <StatusBadge status={congestion.status} />
        </div>
        <div className="mt-2 flex items-end gap-2">
          <span className="text-3xl font-bold text-sky-300">{fmt(cong?.score)}</span>
          <span className="mb-1 rounded bg-sky-500/10 px-2 py-0.5 text-xs font-bold text-sky-300">
            {cong?.status ?? "—"}
          </span>
          <span className={`mb-1 text-xs ${congDelta.cls}`}>{congDelta.text} vessels</span>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <Metric label="Detected" value={fmt(cong?.vesselCount)} />
          <Metric label="Slow" value={fmt(cong?.slowMovingCount)} />
          <Metric label="Stationary" value={fmt(cong?.stationaryCount)} />
        </div>
        <div className="mt-2">
          <Disclaimer text={CONGESTION_DISCLAIMER} />
        </div>
      </div>

      {/* 3. Weather Risk */}
      <div className="card">
        <div className="flex items-center justify-between">
          <span className="card-title flex items-center gap-1.5">
            <CloudRain className="h-3.5 w-3.5" /> Weather Risk
          </span>
          <StatusBadge status={weather.status} />
        </div>
        <div className="mt-2 flex items-end gap-2">
          <span className={`text-3xl font-bold ${RISK_STYLES[weatherCat].text}`}>
            {fmt(risk.components.weather)}
          </span>
          <span className="mb-1 text-xs text-slate-400">{weatherCat}</span>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Metric label="Rainfall" value={w?.rainfallMmPerHr != null ? `${fmt(w.rainfallMmPerHr, 1)} mm/hr` : "—"} />
          <Metric label="Wind" value={w?.windSpeedKnots != null ? `${fmt(w.windSpeedKnots, 1)} kt` : "—"} />
          <Metric label="Wind dir" value={w?.windDirectionDegrees != null ? `${fmt(w.windDirectionDegrees)}°` : "—"} />
          <Metric label="Lightning" value={<LightningInline snapshot={snapshot} />} />
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          {w?.stationName ?? "—"} ·{" "}
          {w ? <ClientTime iso={w.observedAt} pattern="HH:mm" /> : "—"} SGT
        </p>
      </div>

      {/* 4. Marine Conditions */}
      <div className="card">
        <div className="flex items-center justify-between">
          <span className="card-title flex items-center gap-1.5">
            <Waves className="h-3.5 w-3.5" /> Marine Conditions
          </span>
          <StatusBadge status={marine.status} />
        </div>
        <div className="mt-2 flex items-end gap-2">
          <span className="text-3xl font-bold text-cyan-300">
            {m?.waveHeightM != null ? `${fmt(m.waveHeightM, 1)} m` : "—"}
          </span>
          <span className="mb-1 text-xs capitalize text-slate-400">{m?.trend ?? "—"}</span>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Metric label="Period" value={m?.wavePeriodS != null ? `${fmt(m.wavePeriodS, 1)} s` : "—"} />
          <Metric label="Direction" value={m?.waveDirectionDegrees != null ? `${fmt(m.waveDirectionDegrees)}°` : "—"} />
          <Metric label="Swell" value={m?.swellHeightM != null ? `${fmt(m.swellHeightM, 1)} m` : "—"} />
          <Metric label="Location" value={m?.locationName ?? "—"} />
        </div>
        <p className="mt-2 text-[11px] text-slate-500">Forecast — not for navigation.</p>
      </div>

      {/* 5. Active Disruptions */}
      <div className="card">
        <div className="flex items-center justify-between">
          <span className="card-title flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" /> Active Disruptions
          </span>
          <StatusBadge status={disruptions.status} />
        </div>
        <div className="mt-2 flex items-end gap-2">
          <span className="text-3xl font-bold text-amber-300">{fmt(alerts.length)}</span>
          <span className="mb-1 text-xs capitalize text-slate-400">
            highest: {highestSeverity}
          </span>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          {alerts[0] ? `${alerts[0].event} — ${alerts[0].location}` : "No active disruptions relevant to Tuas."}
        </p>
        <p className="mt-1 text-[11px] text-slate-500">
          {alerts.length} alert{alerts.length === 1 ? "" : "s"} in view
        </p>
      </div>

      {/* 6. Data Confidence */}
      <div className="card">
        <div className="flex items-center justify-between">
          <span className="card-title flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" /> Data Confidence
          </span>
          <StatusBadge status={snapshot.mode === "demo" ? "SIMULATED" : "LIVE"} />
        </div>
        <div className="mt-2 flex items-end gap-2">
          <span className="text-3xl font-bold text-emerald-300">{fmt(confidence.score)}</span>
          <span className="mb-1 text-xs text-slate-400">{confidence.class}</span>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Metric label="Available feeds" value={`${confidence.availableFeeds}/${confidence.totalFeeds}`} />
          <Metric label="Stale/Unavail." value={fmt(confidence.staleFeeds.length + confidence.unavailableFeeds.length)} />
        </div>
        <p className="mt-2 text-[11px] text-slate-500">{confidence.mainLimitation}</p>
      </div>
    </div>
  );
}

function LightningInline({ snapshot }: { snapshot: DashboardSnapshot }) {
  const l = snapshot.lightning.data;
  if (!l || snapshot.lightning.status === "UNAVAILABLE")
    return <span className="text-slate-400">—</span>;
  return (
    <span className="inline-flex items-center gap-1 text-sm font-semibold text-slate-100">
      <Zap className="h-3 w-3 text-amber-300" />
      {l.recentCount} · {l.nearestKm != null ? `${fmt(l.nearestKm, 1)} km` : "n/a"}
    </span>
  );
}
