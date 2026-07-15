/** Deterministic numeric helpers shared by the risk and simulator engines. */

/** Clamp `value` into the inclusive range [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/** Clamp to 0–100. */
export function clamp100(value: number): number {
  return clamp(value, 0, 100);
}

/**
 * Linearly map `value` from [inLow, inHigh] onto [0, 100], clamped. Values at or
 * below `inLow` return 0; values at or above `inHigh` return 100. If the input
 * range is degenerate, returns 0.
 */
export function normaliseToScore(
  value: number,
  inLow: number,
  inHigh: number,
): number {
  if (inHigh <= inLow) return 0;
  const t = (value - inLow) / (inHigh - inLow);
  return clamp100(t * 100);
}

/** Round to `digits` decimal places (default 2) to keep outputs stable. */
export function round(value: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round((value + Number.EPSILON) * f) / f;
}

/** Safe ratio that returns 0 when the denominator is 0. */
export function safeRatio(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return numerator / denominator;
}
