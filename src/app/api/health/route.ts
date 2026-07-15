import { NextResponse, type NextRequest } from "next/server";
import { getSnapshotForRequest } from "@/lib/snapshot/get-snapshot";
import { getActiveAssistant } from "@/lib/config/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const s = await getSnapshotForRequest(req);
    return NextResponse.json({
      connectivity: s.connectivity,
      mode: s.mode,
      generatedAt: s.generatedAt,
      feeds: s.feeds,
      confidence: s.confidence,
      assistant: (() => {
        // Never expose the key itself — only the provider and whether it's enabled.
        const a = getActiveAssistant();
        return { enabled: a.enabled, provider: a.provider, model: a.enabled ? a.model : null };
      })(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Health failed.";
    return NextResponse.json(
      { error: { code: "HEALTH_FAILED", message } },
      { status: 500 },
    );
  }
}
