import type { DataStatus, RiskCategory } from "@/types";
import type { ConnectivityState } from "@/types/snapshot";

/** Tailwind text/border/bg classes per data status (colour + label, never colour alone). */
export const STATUS_STYLES: Record<
  DataStatus,
  { label: string; text: string; bg: string; dot: string }
> = {
  LIVE: { label: "Live", text: "text-status-live", bg: "bg-cyan-500/10", dot: "bg-status-live" },
  CACHED: { label: "Cached", text: "text-status-warn", bg: "bg-amber-500/10", dot: "bg-status-warn" },
  ESTIMATED: { label: "Estimated", text: "text-sky-300", bg: "bg-sky-500/10", dot: "bg-sky-400" },
  SIMULATED: { label: "Simulated Demo Data", text: "text-status-sim", bg: "bg-purple-500/10", dot: "bg-status-sim" },
  UNAVAILABLE: { label: "Unavailable", text: "text-status-unavailable", bg: "bg-gray-500/10", dot: "bg-status-unavailable" },
};

export const RISK_STYLES: Record<
  RiskCategory,
  { text: string; bg: string; ring: string }
> = {
  Low: { text: "text-status-safe", bg: "bg-emerald-500/10", ring: "ring-emerald-500/40" },
  Moderate: { text: "text-status-warn", bg: "bg-amber-500/10", ring: "ring-amber-500/40" },
  High: { text: "text-status-high", bg: "bg-red-500/10", ring: "ring-red-500/40" },
  Critical: { text: "text-status-critical", bg: "bg-red-600/15", ring: "ring-red-600/50" },
};

export const CONNECTIVITY_LABEL: Record<ConnectivityState, string> = {
  operational: "All Systems Operational",
  degraded: "Degraded — Cached Data Active",
  demo: "Demo Environment",
  critical: "Critical Feed Failure",
};

export const CONNECTIVITY_STYLE: Record<ConnectivityState, string> = {
  operational: "text-status-safe",
  degraded: "text-status-warn",
  demo: "text-status-sim",
  critical: "text-status-high",
};

export function fmt(n: number | null | undefined, digits = 0): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function money(n: number | null | undefined): string {
  if (n == null) return "—";
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function deltaLabel(delta: number | null | undefined): {
  text: string;
  cls: string;
} {
  if (delta == null) return { text: "—", cls: "text-slate-400" };
  if (delta > 0) return { text: `▲ +${delta}`, cls: "text-status-high" };
  if (delta < 0) return { text: `▼ ${delta}`, cls: "text-status-safe" };
  return { text: "▬ 0", cls: "text-slate-400" };
}
