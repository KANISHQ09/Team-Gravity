import { useEffect, useRef, useState } from 'react';
import type { DesignReview } from '@gravity/engine';
import type { Design } from '@gravity/shared';
import { ExitMission } from './ExitMission.tsx';
import { DesignAnalysis } from '../features/readiness/DesignAnalysis.tsx';
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
import { DIFFICULTY_LABEL, bodyName, cx, fmt, pct } from '../lib/format.ts';
import { PLANET_PHOTO } from '../lib/planets.ts';
import { STAGES, type StageId, useGame } from '../store/game.ts';

const STAGE_VIEW = {
  goals: GoalsStage,
  concept: ConceptStage,
  requirements: RequirementsStage,
  design: DesignStage,
  verify: VerifyStage,
  launch: LaunchStage,
} as const;

/** Whether each stage's job is done, for the ✓ marks in the stage stepper. */
function stageDone(id: StageId, design: Design, review: DesignReview): boolean {
  const errorsIn = (areas: string[]) =>
    review.issues.some((i) => i.severity === 'error' && areas.includes(i.area));
  switch (id) {
    case 'goals':
      return design.goalIds.length > 0 && !errorsIn(['goals']);
    case 'concept':
      return !!design.orbitId && !!design.launchVehicleId && !errorsIn(['orbit', 'launch']);
    case 'requirements':
      return (
        review.requirements.length > 0 && review.requirements.every((r) => r.status === 'pass')
      );
    case 'design':
      return design.partIds.length > 0 && !errorsIn(['parts']);
    case 'verify':
      return review.readiness.ready;
    case 'launch':
      return review.canLaunch;
  }
}

/** Ring that fills with the share of green readiness checks. */
function ReadinessRing({ fraction, ready }: { fraction: number; ready: boolean }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 56 56" className="h-14 w-14 shrink-0 -rotate-90" aria-hidden="true">
      <circle cx="28" cy="28" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
      <circle
        cx="28"
        cy="28"
        r={r}
        fill="none"
        stroke={ready ? '#34d399' : fraction >= 0.8 ? '#fbbf24' : '#fb923c'}
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={`${c * fraction} ${c}`}
        className="transition-[stroke-dasharray] duration-700"
      />
    </svg>
  );
}

