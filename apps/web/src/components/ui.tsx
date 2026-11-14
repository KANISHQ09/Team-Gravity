import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { Gauge } from '@gravity/engine';
import { cx, fmt, pct } from '../lib/format.ts';

export function Button({
  variant = 'secondary',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
}) {
  return (
    <button
      type="button"
      {...props}
      className={cx(
        'rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300 disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'primary' && 'bg-sky-500 text-slate-950 hover:bg-sky-400',
        variant === 'secondary' &&
          'border border-slate-600 bg-slate-800 text-slate-100 hover:bg-slate-700',
        variant === 'ghost' && 'text-sky-300 hover:bg-slate-800',
        variant === 'danger' &&
          'border border-rose-500 bg-rose-950 text-rose-100 hover:bg-rose-900',
        className,
      )}
    />
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx('rounded-lg border border-slate-700 bg-slate-900/80 p-4', className)}>
      {children}
    </div>
  );
}

type Status = 'ok' | 'warning' | 'over' | 'unknown' | 'green' | 'yellow' | 'red' | 'pass' | 'fail';

const STATUS: Record<Status, { label: string; icon: string; cls: string }> = {
  ok: { label: 'OK', icon: '✓', cls: 'bg-emerald-900 text-emerald-100 border-emerald-500' },
  green: { label: 'Green', icon: '✓', cls: 'bg-emerald-900 text-emerald-100 border-emerald-500' },
  pass: { label: 'Pass', icon: '✓', cls: 'bg-emerald-900 text-emerald-100 border-emerald-500' },
  warning: { label: 'Low margin', icon: '!', cls: 'bg-amber-900 text-amber-100 border-amber-400' },
  yellow: { label: 'Yellow', icon: '!', cls: 'bg-amber-900 text-amber-100 border-amber-400' },
  over: { label: 'Over limit', icon: '✕', cls: 'bg-rose-900 text-rose-100 border-rose-400' },
  red: { label: 'Red', icon: '✕', cls: 'bg-rose-900 text-rose-100 border-rose-400' },
  fail: { label: 'Fail', icon: '✕', cls: 'bg-rose-900 text-rose-100 border-rose-400' },
  unknown: { label: 'Not set', icon: '?', cls: 'bg-slate-800 text-slate-200 border-slate-500' },
};

/** Status shown with an icon and a word, never by colour alone (WCAG 1.4.1). */
export function StatusBadge({ status, label }: { status: Status; label?: string }) {
  const s = STATUS[status];
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-semibold',
        s.cls,
      )}
    >
      <span aria-hidden="true">{s.icon}</span>
      {label ?? s.label}
    </span>
  );
}

export function GaugeBar({ gauge }: { gauge: Gauge }) {
  const fill =
    gauge.limit && gauge.limit > 0
      ? Math.min(100, (gauge.used / gauge.limit) * 100)
      : gauge.used > 0
        ? 100
        : 0;
  const color =
    gauge.status === 'over'
      ? 'bg-rose-500'
      : gauge.status === 'warning'
        ? 'bg-amber-400'
        : gauge.status === 'ok'
          ? 'bg-emerald-500'
          : 'bg-slate-500';
  const value = `${fmt(gauge.used, 1)} of ${gauge.limit === null ? '?' : fmt(gauge.limit, 1)} ${gauge.unit}`;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="font-medium">
          {gauge.label}
          {gauge.critical && <span className="ml-1 text-xs text-sky-300">(critical)</span>}
        </span>
        <StatusBadge status={gauge.status} />
      </div>
      <div
        role="meter"
        aria-label={gauge.label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(fill)}
        aria-valuetext={`${value}, ${gauge.margin === null ? 'limit not known' : `${pct(gauge.margin)} margin`}`}
        className="h-2 overflow-hidden rounded bg-slate-800"
      >
        <div className={cx('h-full', color)} style={{ width: `${fill}%` }} />
      </div>
      <p className="text-xs text-slate-400">
        {value}
        {gauge.margin !== null && ` · ${pct(gauge.margin)} spare (target ${pct(gauge.target)})`}
      </p>
    </div>
  );
}

export function Hint({ children }: { children: ReactNode }) {
  return (
    <aside className="rounded-md border border-sky-700 bg-sky-950/60 p-3 text-sm text-sky-100">
      <span className="font-semibold">Hint: </span>
      {children}
    </aside>
  );
}

export function Why({
  summary = 'Why does this matter?',
  children,
}: {
  summary?: string;
  children: ReactNode;
}) {
  return (
    <details className="text-sm text-slate-300">
      <summary className="cursor-pointer text-sky-300 hover:underline">{summary}</summary>
      <div className="mt-1">{children}</div>
    </details>
  );
}
