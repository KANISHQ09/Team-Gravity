import { useEffect, useRef, useState } from 'react';
import { catalog } from '@gravity/engine';
import type { Body, Difficulty } from '@gravity/shared';
import { Button } from '../../components/ui.tsx';
import { useReducedMotion } from '../../hooks/useReducedMotion.ts';
import { onlineConfigured } from '../../lib/api.ts';
import { DIFFICULTY_LABEL, bodyName, fmt } from '../../lib/format.ts';
import { decodeDesign, STAGES, useGame } from '../../store/game.ts';
import { OnlineLobby } from '../rooms/OnlineLobby.tsx';

const DIFFICULTY_HELP: Record<Difficulty, string> = {
  explorer: 'Simple parts, hints on, 10% margins. Like a first sketch of a mission (CML 1–2).',
  engineer: 'All parts, 20% margins and trade-offs between designs (CML 3).',
  'flight-director':
    '35% margins on hardware (20% on budget and schedule), every high risk must be mitigated, more surprises (CML 4).',
};

const STAGE_HELP: Record<string, string> = {
  goals: 'Pick the science questions your mission will answer.',
  concept: 'Choose an orbit and a rocket. They decide what is possible.',
  requirements: 'Turn each goal into a number you must reach.',
  design: 'Build the spacecraft while six live gauges react.',
  verify: 'Pass the readiness review and check the risks.',
  launch: 'Vote GO or NO-GO, launch, and watch it fly.',
};

/** CSS-only planet art, so the landing page needs no image assets for the cards. */
const PLANET_STYLE: Record<Body, string> = {
  earth:
    'radial-gradient(circle at 32% 30%, #bfe3ff 0%, #3b82c4 18%, #1d4f8c 45%, #0b2346 70%, #020814 100%)',
  moon: 'radial-gradient(circle at 32% 30%, #f1f1ef 0%, #b9b7b2 25%, #7d7a74 55%, #3a3835 80%, #0b0b0a 100%)',
  mars: 'radial-gradient(circle at 32% 30%, #ffd3a8 0%, #e07b3c 22%, #a7431b 50%, #4d1a08 78%, #120402 100%)',
};

