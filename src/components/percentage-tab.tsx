'use client';

import * as React from 'react';
import { PageHeader } from '@/components/shared/page-header';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  Copy,
  History,
  Info,
  Minus,
  Percent,
  Save,
  Sigma,
  Trash2,
} from 'lucide-react';
import { useLanguage } from '@/lib/language-context';
import { formatNumberForInput, formatPercent, parseFormattedNumber, type Language } from '@/lib/format';
import {
  applyPercent,
  percentChange,
  percentOf,
  reversePercent,
  whatPercent,
  type ApplyDirection,
  type PercentageError,
} from '@/lib/percentage';

type Mode = 'change' | 'apply' | 'of' | 'what' | 'reverse';
type DirectionMode = Extract<Mode, 'apply' | 'reverse'>;
type Tone = 'up' | 'down' | 'flat' | 'neutral';
type Translate = (key: string) => string;

interface FieldSpec {
  labelKey: string;
  placeholder: string;
  suffix?: string;
  allowNegative: boolean;
}

interface ModeSpec {
  id: Mode;
  labelKey: string;
  hintKey: string;
  a: FieldSpec;
  b: FieldSpec;
}

const MODES: ModeSpec[] = [
  {
    id: 'change',
    labelKey: 'percentage.modeChange',
    hintKey: 'percentage.hintChange',
    a: { labelKey: 'percentage.fieldFrom', placeholder: '45', allowNegative: true },
    b: { labelKey: 'percentage.fieldTo', placeholder: '67', allowNegative: true },
  },
  {
    id: 'apply',
    labelKey: 'percentage.modeApply',
    hintKey: 'percentage.hintApply',
    a: { labelKey: 'percentage.fieldBase', placeholder: '1000', allowNegative: true },
    b: { labelKey: 'percentage.fieldPercent', placeholder: '25', suffix: '%', allowNegative: false },
  },
  {
    id: 'of',
    labelKey: 'percentage.modeOf',
    hintKey: 'percentage.hintOf',
    a: { labelKey: 'percentage.fieldPercent', placeholder: '20', suffix: '%', allowNegative: true },
    b: { labelKey: 'percentage.fieldTotal', placeholder: '500', allowNegative: true },
  },
  {
    id: 'what',
    labelKey: 'percentage.modeWhat',
    hintKey: 'percentage.hintWhat',
    a: { labelKey: 'percentage.fieldPart', placeholder: '45', allowNegative: true },
    b: { labelKey: 'percentage.fieldTotal', placeholder: '67', allowNegative: true },
  },
  {
    id: 'reverse',
    labelKey: 'percentage.modeReverse',
    hintKey: 'percentage.hintReverse',
    a: { labelKey: 'percentage.fieldFinal', placeholder: '120', allowNegative: true },
    b: { labelKey: 'percentage.fieldPercent', placeholder: '20', suffix: '%', allowNegative: false },
  },
];

const MODE_BY_ID = Object.fromEntries(MODES.map((m) => [m.id, m])) as Record<Mode, ModeSpec>;
const PERCENT_PRESETS = [5, 10, 20, 25, 50];
const HISTORY_KEY = 'nunnn_stock_percentage_history';
const MAX_HISTORY = 5;

const TONE_TEXT: Record<Tone, string> = {
  up: 'text-emerald-400',
  down: 'text-rose-400',
  flat: 'text-slate-300',
  neutral: 'text-white',
};

interface HistoryEntry {
  id: string;
  mode: Mode;
  a: string;
  b: string;
  dir: ApplyDirection;
}

interface Stat {
  label: string;
  value: string;
  tone: Tone;
}

type Outcome =
  | { kind: 'empty' }
  | { kind: 'error'; message: string }
  | {
      kind: 'ok';
      label: string;
      headline: string;
      tone: Tone;
      summary: string;
      formula: string;
      stats: Stat[];
      note?: string;
    };

// ---------------------------------------------------------------------------
// Input helpers
// ---------------------------------------------------------------------------