export function MissionLayout() {
  const data = useReview();
  const stage = useGame((s) => s.stage);
  const setStage = useGame((s) => s.setStage);
  const design = useGame((s) => s.design);
  const notice = useGame((s) => s.notice);
  const dismiss = useGame((s) => s.dismissNotice);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [analysing, setAnalysing] = useState(false);

  // Move focus to the stage heading when the stage changes (keyboard and screen-reader users).
  useEffect(() => {
    headingRef.current?.focus();
  }, [stage]);

  if (!data || !design) return null;
  const { review, scenario } = data;
  const index = STAGES.findIndex((s) => s.id === stage);
  const current = STAGES[index]!;
  const View = STAGE_VIEW[stage];
  const photo = PLANET_PHOTO[scenario.body];
  const doneCount = STAGES.filter((s) => stageDone(s.id, design, review)).length;

  return (
    <div className="space-y-5">
      {/* Mission header */}
      <header className="relative overflow-hidden rounded-2xl border border-white/10 bg-black">
        <img
          src={photo.src}
          alt=""
          className="pointer-events-none absolute -right-16 top-1/2 h-64 w-64 -translate-y-1/2 rounded-full opacity-70 md:h-80 md:w-80"
          style={{ boxShadow: `0 0 80px ${photo.glow}` }}
        />
        <div className="relative flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-black via-black/90 to-black/30 p-5 md:p-6">
          <div className="min-w-0 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-orange-400">
              Mission to {bodyName(scenario.body)}
            </p>
            <p className="text-2xl font-black uppercase tracking-tight text-white md:text-3xl">
              {scenario.name}
            </p>
            <ul className="flex flex-wrap gap-2 text-xs" aria-label="Mission facts">
              <li className="rounded-full border border-white/15 bg-white/5 px-3 py-1">
                {DIFFICULTY_LABEL[design.difficulty]}
              </li>
              <li className="rounded-full border border-white/15 bg-white/5 px-3 py-1">
                Budget {fmt(scenario.budgetM)} M$
              </li>
              <li className="rounded-full border border-white/15 bg-white/5 px-3 py-1">
                {scenario.missionDays} days of science
              </li>
              <li className="rounded-full border border-white/15 bg-white/5 px-3 py-1">
                Baseline {scenario.baselineScience} science points
              </li>
            </ul>
          </div>
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-black/60 p-3 backdrop-blur">
            <ReadinessRing fraction={review.readiness.greenFraction} ready={review.canLaunch} />
            <p className="text-sm">
              <span className="block font-bold text-white">
                Readiness {pct(review.readiness.greenFraction)} green
              </span>
              <span className={review.canLaunch ? 'text-emerald-300' : 'text-orange-300'}>
                {review.canLaunch ? 'Launch allowed' : 'Launch blocked'}
              </span>
            </p>
            <Button
              variant={review.canLaunch ? 'secondary' : 'primary'}
              aria-expanded={analysing}
              onClick={() => setAnalysing((a) => !a)}
            >
              Analyse my design
            </Button>
            <ExitMission />
          </div>
        </div>
      </header>

      {analysing && <DesignAnalysis onClose={() => setAnalysing(false)} />}

      {/* Stage stepper */}
      <nav aria-label="Mission stages" className="space-y-2">
        <div
          className="h-1 overflow-hidden rounded-full bg-white/10"
          role="progressbar"
          aria-label="Stages done"
          aria-valuemin={0}
          aria-valuemax={STAGES.length}
          aria-valuenow={doneCount}
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-300 transition-[width] duration-500"
            style={{ width: `${(doneCount / STAGES.length) * 100}%` }}
          />
        </div>
        <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {STAGES.map((s, i) => {
            const active = s.id === stage;
            const done = stageDone(s.id, design, review);
            return (
              <li key={s.id}>
                <button
                  type="button"
                  aria-current={active ? 'step' : undefined}
                  onClick={() => setStage(s.id)}
                  className={cx(
                    'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition',
                    active
                      ? 'border-orange-400 bg-orange-500/10 text-white shadow-[0_0_20px_rgba(249,115,22,0.15)]'
                      : 'border-white/10 bg-white/[0.02] text-slate-300 hover:border-white/30',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cx(
                      'grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-black',
                      done
                        ? 'bg-emerald-500 text-black'
                        : active
                          ? 'bg-orange-500 text-black'
                          : 'border border-white/20 text-slate-300',
                    )}
                  >
                    {done ? '✓' : i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[10px] uppercase tracking-[0.2em] text-slate-400">
                      Stage {i + 1}
                      {done && <span className="sr-only"> (done)</span>}
                    </span>
                    <span className="block truncate font-semibold">{s.title}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <TeamBar />

      {notice && (
        <div
          role="status"
          className="flex items-center justify-between gap-2 rounded-xl border border-sky-500/50 bg-sky-950/60 p-3 text-sm"
        >
          <span>{notice}</span>
          <Button variant="ghost" onClick={dismiss}>
            Dismiss
          </Button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_19rem]">
        <section className="min-w-0 space-y-5" aria-labelledby="stage-heading">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-orange-400">
              Step {index + 1} of {STAGES.length}
            </p>
            <h2
              id="stage-heading"
              ref={headingRef}
              tabIndex={-1}
              className="mt-1 text-3xl font-black tracking-tight focus:outline-none"
            >
              Stage {index + 1}: {current.title}
            </h2>
          </div>
          {design.difficulty === 'explorer' && <Hint>{STAGE_HINTS[stage]}</Hint>}
          <View />
          <div className="flex justify-between border-t border-white/10 pt-4">
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

        <aside aria-label="Resources" className="space-y-3 lg:sticky lg:top-20 lg:h-fit">
          <Card className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-[0.25em] text-slate-300">
              Resources
            </h3>
            {review.gauges.map((g) => (
              <GaugeBar key={g.key} gauge={g} />
            ))}
            <p className="text-[11px] text-slate-500">
              The white line marks where your required spare margin starts.
            </p>
          </Card>
          <Card className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-[0.25em] text-slate-300">
              Problems
            </h3>
            {review.issues.length === 0 ? (
              <p className="text-sm text-emerald-300">None. Nice work.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
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
