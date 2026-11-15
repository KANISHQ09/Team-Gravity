import { type ReactNode, useEffect, useRef, useState } from 'react';
import { cx, fmt } from '../../lib/format.ts';
import { HOLD_NEEDED, ZONE } from './anomalyGame.ts';
import type { ActiveGame, FlightSim, Keys } from './flightSim.ts';
import { orbitOf } from './insertionGame.ts';
import { LAUNCH_DURATION, Q_LIMIT, launchTargetPitch } from './launchGame.ts';
import { RECORDER_CAPACITY, SCIENCE_DURATION, inStationWindow } from './scienceGame.ts';

const KEY_MAP: Record<string, keyof Keys> = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  Space: 'action',
  KeyE: 'downlink',
};

/** Keyboard controls for the active game; arrows/space never scroll the page while flying. */
export function useFlightKeys(sim: FlightSim, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const set = (e: KeyboardEvent, down: boolean) => {
      const k = KEY_MAP[e.code];
      if (!k) return;
      const target = e.target as HTMLElement | null;
      if (target && /INPUT|TEXTAREA|SELECT/.test(target.tagName)) return;
      e.preventDefault();
      sim.keys[k] = down;
    };
    const onDown = (e: KeyboardEvent) => set(e, true);
    const onUp = (e: KeyboardEvent) => set(e, false);
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      for (const k of Object.keys(sim.keys) as (keyof Keys)[]) sim.keys[k] = false;
    };
  }, [sim, active]);
}

/** Re-render a few times a second to show the live game values. */
function useTick(ms: number) {
  const [, setT] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setT((t) => t + 1), ms);
    return () => window.clearInterval(id);
  }, [ms]);
}

function HoldButton({
  sim,
  k,
  children,
  wide,
}: {
  sim: FlightSim;
  k: keyof Keys;
  children: ReactNode;
  wide?: boolean;
}) {
  const press = (v: boolean) => () => {
    sim.keys[k] = v;
  };
  return (
    <button
      type="button"
      onPointerDown={press(true)}
      onPointerUp={press(false)}
      onPointerLeave={press(false)}
      onPointerCancel={press(false)}
      onContextMenu={(e) => e.preventDefault()}
      className={cx(
        'select-none rounded-lg border border-cyan-400/40 bg-slate-900/80 px-3 py-2 font-mono text-xs font-bold uppercase tracking-widest text-cyan-100 active:bg-cyan-500/30',
        wide && 'flex-1',
      )}
    >
      {children}
    </button>
  );
}

function Meter({
  label,
  value,
  max,
  warn,
  children,
}: {
  label: string;
  value: number;
  max: number;
  warn?: boolean;
  children?: ReactNode;
}) {
  const pctv = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="min-w-0">
      <div className="flex justify-between font-mono text-[10px] uppercase tracking-widest text-slate-400">
        <span>{label}</span>
        <span className={warn ? 'text-rose-300' : 'text-white'}>{children}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded bg-slate-800">
        <div
          className={cx('h-full', warn ? 'bg-rose-500' : 'bg-cyan-400')}
          style={{ width: `${pctv}%` }}
        />
      </div>
    </div>
  );
}

const BRIEF: Record<ActiveGame['type'], { controls: string[] }> = {
  launch: {
    controls: [
      '← / A: nose up · → / D: nose down. Keep the nose on the guidance line.',
      '↑ / W: more throttle · ↓ / S: less. Throttle down when the pressure (Max-Q) bar turns red.',
    ],
  },
  insertion: {
    controls: [
      'Hold SPACE (or the Burn button) to fire the engine.',
      'Burn backwards near the closest point to the planet. Watch the predicted path: orange means escape, cyan means orbit. Stop when it matches the green circle.',
    ],
  },
  science: {
    controls: [
      '← / → steer the instrument across the ground track.',
      'SPACE captures a target when the cyan ring is on it.',
      'Hold E to send data home while a ground station is in view, before the recorder fills.',
    ],
  },
  anomaly: { controls: [] },
};

