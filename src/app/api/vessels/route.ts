import { NextResponse, type NextRequest } from "next/server";
import { getSnapshotForRequest } from "@/lib/snapshot/get-snapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const s = await getSnapshotForRequest(req);
    return NextResponse.json({ vessels: s.vessels, congestion: s.congestion });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Vessels failed.";
    return NextResponse.json(
      { error: { code: "VESSELS_FAILED", message } },
      { status: 500 },
    );
  }
}
