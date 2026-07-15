"use client";

import { useQuery } from "@tanstack/react-query";
import type { DashboardSnapshot } from "@/types/snapshot";
import { useAppState } from "@/components/providers/AppStateProvider";

async function fetchSnapshot(
  mode: string,
  scenario: string,
): Promise<DashboardSnapshot> {
  const res = await fetch(`/api/snapshot?mode=${mode}&scenario=${scenario}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Snapshot request failed (${res.status}).`);
  }
  return (await res.json()) as DashboardSnapshot;
}

export function useSnapshot() {
  const { mode, scenario } = useAppState();
  const query = useQuery({
    queryKey: ["snapshot", mode, scenario],
    queryFn: () => fetchSnapshot(mode, scenario),
    refetchInterval: mode === "live" ? 60_000 : false,
  });
  return { ...query, mode, scenario };
}
