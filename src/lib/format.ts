/**
 * Shared number parse/format helpers used by the calculator tabs.
 *
 * `parseFormattedNumber` tolerates user-typed values that may contain currency
 * symbols, thousand separators (`,` or `.`), and locale-dependent decimal
 * separators. `formatNumberForInput` renders a number back into a localized
 * string suitable for display inside an <input>.
 */

export type Language = 'id' | 'en';

/**
 * Parse a user-typed string/number into a raw number.
 *
 * Handles mixed separator styles:
 *  - "1,250,000"   -> 1250000  (comma as thousands)
 *  - "1.250.000"   -> 1250000  (period as thousands)
 *  - "12,5"        -> 12.5     (single comma as decimal)
 *  - "1.250,50"    -> 1250.5   (period thousands, comma decimal)
 *  - "1,250.50"    -> 1250.5   (comma thousands, period decimal)
 */
export function parseFormattedNumber(val: string | number): number {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  let clean = val.toString().trim();

  // Strip currency symbols and whitespace.
  clean = clean.replace(/[Rp$\s]/g, '');

  const hasComma = clean.includes(',');
  const hasPeriod = clean.includes('.');

  if (hasComma && !hasPeriod) {
    // Comma only: thousands ("1,250,000") vs decimal ("12,5").
    if (/,\d{3}(?:,\d{3})*$/.test(clean) || (clean.match(/,/g) || []).length > 1) {
      clean = clean.replace(/,/g, '');
    } else {
      clean = clean.replace(/,/g, '.');
    }
  } else if (hasPeriod && !hasComma) {
    // Period only: thousands ("1.250.000") vs decimal ("12.5").
    if (/\.\d{3}(?:\.\d{3})*$/.test(clean) || (clean.match(/\./g) || []).length > 1) {
      clean = clean.replace(/\./g, '');
    }
  } else if (hasComma && hasPeriod) {
    // Both: the last separator to appear is the decimal separator.
    const commaIndex = clean.lastIndexOf(',');
    const periodIndex = clean.lastIndexOf('.');
    if (commaIndex > periodIndex) {
      clean = clean.replace(/\./g, '').replace(/,/g, '.');
    } else {
      clean = clean.replace(/,/g, '');
    }
  }

  const parsed = parseFloat(clean);
  return isNaN(parsed) ? 0 : parsed;
}

export interface FormatNumberOptions {
  /** Maximum number of fractional digits to display. Default: 2. */
  maxFractionDigits?: number;
  /** Locale used for grouping. 'id' -> id-ID, 'en' -> en-US. Default: 'en'. */
  language?: Language;
}

/**
 * Format a number (or numeric string) for display in an <input>.
 * Returns '' for empty/null/undefined so inputs stay clearable.
 */
export function formatNumberForInput(
  num: number | string | undefined | null,
  options?: FormatNumberOptions
): string {
  if (num === undefined || num === null || num === '') return '';
  const { maxFractionDigits = 2, language = 'en' } = options || {};
  const parsed = typeof num === 'number' ? num : parseFormattedNumber(num);
  if (isNaN(parsed)) return '';
  return new Intl.NumberFormat(language === 'id' ? 'id-ID' : 'en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFractionDigits,
  }).format(parsed);
}

/** Format a number as a Rupiah string, e.g. "Rp 1.250.000" or "-Rp 50.000". */
export function formatIDR(value: number, language: Language = 'en'): string {
  const formatted = new Intl.NumberFormat(language === 'id' ? 'id-ID' : 'en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Math.abs(value));
  return value < 0 ? `-Rp ${formatted}` : `Rp ${formatted}`;
}
