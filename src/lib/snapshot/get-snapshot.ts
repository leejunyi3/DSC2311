import "server-only";

import type { NextRequest } from "next/server";
import type { DashboardSnapshot } from "@/types/snapshot";
import { buildSnapshot } from "./build-snapshot";
import { resolveSnapshotOptions } from "./context";

/** Build the shared snapshot for an incoming request's mode/scenario params. */
export async function getSnapshotForRequest(
  req: NextRequest,
): Promise<DashboardSnapshot> {
  const options = resolveSnapshotOptions(req.nextUrl.searchParams);
  return buildSnapshot(options);
}
