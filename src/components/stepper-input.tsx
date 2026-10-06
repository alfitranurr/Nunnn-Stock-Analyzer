'use client';

import * as React from 'react';
import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

type StepDirection = 1 | -1;

const REPEAT_DELAY_MS = 400;
const REPEAT_INTERVAL_MS = 70;

// Klik = satu langkah; ditahan = langkah berulang sampai dilepas.
function useRepeatPress(onStep: () => void, disabled: boolean) {
  const stepRef = React.useRef(onStep);
  const timeoutRef = React.useRef<number | null>(null);
  const intervalRef = React.useRef<number | null>(null);

  React.useLayoutEffect(() => {
    stepRef.current = onStep;
  }, [onStep]);

  const stop = React.useCallback(() => {
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
    timeoutRef.current = null;
    intervalRef.current = null;
  }, []);

  const start = React.useCallback(() => {
    stop();
    stepRef.current();
    timeoutRef.current = window.setTimeout(() => {
      intervalRef.current = window.setInterval(() => stepRef.current(), REPEAT_INTERVAL_MS);
    }, REPEAT_DELAY_MS);
  }, [stop]);

  // Tombol yang menjadi disabled (mis. sudah di batas minimum) tidak menerima pointerup.
  React.useEffect(() => {
    if (disabled) stop();
  }, [disabled, stop]);

  React.useEffect(() => stop, [stop]);

  return { start, stop, stepOnce: () => stepRef.current() };
}

function StepButton({
  direction,
  label,
  disabled,
  onStep,
}: {
  direction: StepDirection;
  label: string;
  disabled: boolean;
  onStep: (direction: StepDirection) => void;
}) {
  const handleStep = React.useCallback(() => onStep(direction), [onStep, direction]);
  const { start, stop, stepOnce } = useRepeatPress(handleStep, disabled);
  const Icon = direction > 0 ? Plus : Minus;

  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={label}
      title={label}
      disabled={disabled}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault(); // jaga fokus tetap di input
        start();
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onContextMenu={(e) => e.preventDefault()}
      onClick={(e) => {
        // Aktivasi keyboard (Enter/Spasi) tidak melewati pointerdown.
        if (e.detail === 0) stepOnce();
      }}
      className="w-7 shrink-0 flex items-center justify-center text-slate-400 hover:text-emerald-400 hover:bg-white/5 active:bg-emerald-500/15 disabled:opacity-30 disabled:hover:text-slate-400 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors cursor-pointer select-none touch-manipulation"
    >
      <Icon className="h-3 w-3" strokeWidth={3} />
    </button>
  );
}

export interface StepperInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'className'> {
  onStep: (direction: StepDirection) => void;
  decrementLabel: string;
  incrementLabel: string;
  canDecrement?: boolean;
  canIncrement?: boolean;
  invalid?: boolean;
  /** Elemen tambahan di dalam kotak, di antara input dan tombol + (mis. tombol refresh harga). */
  adornment?: React.ReactNode;
  className?: string;
  inputClassName?: string;
}

/**
 * Input angka dengan tombol −/+ di kedua sisi. Tetap bisa diketik bebas;
 * panah ↑/↓ pada keyboard juga menaikkan/menurunkan nilai.
 */
export function StepperInput({
  onStep,
  decrementLabel,
  incrementLabel,
  canDecrement = true,
  canIncrement = true,
  invalid = false,
  adornment,
  className,
  inputClassName,
  onKeyDown,
  ...inputProps
}: StepperInputProps) {
  return (
    <div
      className={cn(
        'glass-input flex items-stretch overflow-hidden focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20',
        invalid && 'border-amber-500/60 focus-within:border-amber-500 focus-within:ring-amber-500/20',
        className
      )}
    >
      <StepButton direction={-1} label={decrementLabel} disabled={!canDecrement} onStep={onStep} />
      <input
        {...inputProps}
        aria-invalid={invalid || undefined}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp' && canIncrement) {
            e.preventDefault();
            onStep(1);
          } else if (e.key === 'ArrowDown' && canDecrement) {
            e.preventDefault();
            onStep(-1);
          }
          onKeyDown?.(e);
        }}
        className={cn(
          'flex-1 min-w-0 bg-transparent border-0 outline-none text-center text-xs font-semibold py-2.5 px-0.5 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
          inputClassName
        )}
      />
      {adornment}
      <StepButton direction={1} label={incrementLabel} disabled={!canIncrement} onStep={onStep} />
    </div>
  );
}