export function Home() {
  const start = useGame((s) => s.startMission);
  const loadDesign = useGame((s) => s.loadDesign);
  const saved = useGame((s) => s.design);
  const go = useGame((s) => s.go);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ block: 'start' });

  return (
    <div>
      <Hero
        onPlay={() => scrollTo('scenarios-heading')}
        onOnline={() => scrollTo('online-heading')}
        onContinue={saved ? () => go('mission') : null}
      />

      <section aria-label="GRAVITY in numbers" className="border-y border-white/10 bg-black">
        <dl className="mx-auto grid max-w-7xl grid-cols-2 gap-px px-4 md:grid-cols-4">
          {[
            ['3', 'missions: Earth, Moon and Mars'],
            [String(catalog.parts.length), 'spacecraft parts to choose from'],
            ['6', 'resources to balance'],
            [String(catalog.orbits.length), 'orbits around Earth, the Moon and Mars'],
          ].map(([n, label]) => (
            <div key={label} className="flex flex-col py-6 md:py-8">
              <dt className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</dt>
              <dd className="order-first text-4xl font-black tracking-tight text-white md:text-5xl">
                {n}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="mx-auto max-w-7xl space-y-20 px-4 py-16">
        <section aria-labelledby="scenarios-heading" className="scroll-mt-20 space-y-6">
          <SectionTitle id="scenarios-heading" eyebrow="Choose your destination">
            Choose a mission
          </SectionTitle>
          <div className="grid gap-6 md:grid-cols-3">
            {catalog.scenarios.map((s) => (
              <ScenarioCard key={s.id} scenarioId={s.id} onStart={start} />
            ))}
          </div>
        </section>

        <section aria-labelledby="how-heading" className="space-y-6">
          <SectionTitle id="how-heading" eyebrow="The real mission process">
            How a mission works
          </SectionTitle>
          <ol className="grid gap-px overflow-hidden rounded-xl border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-6">
            {STAGES.map((st, i) => (
              <li key={st.id} className="bg-black p-5">
                <span className="font-mono text-sm text-orange-400">0{i + 1}</span>
                <p className="mt-2 font-bold uppercase tracking-wide text-white">{st.title}</p>
                <p className="mt-1 text-sm text-slate-400">{STAGE_HELP[st.id]}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="online-heading" className="scroll-mt-20 space-y-6">
          <div className="flex flex-wrap items-end gap-3">
            <SectionTitle id="online-heading" eyebrow="Mission control is a team">
              Play online with friends
            </SectionTitle>
            {!onlineConfigured && <SoonBadge />}
          </div>
          <div className="rounded-xl border border-white/10 bg-gradient-to-br from-slate-900 to-black p-6">
            <OnlineLobby />
          </div>
        </section>

        <section aria-labelledby="share-heading" className="max-w-xl space-y-3">
          <h2 id="share-heading" className="text-lg font-bold uppercase tracking-wide">
            Load a shared design
          </h2>
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const d = decodeDesign(code.trim());
              if (d) loadDesign(d);
              else setCodeError('That code is not a valid GRAVITY design.');
            }}
          >
            <label htmlFor="design-code" className="sr-only">
              Design code
            </label>
            <input
              id="design-code"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setCodeError(null);
              }}
              placeholder="Paste a design code"
              className="min-w-0 flex-1 rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm"
              aria-describedby={codeError ? 'design-code-error' : undefined}
            />
            <Button type="submit" variant="secondary" disabled={!code.trim()}>
              Load
            </Button>
          </form>
          {codeError && (
            <p id="design-code-error" role="alert" className="text-sm text-rose-300">
              {codeError}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

function SoonBadge() {
  return (
    <span className="mb-1 rounded-full border border-orange-400/70 bg-orange-500/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-orange-300">
      Coming soon
    </span>
  );
}

function SectionTitle({
  id,
  eyebrow,
  children,
}: {
  id: string;
  eyebrow: string;
  children: string;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-orange-400">{eyebrow}</p>
      <h2 id={id} className="mt-2 text-3xl font-black uppercase tracking-tight md:text-4xl">
        {children}
      </h2>
    </div>
  );
}

/** Full-screen video hero. The video is decorative; a pause control satisfies WCAG 2.2.2. */
function Hero({
  onPlay,
  onOnline,
  onContinue,
}: {
  onPlay: () => void;
  onOnline: () => void;
  onContinue: (() => void) | null;
}) {
  const reduced = useReducedMotion();
  const video = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(reduced);

  useEffect(() => {
    const v = video.current;
    if (!v || typeof v.play !== 'function') return;
    if (paused) v.pause();
    // Autoplay can be refused (battery saver); the poster frame then stays, which is fine.
    else v.play()?.catch(() => setPaused(true));
  }, [paused]);

  return (
    <section
      aria-labelledby="hero-title"
      className="relative isolate flex min-h-[92vh] items-end overflow-hidden bg-black"
    >
      <video
        ref={video}
        className="absolute inset-0 -z-20 h-full w-full object-cover"
        src="/media/hero-space.mp4"
        poster="/media/hero-poster.jpg"
        muted
        loop
        playsInline
        autoPlay={!reduced}
        preload={reduced ? 'none' : 'auto'}
        aria-hidden="true"
        tabIndex={-1}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-t from-black via-black/40 to-black/60"
      />
      <div className="mx-auto w-full max-w-7xl px-4 pb-16 pt-32 md:pb-24">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-orange-400">
          Space Apps Challenge 2026 · Space Mission Design Game
        </p>
        <h1
          id="hero-title"
          className="mt-4 text-6xl font-black tracking-[0.12em] text-white drop-shadow-lg md:text-8xl"
        >
          GRAVITY
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-slate-200 md:text-2xl md:leading-snug">
          Design a real space mission. Build the spacecraft, pick the rocket and the orbit, balance
          mass, power, money, data, communications and time, then launch and find out{' '}
          <em className="font-semibold not-italic text-white">why</em> it worked or failed.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onPlay}
            className="rounded-full bg-orange-500 px-7 py-3 text-sm font-bold uppercase tracking-widest text-black transition hover:bg-orange-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Start a mission
          </button>
          <button
            type="button"
            onClick={onOnline}
            className="rounded-full border border-white/70 px-7 py-3 text-sm font-bold uppercase tracking-widest text-white transition hover:bg-white hover:text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Play with friends
            {!onlineConfigured && (
              <span className="ml-2 rounded-full bg-orange-500 px-2 py-0.5 text-[10px] text-black">
                Soon
              </span>
            )}
          </button>
          {onContinue && (
            <button
              type="button"
              onClick={onContinue}
              className="rounded-full px-5 py-3 text-sm font-bold uppercase tracking-widest text-slate-200 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-white"
            >
              Continue your saved mission →
            </button>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={() => setPaused((p) => !p)}
        aria-pressed={paused}
        className="absolute bottom-4 right-4 rounded-full border border-white/40 bg-black/50 px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-white backdrop-blur hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-white"
      >
        {paused ? '▶ Play background video' : '❚❚ Pause background video'}
      </button>
    </section>
  );
}

function ScenarioCard({
  scenarioId,
  onStart,
}: {
  scenarioId: string;
  onStart: (scenarioId: string, difficulty: Difficulty, players: number) => void;
}) {
  const s = catalog.scenarios.find((x) => x.id === scenarioId)!;
  const [difficulty, setDifficulty] = useState<Difficulty>(s.recommendedDifficulty);
  const idBase = `scn-${s.id}`;
  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-white/10 bg-gradient-to-b from-slate-900 to-black transition hover:border-orange-400/60">
      <div
        aria-hidden="true"
        className="relative h-44 overflow-hidden bg-[radial-gradient(ellipse_at_top,#1e293b_0%,#000_70%)]"
      >
        <div
          className="absolute left-1/2 top-8 h-56 w-56 -translate-x-1/2 rounded-full shadow-[0_0_60px_rgba(147,197,253,0.25)] transition-transform duration-700 group-hover:scale-105"
          style={{ background: PLANET_STYLE[s.body] }}
        />
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-orange-400">
          {bodyName(s.body)}
        </p>
        <h3 className="text-2xl font-black uppercase tracking-tight">{s.name}</h3>
        <p className="text-sm text-slate-300">{s.summary}</p>
        <dl className="grid grid-cols-2 gap-x-2 gap-y-1 border-y border-white/10 py-3 text-xs text-slate-400">
          <dt>Budget</dt>
          <dd className="text-right text-slate-200">{fmt(s.budgetM)} M$</dd>
          <dt>Science operations</dt>
          <dd className="text-right text-slate-200">{s.missionDays} days</dd>
          <dt>Critical resource</dt>
          <dd className="text-right capitalize text-slate-200">{s.criticalResource}</dd>
        </dl>
        <div className="mt-auto space-y-2">
          <label htmlFor={`${idBase}-difficulty`} className="block text-sm font-medium">
            Difficulty
          </label>
          <select
            id={`${idBase}-difficulty`}
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as Difficulty)}
            className="w-full rounded-md border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm"
            aria-describedby={`${idBase}-difficulty-help`}
          >
            {(Object.keys(DIFFICULTY_LABEL) as Difficulty[]).map((d) => (
              <option key={d} value={d}>
                {DIFFICULTY_LABEL[d]}
                {d === s.recommendedDifficulty ? ' (recommended)' : ''}
              </option>
            ))}
          </select>
          <p id={`${idBase}-difficulty-help`} className="text-xs text-slate-400">
            {DIFFICULTY_HELP[difficulty]}
          </p>
          <button
            type="button"
            className="mt-1 w-full rounded-full bg-white px-4 py-2.5 text-sm font-bold uppercase tracking-widest text-black transition hover:bg-orange-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-300"
            onClick={() => onStart(s.id, difficulty, 1)}
          >
            Start {s.name}
          </button>
        </div>
      </div>
    </article>
  );
}
