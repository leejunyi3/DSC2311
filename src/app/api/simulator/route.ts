import { NextResponse, type NextRequest } from "next/server";
import { simulationInputSchema } from "@/lib/schemas/simulator";
import { compareResponseOptions } from "@/lib/simulator/option-comparison";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 8 * 1024;

export async function POST(req: NextRequest) {
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) {
      return NextResponse.json(
        { error: { code: "PAYLOAD_TOO_LARGE", message: "Input too large." } },
        { status: 413 },
      );
    }

    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { error: { code: "BAD_JSON", message: "Malformed JSON body." } },
        { status: 400 },
      );
    }

    const parsed = simulationInputSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_FAILED",
            message: "Simulator input failed validation.",
            issues: parsed.error.issues.map((i) => ({
              path: i.path.join("."),
              message: i.message,
            })),
          },
        },
        { status: 422 },
      );
    }

    const comparison = compareResponseOptions(parsed.data);
    return NextResponse.json({ input: parsed.data, result: comparison });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Simulator failed.";
    return NextResponse.json(
      { error: { code: "SIMULATOR_FAILED", message } },
      { status: 500 },
    );
  }
}
