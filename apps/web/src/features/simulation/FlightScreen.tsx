/* eslint-disable react-hooks/immutability -- Three.js objects and the 60 fps game state are mutated outside React on purpose (render loop), not during render. */
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PHASE_NAMES, type SimPhase, catalog } from '@gravity/engine';
import { Button, Card, StatusBadge } from '../../components/ui.tsx';
import { use3DView } from '../../hooks/use3DView.ts';
import { useReducedMotion } from '../../hooks/useReducedMotion.ts';
import { cx, fmt } from '../../lib/format.ts';
import { useGame } from '../../store/game.ts';
import { anomalyInfo, anomalyStart } from '../pilot/anomalyGame.ts';
import { type ActiveGame, gameResult, newFlightSim } from '../pilot/flightSim.ts';
import { insertionStart } from '../pilot/insertionGame.ts';
import { launchStart } from '../pilot/launchGame.ts';
import { PilotHud, useFlightKeys } from '../pilot/PilotHud.tsx';
import { AUTOPILOT_SCORE, type PilotGameResult, pilotSummary } from '../pilot/pilotScore.ts';
import { scienceStart } from '../pilot/scienceGame.ts';
import { CAPTURE_TARGET, earthOrbitRatio } from '../replay/flightGeometry.ts';
import { type FlightTimeline, LAUNCH_START, flightRate, shotAt } from '../replay/flightTimeline.ts';
import { MissionReplay } from '../replay/MissionReplay.tsx';

const FlightScene3D = lazy(() => import('../replay/FlightScene3D.tsx'));

const SPEEDS = [1, 5, 20] as const;

interface Checkpoint {
  readonly day: number;
  readonly make: () => ActiveGame;
}

