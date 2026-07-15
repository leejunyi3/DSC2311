"use client";

import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { HistoryPoint } from "@/types/snapshot";
import { formatSgTime } from "@/lib/utils/time";

type RangeKey = "6h" | "24h" | "7d";
const RANGE_HOURS: Record<RangeKey, number> = { "6h": 6, "24h": 24, "7d": 168 };

const AXIS = { stroke: "#64748b", fontSize: 11 };
const GRID = "#1d2a44";

function RangeTabs({
  range,
  setRange,
}: {
  range: RangeKey;
  setRange: (r: RangeKey) => void;
}) {
  return (
    <div className="flex overflow-hidden rounded-lg border border-base-500 text-xs">
      {(Object.keys(RANGE_HOURS) as RangeKey[]).map((r) => (
        <button
          key={r}
          onClick={() => setRange(r)}
          className={`px-2.5 py-1 font-semibold ${range === r ? "bg-status-live/20 text-status-live" : "text-slate-400 hover:text-white"}`}
        >
          {r}
        </button>
      ))}
    </div>
  );
}

function tickTime(iso: string, range: RangeKey): string {
  return formatSgTime(iso, range === "7d" ? "dd HH:mm" : "HH:mm");
}

export function DashboardCharts({ history }: { history: HistoryPoint[] }) {
  const [range, setRange] = useState<RangeKey>("24h");

  const data: HistoryPoint[] = useMemo(() => {
    const n = RANGE_HOURS[range];
    return history.slice(-(n + 1));
  }, [history, range]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-200">Trends</h2>
        <RangeTabs range={range} setRange={setRange} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Risk trend */}
        <div className="card">
          <p className="card-title mb-2">Risk trend (0–100)</p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
              <XAxis dataKey="t" tickFormatter={(v: string) => tickTime(v, range)} tick={AXIS} minTickGap={28} />
              <YAxis domain={[0, 100]} tick={AXIS} />
              <Tooltip
                contentStyle={{ background: "#0f1626", border: "1px solid #1d2a44", fontSize: 12 }}
                labelFormatter={(v: string) => formatSgTime(v, "dd MMM HH:mm")}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="overallRisk" name="Overall" stroke="#ef4444" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="weatherRisk" name="Weather" stroke="#38bdf8" dot={false} />
              <Line type="monotone" dataKey="congestionRisk" name="Congestion" stroke="#a855f7" dot={false} />
              <Line type="monotone" dataKey="disruptionRisk" name="Disruption" stroke="#f59e0b" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Vessel density */}
        <div className="card">
          <p className="card-title mb-2">Vessel density & congestion</p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
              <XAxis dataKey="t" tickFormatter={(v: string) => tickTime(v, range)} tick={AXIS} minTickGap={28} />
              <YAxis yAxisId="left" tick={AXIS} />
              <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={AXIS} />
              <Tooltip
                contentStyle={{ background: "#0f1626", border: "1px solid #1d2a44", fontSize: 12 }}
                labelFormatter={(v: string) => formatSgTime(v, "dd MMM HH:mm")}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line yAxisId="left" type="monotone" dataKey="vesselCount" name="Total" stroke="#22d3ee" dot={false} strokeWidth={2} />
              <Line yAxisId="left" type="monotone" dataKey="slowMovingCount" name="Slow" stroke="#f59e0b" dot={false} />
              <Line yAxisId="left" type="monotone" dataKey="stationaryCount" name="Stationary" stroke="#ef4444" dot={false} />
              <Line yAxisId="right" type="monotone" dataKey="congestionScore" name="Congestion score" stroke="#a855f7" strokeDasharray="4 2" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Weather & marine */}
        <div className="card">
          <p className="card-title mb-2">Weather &amp; marine</p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
              <XAxis dataKey="t" tickFormatter={(v: string) => tickTime(v, range)} tick={AXIS} minTickGap={28} />
              <YAxis yAxisId="left" tick={AXIS} />
              <YAxis yAxisId="right" orientation="right" tick={AXIS} />
              <Tooltip
                contentStyle={{ background: "#0f1626", border: "1px solid #1d2a44", fontSize: 12 }}
                labelFormatter={(v: string) => formatSgTime(v, "dd MMM HH:mm")}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line yAxisId="left" type="monotone" dataKey="rainfallMmPerHr" name="Rain (mm/hr)" stroke="#38bdf8" dot={false} />
              <Line yAxisId="left" type="monotone" dataKey="windSpeedKnots" name="Wind (kt)" stroke="#94a3b8" dot={false} />
              <Line yAxisId="left" type="monotone" dataKey="waveHeightM" name="Wave (m)" stroke="#22d3ee" dot={false} />
              <Line yAxisId="right" type="monotone" dataKey="lightningRiskIndicator" name="Lightning idx" stroke="#f59e0b" strokeDasharray="4 2" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
