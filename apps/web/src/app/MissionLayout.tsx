import { useEffect, useRef } from 'react';
import { ExitMission } from './ExitMission.tsx';
import { Button, Card, GaugeBar, Hint, StatusBadge } from '../components/ui.tsx';
import { STAGE_HINTS } from '../features/education/hints.ts';
import { RequirementsStage } from '../features/requirements/RequirementsStage.tsx';
import { VerifyStage } from '../features/readiness/VerifyStage.tsx';
import { LaunchStage } from '../features/rooms/LaunchStage.tsx';
import { TeamBar } from '../features/rooms/TeamBar.tsx';
import { GoalsStage } from '../features/scenarios/GoalsStage.tsx';
import { ConceptStage } from '../features/studio/ConceptStage.tsx';
import { DesignStage } from '../features/studio/DesignStage.tsx';
import { useReview } from '../hooks/useReview.ts';
import { DIFFICULTY_LABEL, cx, pct } from '../lib/format.ts';
import { STAGES, useGame } from '../store/game.ts';

const STAGE_VIEW = {
  goals: GoalsStage,
  concept: ConceptStage,
  requirements: RequirementsStage,
  design: DesignStage,
  verify: VerifyStage,
  launch: LaunchStage,
} as const;

export function MissionLayout() {
  const data = useReview();
  const stage = useGame((s) => s.stage);
  const setStage = useGame((s) => s.setStage);
  const design = useGame((s) => s.design);
  const notice = useGame((s) => s.notice);
  const dismiss = useGame((s) => s.dismissNotice);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Move focus to the stage heading when the stage changes (keyboard and screen-reader users).
  useEffect(() => {
    headingRef.current?.focus();
  }, [stage]);

  if (!data || !design) return null;
  const { review, scenario } = data;
  const index = STAGES.findIndex((s) => s.id === stage);
  const current = STAGES[index]!;
  const View = STAGE_VIEW[stage];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm text-slate-400">
          {scenario.name} · {DIFFICULTY_LABEL[design.difficulty]}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-slate-400">
            Readiness {pct(review.readiness.greenFraction)} green ·{' '}
            {review.canLaunch ? 'launch allowed' : 'launch blocked'}
          </p>
          <ExitMission />
        </div>
      </div>

      <nav aria-label="Mission stages">
        <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {STAGES.map((s, i) => (
            <li key={s.id}>
              <button
                type="button"
                aria-current={s.id === stage ? 'step' : undefined}
                onClick={() => setStage(s.id)}
                className={cx(
                  'w-full rounded-md border px-2 py-2 text-left text-sm',
                  s.id === stage
                    ? 'border-sky-400 bg-sky-950 text-sky-50'
                    : 'border-slate-700 hover:bg-slate-800',
                )}
              >
                <span className="block text-xs text-slate-400">Stage {i + 1}</span>
                {s.title}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <TeamBar />

      {notice && (
        <div
          role="status"
          className="flex items-center justify-between gap-2 rounded-md border border-sky-600 bg-sky-950 p-2 text-sm"
        >
          <span>{notice}</span>
          <Button variant="ghost" onClick={dismiss}>
            Dismiss
          </Button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <section className="min-w-0 space-y-4" aria-labelledby="stage-heading">
          <h2
            id="stage-heading"
            ref={headingRef}
            tabIndex={-1}
            className="text-2xl font-semibold focus:outline-none"
          >
            Stage {index + 1}: {current.title}
          </h2>
          {design.difficulty === 'explorer' && <Hint>{STAGE_HINTS[stage]}</Hint>}
          <View />
          <div className="flex justify-between border-t border-slate-800 pt-4">
            <Button disabled={index === 0} onClick={() => setStage(STAGES[index - 1]!.id)}>
              ← {STAGES[index - 1]?.title ?? 'Back'}
            </Button>
            {index < STAGES.length - 1 && (
              <Button variant="primary" onClick={() => setStage(STAGES[index + 1]!.id)}>
                {STAGES[index + 1]!.title} →
              </Button>
            )}
          </div>
        </section>

        <aside aria-label="Resources" className="space-y-3 lg:sticky lg:top-4 lg:h-fit">
          <Card className="space-y-4">
            <h3 className="font-semibold">Resources</h3>
            {review.gauges.map((g) => (
              <GaugeBar key={g.key} gauge={g} />
            ))}
          </Card>
          <Card className="space-y-2">
            <h3 className="font-semibold">Problems</h3>
            {review.issues.length === 0 ? (
              <p className="text-sm text-slate-300">None. Nice work.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {review.issues.slice(0, 6).map((i) => (
                  <li key={i.code + i.message} className="flex items-start gap-2">
                    <StatusBadge
                      status={i.severity === 'error' ? 'red' : 'yellow'}
                      label={i.severity === 'error' ? '✕' : '!'}
                    />
                    <span>{i.message}</span>
                  </li>
                ))}
                {review.issues.length > 6 && (
                  <li className="text-slate-400">
                    and {review.issues.length - 6} more in Build &amp; Verify
                  </li>
                )}
              </ul>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
