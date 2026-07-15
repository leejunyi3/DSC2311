import { NextResponse, type NextRequest } from "next/server";
import { getSnapshotForRequest } from "@/lib/snapshot/get-snapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const s = await getSnapshotForRequest(req);
    return NextResponse.json(s.disruptions);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Disruptions failed.";
    return NextResponse.json(
      { error: { code: "DISRUPTIONS_FAILED", message } },
      { status: 500 },
    );
  }
}