/** Live mission dashboard with pause / speed / skip (SRS-SIM-05, SRS-SIM-06), plus 3D flight with mini-games. */
export function FlightScreen() {
  const result = useGame((s) => s.result);
  const go = useGame((s) => s.go);
  const setPilot = useGame((s) => s.setPilot);
  const pilot = useGame((s) => s.pilot);
  const reduced = useReducedMotion();
  const view = use3DView();
  const cinematic = view.on;
  const run = result?.run;
  const orbit = run ? catalog.orbits.find((o) => o.id === run.design.orbitId) : undefined;
  const scenario = run ? catalog.scenarios.find((s) => s.id === run.design.scenarioId) : undefined;
  const transfer = orbit?.transferDays ?? 0;
  const lastDay = run?.samples.at(-1)?.day ?? transfer;
  const totalDays = Math.max(1, lastDay);
  const endDay =
    run?.failurePhase === 'launch' ? 0 : run?.failurePhase === 'insertion' ? transfer : totalDays;

  const [day, setDay] = useState(reduced && !cinematic ? endDay : -30);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(5);
  const [playing, setPlaying] = useState(!reduced || cinematic);

  // ----- 3D flight mini-games -----
  const sim = useMemo(() => newFlightSim(), []);
  const [gameOn, setGameOn] = useState(false);
  const [results, setResults] = useState<PilotGameResult[]>([]);
  const [toast, setToast] = useState<PilotGameResult | null>(null);
  const done = useRef(new Set<number>());
  const timeline = useMemo<FlightTimeline | null>(
    () =>
      run && scenario
        ? {
            target: scenario.body,
            transfer,
            endDay,
            failurePhase: run.failurePhase,
            outcome: run.outcome,
          }
        : null,
    [run, scenario, transfer, endDay],
  );

  const checkpoints = useMemo<Checkpoint[]>(() => {
    if (!run || !scenario || !orbit || !cinematic) return [];
    const cps: Checkpoint[] = [];
    const base = { started: false, auto: false, finished: false };
    cps.push({
      day: LAUNCH_START,
      make: () => ({
        ...base,
        id: 'launch',
        label: 'Fly the launch',
        type: 'launch',
        s: launchStart(),
      }),
    });
    if (run.failurePhase === 'launch') return cps;
    if (run.failurePhase !== 'insertion') {
      const capture = scenario.body !== 'earth';
      cps.push({
        day: capture ? transfer - 1 : 0.65,
        make: () => ({
          ...base,
          id: 'insertion',
          label: capture ? 'Orbit insertion burn' : 'Circularisation burn',
          type: 'insertion',
          s: insertionStart(
            capture ? 'capture' : 'circularize',
            capture ? CAPTURE_TARGET : earthOrbitRatio(orbit.altitudeKm),
          ),
        }),
      });
      const scienceDay = capture ? transfer + 2 : 1.05;
      if (scienceDay < endDay) {
        cps.push({
          day: scienceDay,
          make: () => ({
            ...base,
            id: 'science',
            label: 'Science pass',
            type: 'science',
            s: scienceStart(run.seed),
          }),
        });
        run.events
          .filter((e) => e.day > scienceDay && e.day < endDay && anomalyInfo(e.type))
          .sort((a, b) => a.day - b.day)
          .slice(0, 2)
          .forEach((e, i) => {
            const info = anomalyInfo(e.type)!;
            cps.push({
              day: e.day,
              make: () => ({
                ...base,
                id: `anomaly-${i}`,
                label: info.title,
                type: 'anomaly',
                s: anomalyStart(info.kind),
                info,
              }),
            });
          });
      }
    }
    return cps;
  }, [run, scenario, orbit, cinematic, transfer, endDay]);

  useFlightKeys(sim, gameOn);

  useEffect(() => {
    if (!playing || day >= endDay || gameOn || !timeline) return;
    // The effect re-runs whenever `day` changes, so `day` here is always current.
    // Side effects stay out of the state updater (React may call updaters twice).
    const id = window.setInterval(() => {
      const next = Math.min(endDay, day + flightRate(day, timeline, speed, cinematic) / 10);
      // Stop at the next mini-game, even if one tick would jump past it.
      const i = checkpoints.findIndex(
        (c, k) => !done.current.has(k) && c.day >= day && c.day <= next,
      );
      if (i >= 0) {
        done.current.add(i);
        sim.game = checkpoints[i]!.make();
        setGameOn(true);
        setDay(checkpoints[i]!.day);
        return;
      }
      setDay(next);
    }, 100);
    return () => window.clearInterval(id);
  }, [playing, speed, day, endDay, gameOn, checkpoints, cinematic, sim, timeline]);

  const finishGame = useCallback(
    (forced: boolean) => {
      const g = sim.game;
      if (!g) return;
      const r = gameResult(g);
      const res: PilotGameResult = {
        id: g.id,
        label: g.type === 'anomaly' ? g.info.title : g.label,
        score: forced || g.auto ? Math.min(r.score, AUTOPILOT_SCORE) : r.score,
        summary: r.summary,
        autopilot: forced || g.auto,
      };
      if (g.type === 'launch') sim.launchEnd = { alt: g.s.alt, down: g.s.down };
      setResults((rs) => [...rs, res]);
      setToast(res);
      sim.game = null;
      setGameOn(false);
      if (g.type === 'launch') setDay(-0.4);
      if (g.type === 'insertion') setDay(transfer > 0 ? transfer + 0.8 : 0.9);
    },
    [sim, transfer],
  );

  // The scene calls this from its render loop; defer to React.
  const onGameDone = useCallback(
    () => window.setTimeout(() => finishGame(false), 600),
    [finishGame],
  );

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(id);
  }, [toast]);

  // Record the pilot rating once the flight is over.
  useEffect(() => {
    if (day >= endDay && !gameOn) setPilot(pilotSummary(results));
  }, [day, endDay, gameOn, results, setPilot]);

  const visibleEvents = useMemo(
    // Show events in time order (they are generated per system, not chronologically).
    () => (run ? run.events.filter((e) => e.day <= day).sort((x, y) => x.day - y.day) : []),
    [run, day],
  );
  if (!run || !orbit || !scenario || !timeline) return null;

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
  const finished = day >= endDay && !gameOn;
  const science = finished ? run.science : (sample?.science ?? 0);
  const progress = Math.max(0, Math.min(1, day / totalDays));
  // While a mini-game runs, the caption names it instead of the clock's phase.
  const caption = gameOn && sim.game ? sim.game.label : shotAt(day, timeline).caption;

  const skip = () => {
    if (sim.game) finishGame(true);
    for (let i = 0; i < checkpoints.length; i++) done.current.add(i);
    setDay(endDay);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-2xl font-semibold" tabIndex={-1}>
          Mission in flight: {scenario.name}
        </h2>
        {view.available && (
          <Button variant="ghost" aria-pressed={view.on} onClick={() => view.setOn(!view.on)}>
            {view.on ? 'Switch to 2D view' : 'Switch to 3D view'}
          </Button>
        )}
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          {cinematic ? (
            <div className="relative overflow-hidden rounded-2xl border border-cyan-400/20 bg-black">
              <div
                className="h-[min(72vh,620px)] min-h-[380px]"
                role="img"
                aria-label={`3D view: ${caption}`}
              >
                <Suspense
                  fallback={
                    <p className="grid h-full place-items-center font-mono text-xs uppercase tracking-widest text-cyan-300">
                      Loading flight…
                    </p>
                  }
                >
                  <FlightScene3D
                    sim={sim}
                    day={day}
                    timeline={timeline}
                    partIds={run.design.partIds}
                    orbitId={orbit.id}
                    orbitAltKm={orbit.altitudeKm}
                    onGameDone={onGameDone}
                  />
                </Suspense>
              </div>
              <p
                aria-live="polite"
                className="hud-panel pointer-events-none absolute left-3 top-3 rounded-lg px-3 py-1.5 font-mono text-xs uppercase tracking-widest text-cyan-100"
              >
                {caption}
              </p>
              {toast && (
                <div
                  role="status"
                  className="hud-panel hud-corners absolute right-3 top-3 w-72 rounded-lg p-3"
                >
                  <p className="font-mono text-[11px] uppercase tracking-widest text-amber-300">
                    {toast.label}
                  </p>
                  <p className="text-2xl font-black text-white">
                    {toast.score}
                    <span className="text-sm text-slate-400"> / 100</span>
                  </p>
                  <p className="text-xs text-slate-300">{toast.summary}</p>
                </div>
              )}
              <PilotHud
                sim={sim}
                onStart={(auto) => {
                  if (sim.game) {
                    sim.game.auto = auto;
                    sim.game.started = true;
                  }
                }}
              />
            </div>
          ) : (
            <MissionReplay
              target={scenario.body}
              transferShare={transfer / totalDays}
              progress={progress}
              failed={finished && !!run.failurePhase && run.failurePhase !== 'science'}
            />
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => setPlaying((p) => !p)} disabled={finished || gameOn}>
              {playing && !finished ? 'Pause' : 'Play'}
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
            <Button variant="ghost" onClick={skip} disabled={finished}>
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
          {results.length > 0 && (
            <div className="space-y-1 border-t border-slate-800 pt-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                Pilot log
              </p>
              <ul className="space-y-0.5 text-xs">
                {results.map((r) => (
                  <li key={r.id} className="flex justify-between gap-2">
                    <span className="text-slate-300">
                      {r.label}
                      {r.autopilot ? ' (autopilot)' : ''}
                    </span>
                    <span className="font-mono text-white">{r.score}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {finished && (
            <div className="space-y-2" role="status">
              <p className="font-semibold">
                {run.outcome === 'full'
                  ? 'Full success!'
                  : run.outcome === 'partial'
                    ? 'Partial success.'
                    : `Mission failed: ${run.failureReason}`}
              </p>
              {pilot && (
                <p
                  className={cx(
                    'text-sm',
                    pilot.medal === 'gold' ? 'text-amber-300' : 'text-slate-300',
                  )}
                >
                  Pilot rating: {pilot.score}/100 · {pilot.title}
                </p>
              )}
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
