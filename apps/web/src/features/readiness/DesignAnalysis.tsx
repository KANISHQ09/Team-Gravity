import { useEffect, useRef, useState } from 'react';
import { type AutoFixResult, autoFix, catalog } from '@gravity/engine';
import { Button, StatusBadge } from '../../components/ui.tsx';
import { useReview } from '../../hooks/useReview.ts';
import { useGame } from '../../store/game.ts';
import { useOnline } from '../../store/online.ts';

/**
 * "Analyse my design": every problem with its fix, a one-click auto-fix that
 * explains each change, and a shortcut to the launch stage once it is ready.
 */
export function DesignAnalysis({ onClose }: { onClose: () => void }) {
  const data = useReview();
  const design = useGame((s) => s.design);
  const applyEdits = useGame((s) => s.applyEdits);
  const setStage = useGame((s) => s.setStage);
  const online = useOnline((s) => s.active);
  const [fixing, setFixing] = useState(false);
  const [result, setResult] = useState<AutoFixResult | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  if (!data || !design) return null;
  const { review } = data;
  const errors = review.issues.filter((i) => i.severity === 'error');
  const warnings = review.issues.filter((i) => i.severity !== 'error');
  const checks = review.readiness.items.filter((i) => i.status !== 'green');
  const problemCount = errors.length + checks.filter((c) => c.status === 'red').length;

  const runFix = () => {
    setFixing(true);
    // Let the "Working…" state paint before the search runs (it takes well under a second).
    window.setTimeout(() => {
      const r = autoFix(design, catalog);
      applyEdits(r.steps.flatMap((s) => s.edits));
      setResult(r);
      setFixing(false);
    }, 30);
  };

  return (
    <section
      aria-labelledby="analysis-heading"
      className="space-y-4 rounded-xl border border-sky-500/40 bg-slate-950/80 p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3
          id="analysis-heading"
          ref={headingRef}
          tabIndex={-1}
          className="text-lg font-semibold focus:outline-none"
        >
          Design analysis
        </h3>
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>

      <p role="status" className="flex flex-wrap items-center gap-2 text-sm">
        {review.canLaunch ? (
          <>
            <StatusBadge status="green" label="Ready to launch" />
            <span className="text-slate-300">
              Readiness {Math.round(review.readiness.greenFraction * 100)}% green and nothing blocks
              the launch.
            </span>
          </>
        ) : (
          <>
            <StatusBadge status="red" label="Launch blocked" />
            <span className="text-slate-300">
              {problemCount} problem{problemCount === 1 ? '' : 's'} to fix before launch.
            </span>
          </>
        )}
      </p>

      {result && (
        <div className="space-y-2 rounded-lg border border-emerald-500/40 bg-emerald-950/30 p-3">
          <p className="font-semibold">
            {result.steps.length === 0
              ? 'Nothing needed changing.'
              : `Auto-fix made ${result.steps.length} change${result.steps.length === 1 ? '' : 's'}:`}
          </p>
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            {result.steps.map((s, i) => (
              <li key={i}>
                <span className="font-medium">{s.title}</span>
                {s.fixed.length > 0 && (
                  <span className="text-slate-400"> (fixes: {s.fixed.join('; ')})</span>
                )}
              </li>
            ))}
          </ol>
          {!result.launchable && (
            <p className="text-sm text-amber-200">
              Still to sort out by hand: {result.remaining.join('; ')}.
            </p>
          )}
          {result.steps.length > 0 && (
            <p className="text-xs text-slate-400">
              Look the changes over on the Design stage; you can undo any of them by hand.
            </p>
          )}
        </div>
      )}

      {(errors.length > 0 || checks.length > 0) && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
            {review.canLaunch ? 'Worth improving (not blocking)' : 'Problems and how to fix them'}
          </h4>
          <ul className="space-y-2">
            {errors.map((i) => (
              <li
                key={`e-${i.code}-${i.message}`}
                className="rounded-md border border-slate-800 p-2 text-sm"
              >
                <div className="flex items-start gap-2">
                  <StatusBadge status="red" label="Blocks launch" />
                  <span className="font-medium">{i.message}</span>
                </div>
                <p className="mt-1 text-slate-300">Fix: {i.fix}</p>
              </li>
            ))}
            {checks
              .filter((c) => !errors.length || c.status === 'red' || c.critical)
              .map((c) => (
                <li key={`c-${c.id}`} className="rounded-md border border-slate-800 p-2 text-sm">
                  <div className="flex items-start gap-2">
                    <StatusBadge
                      status={c.status === 'red' ? 'red' : 'yellow'}
                      label={c.critical ? 'Critical check' : c.status === 'red' ? 'Red' : 'Yellow'}
                    />
                    <span className="font-medium">{c.label}</span>
                  </div>
                  <p className="mt-1 text-slate-400">{c.detail}</p>
                  {c.fix && <p className="text-slate-300">Fix: {c.fix}</p>}
                </li>
              ))}
          </ul>
        </div>
      )}

      {warnings.length > 0 && review.canLaunch && (
        <p className="text-xs text-slate-400">
          Tips (not blocking): {warnings.map((w) => w.message).join('; ')}.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-slate-800 pt-3">
        {!review.canLaunch && (
          <Button variant="primary" onClick={runFix} disabled={fixing || online}>
            {fixing ? 'Working…' : 'Auto-fix my design'}
          </Button>
        )}
        <Button
          variant={review.canLaunch ? 'primary' : 'secondary'}
          disabled={!review.canLaunch}
          onClick={() => {
            onClose();
            setStage('launch');
          }}
        >
          Go to launch →
        </Button>
        {online && (
          <span className="text-xs text-slate-400">
            Auto-fix works in solo missions; in a room, each role fixes its own parts.
          </span>
        )}
        {!review.canLaunch && !online && (
          <span className="text-xs text-slate-400">
            Auto-fix changes as little as it can and explains every step.
          </span>
        )}
      </div>
    </section>
  );
}
