import { useEffect, useMemo, useState } from 'react';
import { PHASE_NAMES, type SimPhase, catalog } from '@gravity/engine';
import { Button, Card, StatusBadge } from '../../components/ui.tsx';
import { useReducedMotion } from '../../hooks/useReducedMotion.ts';
import { fmt } from '../../lib/format.ts';
import { useGame } from '../../store/game.ts';
import { MissionReplay } from '../replay/MissionReplay.tsx';

const SPEEDS = [1, 5, 20] as const;
/** Simulated days per second at 1× speed. */
const DAYS_PER_SECOND = 25;

/** Live mission dashboard with pause / speed / skip (SRS-SIM-05, SRS-SIM-06). */
export function FlightScreen() {
  const result = useGame((s) => s.result);
  const go = useGame((s) => s.go);
  const reduced = useReducedMotion();
  const run = result?.run;
  const orbit = run ? catalog.orbits.find((o) => o.id === run.design.orbitId) : undefined;
  const scenario = run ? catalog.scenarios.find((s) => s.id === run.design.scenarioId) : undefined;
  const transfer = orbit?.transferDays ?? 0;
  const lastDay = run?.samples.at(-1)?.day ?? transfer;
  const totalDays = Math.max(1, lastDay);
  const endDay =
    run?.failurePhase === 'launch' ? 0 : run?.failurePhase === 'insertion' ? transfer : totalDays;

  const [day, setDay] = useState(reduced ? endDay : -30);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(5);
  const [playing, setPlaying] = useState(!reduced);

  useEffect(() => {
    if (!playing || day >= endDay) return;
    const id = window.setInterval(() => {
      setDay((d) => Math.min(endDay, d + (DAYS_PER_SECOND * speed) / 10));
    }, 100);
    return () => window.clearInterval(id);
  }, [playing, speed, day, endDay]);

  const visibleEvents = useMemo(
    // Show events in time order (they are generated per system, not chronologically).
    () => (run ? run.events.filter((e) => e.day <= day).sort((x, y) => x.day - y.day) : []),
    [run, day],
  );
  if (!run || !orbit || !scenario) return null;

  const sample = [...run.samples].reverse().find((s) => s.day <= day);
  const phase: SimPhase =
    day < 0
      ? 'development'
      : day < 1
        ? 'launch'
        : day < transfer
          ? 'transfer'
          : day < transfer + 2 && transfer > 0
            ? 'insertion'
            : day >= endDay && run.outcome !== 'failure'
              ? 'end-of-life'
              : 'science';
  const done = day >= endDay;
  const science = done ? run.science : (sample?.science ?? 0);
  const progress = Math.max(0, Math.min(1, day / totalDays));

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold" tabIndex={-1}>
        Mission in flight: {scenario.name}
      </h2>
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          <MissionReplay
            target={scenario.body}
            transferShare={transfer / totalDays}
            progress={progress}
            failed={done && !!run.failurePhase && run.failurePhase !== 'science'}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => setPlaying((p) => !p)} disabled={done}>
              {playing && !done ? 'Pause' : 'Play'}
            </Button>
            <span className="text-sm text-slate-400">Speed:</span>
            {SPEEDS.map((s) => (
              <Button
                key={s}
                variant={speed === s ? 'primary' : 'secondary'}
                aria-pressed={speed === s}
                onClick={() => setSpeed(s)}
              >
                {s}×
              </Button>
            ))}
            <Button variant="ghost" onClick={() => setDay(endDay)} disabled={done}>
              Skip to end
            </Button>
          </div>
          <section aria-labelledby="events-heading">
            <h3 id="events-heading" className="mb-2 text-lg font-semibold">
              Mission log
            </h3>
            <ol className="space-y-2" aria-live="polite">
              {visibleEvents.length === 0 && (
                <li className="text-sm text-slate-400">No events yet.</li>
              )}
              {visibleEvents.map((e, i) => (
                <li key={i} className="rounded-md border border-slate-700 bg-slate-900 p-2 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-slate-400">
                      {e.day < 0 ? `L${e.day}` : `Day ${e.day}`}
                    </span>
                    <span className="font-medium">{e.title}</span>
                    {e.mitigated ? (
                      <StatusBadge status="green" label="Handled" />
                    ) : (
                      <StatusBadge status="yellow" label="Impact" />
                    )}
                  </div>
                  <p className="mt-1 text-slate-300">{e.effect}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <Card className="h-fit space-y-3">
          <h3 className="text-lg font-semibold">Dashboard</h3>
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-slate-400">Mission clock</dt>
            <dd>{day < 0 ? `Launch in ${fmt(-day)} days` : `Day ${fmt(day)}`}</dd>
            <dt className="text-slate-400">Phase</dt>
            <dd aria-live="polite">{PHASE_NAMES[phase]}</dd>
            <dt className="text-slate-400">Battery health</dt>
            <dd>{sample ? `${sample.batteryPct}%` : '100%'}</dd>
            <dt className="text-slate-400">Data sent home</dt>
            <dd>{fmt(sample?.dataReturnedGbit ?? 0)} Gbit</dd>
            <dt className="text-slate-400">Data lost</dt>
            <dd>{fmt(sample?.dataLostGbit ?? 0)} Gbit</dd>
            <dt className="text-slate-400">Science</dt>
            <dd>
              {fmt(science)} / {run.baselineScience}
            </dd>
          </dl>
          <div
            role="meter"
            aria-label="Science toward Baseline"
            aria-valuemin={0}
            aria-valuemax={run.baselineScience}
            aria-valuenow={Math.round(Math.min(science, run.baselineScience))}
            className="h-2 overflow-hidden rounded bg-slate-800"
          >
            <div
              className="h-full bg-sky-400"
              style={{ width: `${Math.min(100, (science / run.baselineScience) * 100)}%` }}
            />
          </div>
          {done && (
            <div className="space-y-2" role="status">
              <p className="font-semibold">
                {run.outcome === 'full'
                  ? 'Full success!'
                  : run.outcome === 'partial'
                    ? 'Partial success.'
                    : `Mission failed: ${run.failureReason}`}
              </p>
              <Button variant="primary" className="w-full" onClick={() => go('report')}>
                See the mission report
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
