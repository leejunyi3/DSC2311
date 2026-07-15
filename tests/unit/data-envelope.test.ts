import { describe, it, expect } from "vitest";
import { z } from "zod";
import { dataEnvelopeSchema, dataStatusSchema } from "@/lib/schemas/common";

const payload = z.object({ temperatureC: z.number() });
const envelope = dataEnvelopeSchema(payload);

describe("data-envelope validation", () => {
  it("accepts a well-formed LIVE envelope", () => {
    const result = envelope.safeParse({
      data: { temperatureC: 30.1 },
      status: "LIVE",
      sourceName: "data.gov.sg",
      retrievedAt: "2026-07-15T02:00:00.000Z",
      observedAt: "2026-07-15T01:59:00.000Z",
      ageSeconds: 60,
      confidence: 88,
      limitations: [],
    });
    expect(result.success).toBe(true);
  });

  it("accepts an UNAVAILABLE envelope with null data and an error", () => {
    const result = envelope.safeParse({
      data: null,
      status: "UNAVAILABLE",
      sourceName: "Marine forecast",
      retrievedAt: "2026-07-15T02:00:00.000Z",
      confidence: 0,
      limitations: ["Provider timed out"],
      error: { code: "TIMEOUT", message: "Upstream timeout" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a confidence outside 0–100", () => {
    const result = envelope.safeParse({
      data: { temperatureC: 30 },
      status: "LIVE",
      sourceName: "x",
      retrievedAt: "2026-07-15T02:00:00.000Z",
      confidence: 140,
      limitations: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing retrievedAt", () => {
    const result = envelope.safeParse({
      data: { temperatureC: 30 },
      status: "LIVE",
      sourceName: "x",
      confidence: 50,
      limitations: [],
    });
    expect(result.success).toBe(false);
  });

  it("only allows the five data statuses", () => {
    expect(dataStatusSchema.safeParse("LIVE").success).toBe(true);
    expect(dataStatusSchema.safeParse("SIMULATED").success).toBe(true);
    expect(dataStatusSchema.safeParse("GUESSED").success).toBe(false);
  });
});
