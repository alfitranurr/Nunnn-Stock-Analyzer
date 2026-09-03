/**
 * Validate a stock ticker symbol.
 *
 * Accepts 1-5 uppercase ASCII letters, optionally with a `.JK` suffix for the
 * Indonesia Stock Exchange (IDX). Rejects anything else to prevent injection
 * into downstream Yahoo Finance URLs and query builders.
 *
 * @returns the cleaned symbol (uppercase, `.JK` appended when missing) or
 *          `null` when the input is invalid.
 */
export function validateTickerSymbol(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const cleaned = raw.toUpperCase().trim();
  // 1-5 letters, optional .JK suffix
  if (!/^[A-Z]{1,5}(\.JK)?$/.test(cleaned)) return null;
  return cleaned;
}
