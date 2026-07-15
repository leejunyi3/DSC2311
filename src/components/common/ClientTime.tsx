"use client";

import { useEffect, useState } from "react";
import { formatSgTime, humaniseAge } from "@/lib/utils/time";

/**
 * Render a Singapore-time string only after mount to avoid a server/client
 * hydration mismatch on timestamps (§33.4).
 */
export function ClientTime({
  iso,
  pattern,
  prefix,
}: {
  iso: string;
  pattern?: string;
  prefix?: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <span className="text-slate-500">—</span>;
  return (
    <span suppressHydrationWarning>
      {prefix}
      {formatSgTime(iso, pattern)}
    </span>
  );
}

export function ClientAge({ ageSeconds }: { ageSeconds?: number }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <span className="text-slate-500">—</span>;
  return <span suppressHydrationWarning>{humaniseAge(ageSeconds)}</span>;
}

/** A live-updating Singapore clock for the header. */
export function LiveClock() {
  const [now, setNow] = useState<string | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date().toISOString());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  if (!now) return <span className="text-slate-500">—</span>;
  return (
    <span className="font-mono tabular-nums" suppressHydrationWarning>
      {formatSgTime(now, "HH:mm:ss")} SGT
    </span>
  );
}
