/**
 * Pure percentage math used by the Percentage Calculator tab.
 *
 * Every function returns a discriminated result so the UI can render a clear
 * message (e.g. "starting value is 0") instead of `Infinity` / `NaN`.
 */

export type ChangeDirection = 'up' | 'down' | 'flat';
export type ApplyDirection = 'up' | 'down';

export type PercentageError =
  /** Division by a zero base (e.g. percent change from 0). */
  | 'zero-base'
  /** A decrease of 100% or more leaves nothing to reverse from. */
  | 'non-positive-factor'
  /** Inputs or result are not finite numbers. */
  | 'invalid';

export type PercentageResult<T> = { ok: true; value: T } | { ok: false; error: PercentageError };

// Differences below this are treated as floating-point noise.
const EPSILON = 1e-12;

const fail = <T>(error: PercentageError): PercentageResult<T> => ({ ok: false, error });

const allFinite = (...nums: number[]) => nums.every(Number.isFinite);

const directionOf = (difference: number): ChangeDirection =>
  Math.abs(difference) < EPSILON ? 'flat' : difference > 0 ? 'up' : 'down';

export interface PercentChange {
  /** Percent change from `from` to `to`, e.g. 48.89 for 45 -> 67. */
  percent: number;
  /** Absolute difference `to - from`. */
  difference: number;
  /** `to / from` (e.g. 1.4889x). Null when `from` is negative, where a ratio is misleading. */
  multiplier: number | null;
  direction: ChangeDirection;
  /**
   * Percent change needed to go from `to` back to `from`.
   * After a 50% drop this is +100%. Null when `to` is 0.
   */
  returnToStartPercent: number | null;
}

/**
 * Percent change from `from` to `to`.
 * Uses `|from|` as the denominator so that a move from a negative base
 * (e.g. -20 -> 30) is still reported with the correct sign (+250%).
 */
export function percentChange(from: number, to: number): PercentageResult<PercentChange> {
  if (!allFinite(from, to)) return fail('invalid');
  if (Math.abs(from) < EPSILON) return fail('zero-base');

  const difference = to - from;
  const direction = directionOf(difference);
  const percent = direction === 'flat' ? 0 : (difference / Math.abs(from)) * 100;
  const multiplier = from > 0 ? to / from : null;
  const returnToStartPercent =
    Math.abs(to) < EPSILON ? null : direction === 'flat' ? 0 : ((from - to) / Math.abs(to)) * 100;

  return { ok: true, value: { percent, difference, multiplier, direction, returnToStartPercent } };
}

export interface AppliedPercent {
  /** Value after the increase/decrease. */
  result: number;
  /** `result - base`. */
  difference: number;
}

/** Increase or decrease `base` by `percent`%, e.g. 45 up 20% -> 54. */
export function applyPercent(
  base: number,
  percent: number,
  direction: ApplyDirection
): PercentageResult<AppliedPercent> {
  if (!allFinite(base, percent)) return fail('invalid');
  const factor = direction === 'up' ? 1 + percent / 100 : 1 - percent / 100;
  const result = base * factor;
  if (!Number.isFinite(result)) return fail('invalid');
  return { ok: true, value: { result, difference: result - base } };
}

/** `percent`% of `total`, e.g. 20% of 500 -> 100. */
export function percentOf(percent: number, total: number): PercentageResult<number> {
  if (!allFinite(percent, total)) return fail('invalid');
  const value = (percent / 100) * total;
  return Number.isFinite(value) ? { ok: true, value } : fail('invalid');
}

/** What percent `part` is of `total`, e.g. 45 of 67 -> 67.16. */
export function whatPercent(part: number, total: number): PercentageResult<number> {
  if (!allFinite(part, total)) return fail('invalid');
  if (Math.abs(total) < EPSILON) return fail('zero-base');
  return { ok: true, value: (part / total) * 100 };
}

export interface ReversedPercent {
  /** The value before the increase/decrease was applied. */
  original: number;
  /** `result - original`. */
  difference: number;
}

/**
 * Find the starting value given the final value after a percent change,
 * e.g. "after rising 20% it is 120" -> 100.
 */
export function reversePercent(
  result: number,
  percent: number,
  direction: ApplyDirection
): PercentageResult<ReversedPercent> {
  if (!allFinite(result, percent)) return fail('invalid');
  const factor = direction === 'up' ? 1 + percent / 100 : 1 - percent / 100;
  if (factor < EPSILON) return fail('non-positive-factor');
  const original = result / factor;
  if (!Number.isFinite(original)) return fail('invalid');
  return { ok: true, value: { original, difference: result - original } };
}
