import { z } from "zod";

/** Data classification — mirrors {@link import('@/types').DataStatus}. */
export const dataStatusSchema = z.enum([
  "LIVE",
  "CACHED",
  "ESTIMATED",
  "SIMULATED",
  "UNAVAILABLE",
]);

export const dataEnvelopeErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
});

/**
 * Build a runtime validator for a {@link DataEnvelope} of a given payload
 * schema. Used to validate anything crossing a trust boundary (provider
 * outputs, cache reads, tool results) before it reaches the UI or Claude.
 */
export function dataEnvelopeSchema<T extends z.ZodTypeAny>(payload: T) {
  return z.object({
    data: payload.nullable(),
    status: dataStatusSchema,
    sourceName: z.string().min(1),
    sourceUrl: z.string().url().optional(),
    observedAt: z.string().datetime().optional(),
    retrievedAt: z.string().datetime(),
    ageSeconds: z.number().nonnegative().optional(),
    confidence: z.number().min(0).max(100),
    limitations: z.array(z.string()),
    error: dataEnvelopeErrorSchema.optional(),
  });
}

export const appModeSchema = z.enum(["live", "degraded", "demo"]);

export const demoScenarioIdSchema = z.enum([
  "normal-operations",
  "thunderstorm",
  "regional-disruption",
  "pharmaceutical-crisis",
]);

export const disruptionSeveritySchema = z.enum([
  "low",
  "moderate",
  "high",
  "critical",
]);
