import { NextResponse, type NextRequest } from "next/server";
import { getSnapshotForRequest } from "@/lib/snapshot/get-snapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const snapshot = await getSnapshotForRequest(req);
    return NextResponse.json(snapshot);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to build snapshot.";
    return NextResponse.json(
      { error: { code: "SNAPSHOT_FAILED", message } },
      { status: 500 },
    );
  }
}