export function PilotHud({
  sim,
  onStart,
  onAutopilot,
}: {
  sim: FlightSim;
  onStart: (auto: boolean) => void;
  /** Hand the running game over to the autopilot. */
  onAutopilot: () => void;
}) {
  useTick(90);
  const startRef = useRef<HTMLButtonElement>(null);
  const g = sim.game;
  const briefing = !!g && !g.started && !g.finished;
  // Move focus to the briefing so keyboard players can start straight away.
  useEffect(() => {
    if (briefing) startRef.current?.focus();
  }, [briefing]);
  if (!g || g.finished) return null;

  if (!g.started) {
    const controls =
      g.type === 'anomaly'
        ? g.info.kind === 'stabilize'
          ? [
              g.info.instruction,
              'Arrow keys / WASD fire the thrusters. Hold the dot inside the circle.',
            ]
          : [
              g.info.instruction,
              `Press SPACE (or the button) to ${g.info.action.toLowerCase()} at the right moment.`,
            ]
        : g.type === 'insertion' && g.s.kind === 'circularize'
          ? [
              'Hold SPACE (or the Burn button) to fire the engine forwards.',
              'You are coasting up to the highest point of a low, stretched orbit. Burn there to lift the low side until the predicted path matches the green circle.',
            ]
          : BRIEF[g.type].controls;
    return (
      <div className="pointer-events-auto absolute inset-0 grid place-items-center bg-black/40 p-4">
        <div
          role="dialog"
          aria-labelledby="pilot-brief"
          className="hud-panel hud-corners relative w-[min(100%,30rem)] space-y-3 rounded-xl p-5"
        >
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-amber-300">
            {g.type === 'anomaly' ? 'Anomaly alert' : 'Your turn to fly'}
          </p>
          <h3 id="pilot-brief" className="text-xl font-black uppercase tracking-wide text-white">
            {g.type === 'anomaly' ? g.info.title : g.label}
          </h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-200">
            {controls.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              ref={startRef}
              onClick={() => onStart(false)}
              className="rounded-full bg-orange-500 px-6 py-2 text-sm font-bold uppercase tracking-widest text-black hover:bg-orange-400"
            >
              Start
            </button>
            <button
              type="button"
              onClick={() => onStart(true)}
              className="rounded-full border border-slate-500 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-slate-200 hover:bg-slate-800"
            >
              Let the autopilot fly (fewer points)
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-x-3 bottom-3 space-y-2">
      <div className="hud-panel hud-corners pointer-events-auto relative rounded-xl p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="font-mono text-xs font-bold uppercase tracking-widest text-white">
            {g.type === 'anomaly' ? g.info.title : g.label}
            {g.auto && <span className="ml-2 text-amber-300">· autopilot</span>}
          </p>
          {!g.auto && (
            <button
              type="button"
              onClick={onAutopilot}
              className="rounded border border-slate-600 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-slate-300 hover:bg-slate-800"
            >
              Autopilot
            </button>
          )}
        </div>
        <GameBody g={g} sim={sim} />
      </div>
    </div>
  );
}

function GameBody({ g, sim }: { g: ActiveGame; sim: FlightSim }) {
  switch (g.type) {
    case 'launch': {
      const s = g.s;
      const target = launchTargetPitch(s.t);
      const err = s.pitch - target;
      return (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Meter label="Altitude" value={s.alt} max={200}>
              {fmt(s.alt)} km
            </Meter>
            <Meter label="Speed" value={s.v} max={8}>
              {s.v.toFixed(2)} km/s
            </Meter>
            <Meter label="Throttle" value={s.throttle} max={1}>
              {Math.round(s.throttle * 100)}%
            </Meter>
            <Meter label="Max-Q pressure" value={s.q} max={Q_LIMIT * 1.4} warn={s.q > Q_LIMIT}>
              {s.q > Q_LIMIT ? 'OVER LIMIT' : `${Math.round((s.q / Q_LIMIT) * 100)}%`}
            </Meter>
          </div>
          <div>
            <p className="flex justify-between font-mono text-[10px] uppercase tracking-widest text-slate-400">
              <span>Steering vs guidance</span>
              <span className={Math.abs(err) > 6 ? 'text-amber-300' : 'text-emerald-300'}>
                pitch {Math.round(s.pitch)}° / target {Math.round(target)}°
              </span>
            </p>
            <div className="relative mt-1 h-3 rounded bg-slate-800">
              <div className="absolute inset-y-0 left-1/2 w-8 -translate-x-1/2 rounded bg-emerald-500/30" />
              <div
                className="absolute inset-y-0 w-1.5 -translate-x-1/2 rounded bg-white"
                style={{ left: `${50 + Math.max(-48, Math.min(48, err * 2))}%` }}
              />
            </div>
          </div>
          <p className="font-mono text-[10px] text-slate-400">
            {Math.max(0, LAUNCH_DURATION - s.t).toFixed(0)} s to orbit
          </p>
          {!g.auto && (
            <div className="flex gap-2">
              <HoldButton sim={sim} k="left" wide>
                Nose up
              </HoldButton>
              <HoldButton sim={sim} k="right" wide>
                Nose down
              </HoldButton>
              <HoldButton sim={sim} k="up" wide>
                Throttle +
              </HoldButton>
              <HoldButton sim={sim} k="down" wide>
                Throttle −
              </HoldButton>
            </div>
          )}
        </div>
      );
    }
    case 'insertion': {
      const s = g.s;
      const r = Math.hypot(s.x, s.y);
      const o = orbitOf(s.x, s.y, s.vx, s.vy);
      const status = !o
        ? 'Escape path: brake more'
        : `Orbit: low ${((o.rp - 1) * 100).toFixed(0)}, high ${((o.ra - 1) * 100).toFixed(0)} (target ${((s.target - 1) * 100).toFixed(0)})`;
      return (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Meter label="Burn propellant" value={s.fuel} max={s.fuel0}>
              {Math.round((s.fuel / s.fuel0) * 100)}%
            </Meter>
            <Meter label="Height above surface" value={r - 1} max={3}>
              {((r - 1) * 100).toFixed(0)} units
            </Meter>
            <Meter label="Speed" value={Math.hypot(s.vx, s.vy)} max={1.6}>
              {Math.hypot(s.vx, s.vy).toFixed(2)}
            </Meter>
          </div>
          <p
            role="status"
            className={cx('font-mono text-xs', o ? 'text-cyan-200' : 'text-orange-300')}
          >
            {s.burning ? 'ENGINE FIRING · ' : ''}
            {status}
          </p>
          {!g.auto && (
            <div className="flex">
              <HoldButton sim={sim} k="action" wide>
                Hold to burn
              </HoldButton>
            </div>
          )}
        </div>
      );
    }
    case 'science': {
      const s = g.s;
      const captured = s.targets.filter((t) => t.status === 'captured').length;
      const station = inStationWindow(s);
      return (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Meter
              label="Recorder"
              value={s.stored}
              max={RECORDER_CAPACITY}
              warn={s.stored >= RECORDER_CAPACITY}
            >
              {s.stored.toFixed(1)} / {RECORDER_CAPACITY}
            </Meter>
            <Meter label="Sent home" value={s.returned} max={s.targets.length}>
              {s.returned.toFixed(1)}
            </Meter>
            <Meter label="Targets" value={captured} max={s.targets.length}>
              {captured} / {s.targets.length}
            </Meter>
            <Meter label="Time" value={SCIENCE_DURATION - s.t} max={SCIENCE_DURATION}>
              {Math.max(0, SCIENCE_DURATION - s.t).toFixed(0)} s
            </Meter>
          </div>
          <p
            role="status"
            className={cx('font-mono text-xs', station ? 'text-emerald-300' : 'text-slate-400')}
          >
            {station
              ? s.downlinking
                ? 'SENDING DATA…'
                : 'Ground station in view: hold E to send data'
              : 'No station in view'}
          </p>
          {!g.auto && (
            <div className="flex gap-2">
              <HoldButton sim={sim} k="left" wide>
                ◀ Steer
              </HoldButton>
              <HoldButton sim={sim} k="action" wide>
                Capture
              </HoldButton>
              <HoldButton sim={sim} k="downlink" wide>
                Send data
              </HoldButton>
              <HoldButton sim={sim} k="right" wide>
                Steer ▶
              </HoldButton>
            </div>
          )}
        </div>
      );
    }
    case 'anomaly': {
      const s = g.s;
      if (s.kind === 'stabilize') {
        const px = 50 + s.ex * 40;
        const py = 50 - s.ey * 40;
        return (
          <div className="flex flex-wrap items-center gap-4">
            <svg
              viewBox="0 0 100 100"
              className="h-28 w-28 shrink-0"
              role="img"
              aria-label={`Pointing error ${Math.round(Math.hypot(s.ex, s.ey) * 100)}%`}
            >
              <circle cx="50" cy="50" r="46" fill="none" stroke="#334155" />
              <circle cx="50" cy="50" r={ZONE * 40} fill="rgba(52,211,153,0.15)" stroke="#34d399" />
              <line x1="50" y1="4" x2="50" y2="96" stroke="#1e293b" />
              <line x1="4" y1="50" x2="96" y2="50" stroke="#1e293b" />
              <circle cx={px} cy={py} r="5" fill="#f43f5e" />
            </svg>
            <div className="min-w-40 flex-1 space-y-2">
              <Meter label="Held steady" value={s.held} max={HOLD_NEEDED}>
                {s.held.toFixed(1)} / {HOLD_NEEDED} s
              </Meter>
              {!g.auto && (
                <div className="grid grid-cols-3 gap-1">
                  <span />
                  <HoldButton sim={sim} k="up">
                    ▲
                  </HoldButton>
                  <span />
                  <HoldButton sim={sim} k="left">
                    ◀
                  </HoldButton>
                  <HoldButton sim={sim} k="down">
                    ▼
                  </HoldButton>
                  <HoldButton sim={sim} k="right">
                    ▶
                  </HoldButton>
                </div>
              )}
            </div>
          </div>
        );
      }
      return (
        <div className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-widest text-slate-400">
            Threat arriving
          </p>
          <div className="relative h-4 overflow-hidden rounded bg-slate-800">
            <div
              className="absolute inset-y-0 bg-emerald-500/30"
              style={{ left: '60%', width: '35%' }}
            />
            <div
              className="absolute inset-y-0 left-0 bg-orange-500"
              style={{ width: `${s.wave * 100}%` }}
            />
          </div>
          <p className="font-mono text-[10px] text-slate-400">
            Act while the bar is in the green zone.
          </p>
          {!g.auto && (
            <div className="flex">
              <HoldButton sim={sim} k="action" wide>
                {g.info.action}
              </HoldButton>
            </div>
          )}
        </div>
      );
    }
  }
}