/** Parse an input string; null while it holds no digits yet (empty or just "-"). */
const toNumber = (raw: string): number | null => (/\d/.test(raw) ? parseFormattedNumber(raw) : null);

const sanitize = (raw: string, allowNegative: boolean): string => {
  const body = raw.replace(/[^0-9.,]/g, '');
  return allowNegative && raw.trimStart().startsWith('-') ? `-${body}` : body;
};

/**
 * Re-format an input on blur, but only when the formatted string parses back
 * to the same number. `parseFormattedNumber` reads "1.125" as 1125, so 1.125
 * is padded to "1.1250" instead; anything else is left as typed.
 */
function formatOnBlur(raw: string, language: Language): string {
  const n = toNumber(raw);
  if (n === null) return '';
  const grouped = formatNumberForInput(n, { maxFractionDigits: 4, language });
  if (parseFormattedNumber(grouped) === n) return grouped;
  const padded = new Intl.NumberFormat(language === 'id' ? 'id-ID' : 'en-US', {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(n);
  return parseFormattedNumber(padded) === n ? padded : raw;
}

// ---------------------------------------------------------------------------
// Output helpers
// ---------------------------------------------------------------------------

/** Round to 4 decimals first so values like -0.00001 never render as "-0". */
const fmtNum = (n: number, language: Language): string =>
  formatNumberForInput(Number(n.toFixed(4)) + 0, { maxFractionDigits: 4, language });

const fmtSigned = (n: number, language: Language): string =>
  Number(n.toFixed(4)) > 0 ? `+${fmtNum(n, language)}` : fmtNum(n, language);

/** Wrap negatives in parentheses inside formulas: 30 − (-20). */
const operand = (n: number, language: Language): string =>
  n < 0 ? `(${fmtNum(n, language)})` : fmtNum(n, language);

const toneOf = (n: number): Tone => {
  const rounded = Number(n.toFixed(4));
  return rounded > 0 ? 'up' : rounded < 0 ? 'down' : 'flat';
};

const fill = (template: string, values: Record<string, string>): string =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);

function errorMessage(error: PercentageError, mode: Mode, t: Translate): string {
  if (error === 'zero-base') return t(mode === 'what' ? 'percentage.errZeroTotal' : 'percentage.errZeroStart');
  if (error === 'non-positive-factor') return t('percentage.errFactor');
  return t('percentage.errInvalid');
}

function computeOutcome(
  mode: Mode,
  aRaw: string,
  bRaw: string,
  dir: ApplyDirection,
  language: Language,
  t: Translate
): Outcome {
  const a = toNumber(aRaw);
  const b = toNumber(bRaw);
  if (a === null || b === null) return { kind: 'empty' };

  const k = (key: string) => t(`percentage.${key}`);
  const num = (n: number) => fmtNum(n, language);
  const op = (n: number) => operand(n, language);
  const pct = (n: number, signed = false) => formatPercent(n, { language, signed });
  const fail = (error: PercentageError): Outcome => ({ kind: 'error', message: errorMessage(error, mode, t) });
  const sign = dir === 'up' ? '+' : '−';

  switch (mode) {
    case 'change': {
      const r = percentChange(a, b);
      if (!r.ok) return fail(r.error);
      const { percent, difference, multiplier, direction, returnToStartPercent: back } = r.value;
      const headline = pct(percent, true);
      return {
        kind: 'ok',
        label: k('resultChange'),
        headline,
        tone: direction,
        summary:
          direction === 'flat'
            ? fill(k('summaryChangeFlat'), { from: num(a), to: num(b) })
            : fill(k('summaryChange'), {
                from: num(a),
                to: num(b),
                dir: k(direction === 'up' ? 'changeUp' : 'changeDown'),
                pct: pct(Math.abs(percent)),
              }),
        formula: `(${op(b)} − ${op(a)}) ÷ ${a < 0 ? `|${op(a)}|` : num(a)} × 100% = ${headline}`,
        stats: [
          { label: k('difference'), value: fmtSigned(difference, language), tone: direction },
          { label: k('multiplier'), value: multiplier === null ? '—' : `${num(multiplier)}×`, tone: 'neutral' },
          {
            label: k('returnToStart'),
            value: back === null ? '—' : pct(back, true),
            tone: back === null ? 'neutral' : toneOf(back),
          },
        ],
        // Only meaningful for a plain price drop where both values are positive.
        note:
          direction === 'down' && back !== null && a > 0 && b > 0
            ? fill(k('recoveryNote'), { drop: pct(Math.abs(percent)), gain: pct(back) })
            : undefined,
      };
    }

    case 'apply': {
      const r = applyPercent(a, b, dir);
      if (!r.ok) return fail(r.error);
      const { result, difference } = r.value;
      const headline = num(result);
      return {
        kind: 'ok',
        label: k('resultApply'),
        headline,
        tone: toneOf(difference),
        summary: fill(k('summaryApply'), {
          base: num(a),
          dir: k(dir === 'up' ? 'applyUp' : 'applyDown'),
          pct: pct(b),
          result: headline,
        }),
        formula: `${op(a)} × (1 ${sign} ${pct(b)}) = ${headline}`,
        stats: [
          { label: k('difference'), value: fmtSigned(difference, language), tone: toneOf(difference) },
          { label: k('factor'), value: `${num(dir === 'up' ? 1 + b / 100 : 1 - b / 100)}×`, tone: 'neutral' },
        ],
      };
    }

    case 'of': {
      const r = percentOf(a, b);
      if (!r.ok) return fail(r.error);
      const headline = num(r.value);
      return {
        kind: 'ok',
        label: k('resultOf'),
        headline,
        tone: 'neutral',
        summary: fill(k('summaryOf'), { pct: pct(a), total: num(b), result: headline }),
        formula: `${pct(a)} × ${op(b)} = ${headline}`,
        stats: [{ label: k('remainder'), value: num(b - r.value), tone: 'neutral' }],
      };
    }

    case 'what': {
      const r = whatPercent(a, b);
      if (!r.ok) return fail(r.error);
      const headline = pct(r.value);
      return {
        kind: 'ok',
        label: k('resultWhat'),
        headline,
        tone: 'neutral',
        summary: fill(k('summaryWhat'), { part: num(a), pct: headline, total: num(b) }),
        formula: `${op(a)} ÷ ${op(b)} × 100% = ${headline}`,
        stats: [{ label: k('remainingPercent'), value: pct(100 - r.value), tone: 'neutral' }],
      };
    }

    case 'reverse': {
      const r = reversePercent(a, b, dir);
      if (!r.ok) return fail(r.error);
      const { original, difference } = r.value;
      const headline = num(original);
      return {
        kind: 'ok',
        label: k('resultReverse'),
        headline,
        tone: 'neutral',
        summary: fill(k('summaryReverse'), {
          dir: k(dir === 'up' ? 'reverseUp' : 'reverseDown'),
          pct: pct(b),
          result: num(a),
          original: headline,
        }),
        formula: `${op(a)} ÷ (1 ${sign} ${pct(b)}) = ${headline}`,
        stats: [{ label: k('difference'), value: fmtSigned(difference, language), tone: toneOf(difference) }],
      };
    }
  }
}

function parseHistory(raw: string | null): HistoryEntry[] {
  if (!raw) return [];
  const data: unknown = JSON.parse(raw);
  if (!Array.isArray(data)) return [];
  return data
    .filter(
      (e): e is HistoryEntry =>
        !!e &&
        typeof e === 'object' &&
        typeof e.id === 'string' &&
        MODES.some((m) => m.id === e.mode) &&
        typeof e.a === 'string' &&
        typeof e.b === 'string' &&
        (e.dir === 'up' || e.dir === 'down')
    )
    .slice(0, MAX_HISTORY);
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

interface NumberFieldProps {
  spec: FieldSpec;
  label: string;
  value: string;
  language: Language;
  onChange: (value: string) => void;
}

function NumberField({ spec, label, value, language, onChange }: NumberFieldProps) {
  const id = React.useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={value}
          placeholder={spec.placeholder}
          onChange={(e) => onChange(sanitize(e.target.value, spec.allowNegative))}
          onBlur={() => onChange(formatOnBlur(value, language))}
          className={`w-full glass-input pl-4 ${spec.suffix ? 'pr-9' : 'pr-4'} py-2.5 text-sm font-extrabold text-white bg-black/25 focus:bg-background`}
        />
        {spec.suffix && (
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 pointer-events-none">
            {spec.suffix}
          </span>
        )}
      </div>
    </div>
  );
}

const EMPTY_INPUTS: Record<Mode, { a: string; b: string }> = {
  change: { a: '', b: '' },
  apply: { a: '', b: '' },
  of: { a: '', b: '' },
  what: { a: '', b: '' },
  reverse: { a: '', b: '' },
};

export function PercentageTab() {
  const { language, t } = useLanguage();
  const [mode, setMode] = React.useState<Mode>('change');
  const [inputs, setInputs] = React.useState(EMPTY_INPUTS);
  const [directions, setDirections] = React.useState<Record<DirectionMode, ApplyDirection>>({
    apply: 'up',
    reverse: 'up',
  });
  const [history, setHistory] = React.useState<HistoryEntry[]>([]);
  const [flash, setFlash] = React.useState<'copy' | 'save' | null>(null);

  const spec = MODE_BY_ID[mode];
  const current = inputs[mode];
  const directionMode: DirectionMode | null = mode === 'apply' || mode === 'reverse' ? mode : null;
  const dirFor = (m: Mode): ApplyDirection => (m === 'reverse' ? directions.reverse : directions.apply);
  const outcome = computeOutcome(mode, current.a, current.b, dirFor(mode), language, t);

  // Load saved history on mount (deferred, same as the language preference).
  React.useEffect(() => {
    let saved: HistoryEntry[] = [];
    try {
      saved = parseHistory(localStorage.getItem(HISTORY_KEY));
    } catch (e) {
      console.warn('Failed to load percentage history:', e);
    }
    if (saved.length === 0) return;
    const timer = setTimeout(() => setHistory(saved), 0);
    return () => clearTimeout(timer);
  }, []);

  // Reset the "Copied" / "Saved" feedback after a moment.
  React.useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), 1500);
    return () => clearTimeout(timer);
  }, [flash]);

  const persistHistory = (next: HistoryEntry[]) => {
    setHistory(next);
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch (e) {
      console.warn('Failed to save percentage history:', e);
    }
  };

  const updateField = (field: 'a' | 'b', value: string) =>
    setInputs((prev) => ({ ...prev, [mode]: { ...prev[mode], [field]: value } }));

  const handleSwap = () =>
    setInputs((prev) => ({ ...prev, change: { a: prev.change.b, b: prev.change.a } }));

  const handleCopy = async () => {
    if (outcome.kind !== 'ok') return;
    try {
      await navigator.clipboard.writeText(outcome.summary);
      setFlash('copy');
    } catch (e) {
      console.warn('Clipboard unavailable:', e);
    }
  };

  const handleSave = () => {
    if (outcome.kind !== 'ok') return;
    const entry: HistoryEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      mode,
      a: current.a,
      b: current.b,
      dir: dirFor(mode),
    };
    const rest = history.filter(
      (h) => !(h.mode === entry.mode && h.a === entry.a && h.b === entry.b && h.dir === entry.dir)
    );
    persistHistory([entry, ...rest].slice(0, MAX_HISTORY));
    setFlash('save');
  };

  const handleLoad = (entry: HistoryEntry) => {
    setMode(entry.mode);
    setInputs((prev) => ({ ...prev, [entry.mode]: { a: entry.a, b: entry.b } }));
    if (entry.mode === 'apply' || entry.mode === 'reverse') {
      const target: DirectionMode = entry.mode;
      setDirections((prev) => ({ ...prev, [target]: entry.dir }));
    }
  };

  const statCols =
    outcome.kind === 'ok'
      ? outcome.stats.length >= 3
        ? 'sm:grid-cols-3'
        : outcome.stats.length === 2
          ? 'sm:grid-cols-2'
          : 'sm:grid-cols-1'
      : '';

  return (
    <div className="space-y-6 md:space-y-8 animate-fadeIn font-sans">
      {/* Main Header Banner */}
      <PageHeader
        icon={Percent}
        eyebrow={t('percentage.badge')}
        title={t('percentage.title')}
        description={t('percentage.desc')}
      />

      {/* Mode Selector */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-1 bg-input-bg border border-border-color p-1 rounded-2xl text-[11px] font-extrabold select-none">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            aria-pressed={mode === m.id}
            onClick={() => setMode(m.id)}
            className={`py-2 px-2 rounded-xl transition-all cursor-pointer text-center last:col-span-2 sm:last:col-span-1 ${
              mode === m.id ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            {t(m.labelKey)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
        {/* Input Card */}
        <div className="glass-card p-5 md:p-6 space-y-5 lg:col-span-2">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b border-slate-200/50 dark:border-white/5 pb-2">
            <Percent className="h-4.5 w-4.5 text-emerald-400" />
            {t('percentage.inputHeader')}
          </h2>

          <p className="text-[11px] text-slate-400 leading-relaxed flex gap-2">
            <Info className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>{t(spec.hintKey)}</span>
          </p>

          <NumberField
            spec={spec.a}
            label={t(spec.a.labelKey)}
            value={current.a}
            language={language}
            onChange={(v) => updateField('a', v)}
          />

          {mode === 'change' && (
            <div className="flex justify-center -my-2">
              <button
                type="button"
                onClick={handleSwap}
                title={t('percentage.swap')}
                aria-label={t('percentage.swap')}
                className="h-8 w-8 rounded-full bg-white/5 border border-white/10 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/30 hover:rotate-180 flex items-center justify-center transition-all duration-300 cursor-pointer"
              >
                <ArrowUpDown className="h-4 w-4" />
              </button>
            </div>
          )}

          {directionMode && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {t('percentage.direction')}
              </span>
              <div className="flex bg-input-bg border border-border-color p-1 rounded-xl text-[11px] font-extrabold select-none">
                {(['up', 'down'] as const).map((d) => {
                  const active = directions[directionMode] === d;
                  return (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setDirections((prev) => ({ ...prev, [directionMode]: d }))}
                      className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        active
                          ? d === 'up'
                            ? 'bg-emerald-500 text-white shadow-md'
                            : 'bg-rose-500 text-white shadow-md'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {d === 'up' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
                      {t(d === 'up' ? 'percentage.increase' : 'percentage.decrease')}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <NumberField
            spec={spec.b}
            label={t(spec.b.labelKey)}
            value={current.b}
            language={language}
            onChange={(v) => updateField('b', v)}
          />

          {directionMode && (
            <div className="flex flex-wrap items-center gap-1.5 -mt-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mr-1">
                {t('percentage.presets')}
              </span>
              {PERCENT_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => updateField('b', String(p))}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                    toNumber(current.b) === p
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:border-white/20'
                  }`}
                >
                  {p}%
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Result Card */}
        <div className="glass-card p-5 md:p-6 space-y-5 lg:col-span-3" aria-live="polite">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200/50 dark:border-white/5 pb-2">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Sigma className="h-4.5 w-4.5 text-emerald-400" />
              {t('percentage.resultHeader')}
            </h2>
            {outcome.kind === 'ok' && mode === 'change' && <StatusBadge tone={outcome.tone} t={t} />}
          </div>

          {outcome.kind === 'empty' && (
            <div className="py-10 flex flex-col items-center justify-center gap-3 text-center">
              <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <Percent className="h-6 w-6 text-emerald-400" />
              </div>
              <p className="text-xs text-slate-400 max-w-xs">{t('percentage.empty')}</p>
            </div>
          )}

          {outcome.kind === 'error' && (
            <div className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/20 text-xs text-rose-300 flex gap-3">
              <AlertCircle className="h-5 w-5 text-rose-400 shrink-0" />
              <span>{outcome.message}</span>
            </div>
          )}

          {outcome.kind === 'ok' && (
            <>
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{outcome.label}</span>
                <div className={`text-4xl md:text-5xl font-black tracking-tight break-all ${TONE_TEXT[outcome.tone]}`}>
                  {outcome.headline}
                </div>
                <p className="text-xs md:text-sm text-slate-300">{outcome.summary}</p>
              </div>

              <div className={`grid grid-cols-1 ${statCols} gap-3`}>
                {outcome.stats.map((s) => (
                  <div key={s.label} className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-1 min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">{s.label}</span>
                    <span className={`text-base font-extrabold block break-all ${TONE_TEXT[s.tone]}`}>{s.value}</span>
                  </div>
                ))}
              </div>

              {outcome.note && (
                <div className="p-3.5 rounded-2xl bg-amber-500/5 border border-amber-500/20 text-[11px] text-amber-200/90 leading-relaxed flex gap-2">
                  <Info className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>{outcome.note}</span>
                </div>
              )}

              <div className="p-3.5 rounded-2xl bg-black/25 border border-white/5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{t('percentage.formula')}</span>
                <code className="block mt-1 text-xs font-mono text-slate-300 break-all">{outcome.formula}</code>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-300 hover:text-white flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  {flash === 'copy' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  {t(flash === 'copy' ? 'percentage.copied' : 'percentage.copy')}
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-xs font-bold text-white flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
                >
                  {flash === 'save' ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
                  {t(flash === 'save' ? 'percentage.saved' : 'percentage.save')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* History */}
      <div className="glass-card p-5 md:p-6 space-y-4">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200/50 dark:border-white/5 pb-2">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <History className="h-4.5 w-4.5 text-emerald-400" />
            {t('percentage.history')}
          </h2>
          {history.length > 0 && (
            <button
              type="button"
              onClick={() => persistHistory([])}
              className="text-[10px] font-bold text-slate-500 hover:text-rose-400 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t('percentage.clearHistory')}
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <p className="text-[11px] text-slate-500">{t('percentage.historyEmpty')}</p>
        ) : (
          <>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {history.map((entry) => {
                const o = computeOutcome(entry.mode, entry.a, entry.b, entry.dir, language, t);
                if (o.kind !== 'ok') return null;
                return (
                  <li key={entry.id}>
                    <button
                      type="button"
                      onClick={() => handleLoad(entry)}
                      className="w-full p-3 rounded-2xl bg-white/5 hover:bg-emerald-500/10 border border-white/10 hover:border-emerald-500/30 flex items-center justify-between gap-3 text-left transition-all cursor-pointer"
                    >
                      <div className="min-w-0">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block">
                          {t(MODE_BY_ID[entry.mode].labelKey)}
                        </span>
                        <span className="text-xs text-slate-300 block truncate">{o.summary}</span>
                      </div>
                      <span className={`text-sm font-black shrink-0 ${TONE_TEXT[o.tone]}`}>{o.headline}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="text-[10px] text-slate-500">{t('percentage.historyHint')}</p>
          </>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ tone, t }: { tone: Tone; t: Translate }) {
  if (tone === 'up' || tone === 'down') {
    const up = tone === 'up';
    return (
      <span
        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
          up ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
        }`}
      >
        {up ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
        {t(up ? 'percentage.statusUp' : 'percentage.statusDown')}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border bg-white/5 border-white/10 text-slate-300">
      <Minus className="h-3 w-3" />
      {t('percentage.statusFlat')}
    </span>
  );
}
