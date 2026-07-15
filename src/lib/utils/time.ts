/** Singapore-time helpers (§5: Asia/Singapore). */

import { formatInTimeZone } from "date-fns-tz";

export const SG_TZ = "Asia/Singapore";

export function nowIso(): string {
  return new Date().toISOString();
}

/** Format an ISO string as Singapore local time (safe for server + client). */
export function formatSgTime(iso: string, pattern = "yyyy-MM-dd HH:mm:ss"): string {
  try {
    return formatInTimeZone(new Date(iso), SG_TZ, pattern);
  } catch {
    return iso;
  }
}

/** e.g. "3 min ago" / "just now" — deterministic given both timestamps. */
export function humaniseAge(ageSeconds: number | undefined): string {
  if (ageSeconds == null) return "unknown age";
  if (ageSeconds < 45) return "just now";
  const mins = Math.round(ageSeconds / 60);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
