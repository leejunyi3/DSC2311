import { NextResponse, type NextRequest } from "next/server";
import { getSnapshotForRequest } from "@/lib/snapshot/get-snapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const s = await getSnapshotForRequest(req);
    return NextResponse.json(s.marine);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Marine failed.";
    return NextResponse.json(
      { error: { code: "MARINE_FAILED", message } },
      { status: 500 },
    );
  }
}
