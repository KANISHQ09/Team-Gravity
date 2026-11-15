import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { catalog } from '@gravity/engine';
import type { Part } from '@gravity/shared';
import { StatusBadge } from '../../components/ui.tsx';
import { layoutCraft } from '../../components/space3d/craftLayout.ts';
import { useReducedMotion } from '../../hooks/useReducedMotion.ts';
import { useReview } from '../../hooks/useReview.ts';
import { use3DView } from '../../hooks/use3DView.ts';
import { CATEGORY_LABEL, cx, fmt, pct } from '../../lib/format.ts';
import { useGame } from '../../store/game.ts';
import { type DeploymentCheck, deploymentChecks } from './deploymentChecks.ts';
import type { CameraPreset } from './Hangar3D.tsx';

const Hangar3D = lazy(() => import('./Hangar3D.tsx'));

const HUD = 'hud-panel rounded-xl';
const CHIP =
  'rounded-md border px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider transition focus-visible:outline-2 focus-visible:outline-cyan-300';
const chip = (on: boolean) =>
  cx(
    CHIP,
    on
      ? 'border-cyan-300 bg-cyan-400/20 text-white shadow-[0_0_12px_rgba(34,211,238,0.35)]'
      : 'border-slate-700 bg-slate-900/80 text-slate-300 hover:border-cyan-400/60 hover:text-white',
  );

/**
 * 3D spacecraft hangar: see the real design take shape, inspect parts,
 * X-ray the bus and run a deployment test. All numbers come from the engine.
 */
export function Hangar() {
  const view = use3DView();
  const reduced = useReducedMotion();
  const design = useGame((s) => s.design);
  const edit = useGame((s) => s.edit);
  const data = useReview();
  const [camera, setCamera] = useState<{ preset: CameraPreset; nonce: number }>({
    preset: 'iso',
    nonce: 0,
  });
  const [xray, setXray] = useState(false);
  const [panels, setPanels] = useState(true);
  const [autoRotate, setAutoRotate] = useState(!reduced);
  const [selected, setSelected] = useState<string | null>(null);
  const [testStart, setTestStart] = useState<number | null>(null);
  const [results, setResults] = useState<DeploymentCheck[] | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const parts = useMemo(
    () =>
      (design?.partIds ?? [])
        .map((id) => catalog.parts.find((p) => p.id === id))
        .filter((p): p is Part => !!p),
    [design?.partIds],
  );
  const layout = useMemo(() => layoutCraft(parts), [parts]);

  // "Attached …" / "Removed …" toasts, like a real assembly log.
  const prev = useRef<string[] | null>(null);
  useEffect(() => {
    const now = design?.partIds ?? [];
    const before = prev.current;
    prev.current = [...now];
    if (!before) return;
    const count = (arr: readonly string[]) =>
      arr.reduce((m, id) => m.set(id, (m.get(id) ?? 0) + 1), new Map<string, number>());
    const a = count(before);
    const b = count(now);
    const name = (id: string) => catalog.parts.find((p) => p.id === id)?.name ?? id;
    for (const [id, n] of b) if (n > (a.get(id) ?? 0)) setToast(`Attached ${name(id)}`);
    for (const [id, n] of a) if (n > (b.get(id) ?? 0)) setToast(`Removed ${name(id)}`);
  }, [design?.partIds]);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (testStart === null) return;
    const t = window.setTimeout(() => {
      setTestStart(null);
      setResults(deploymentChecks(parts, data?.review.analysis.deltaVRequiredMs ?? 0));
    }, 7000);
    return () => window.clearTimeout(t);
  }, [testStart, parts, data?.review.analysis.deltaVRequiredMs]);

  if (!view.available || !design || !data) return null;
  const scenario = data.scenario;
  const selectedPart = selected ? catalog.parts.find((p) => p.id === selected) : undefined;
  const passed = results?.filter((r) => r.pass).length ?? 0;

  return (
    <section aria-labelledby="hangar-heading" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3
          id="hangar-heading"
          className="font-mono text-sm font-bold uppercase tracking-[0.3em] text-cyan-300"
        >
          Spacecraft hangar
        </h3>
        <button
          type="button"
          className={chip(view.on)}
          aria-pressed={view.on}
          onClick={() => view.setOn(!view.on)}
        >
          3D view {view.on ? 'on' : 'off'}
        </button>
      </div>

      {view.on && (
        <div className="relative overflow-hidden rounded-2xl border border-cyan-400/20 bg-black">
          <div
            className="h-[min(82vh,820px)] min-h-[460px] w-full"
            role="img"
            aria-label={`3D model of your spacecraft. ${layout.description}`}
          >
            <Suspense
              fallback={
                <p className="grid h-full place-items-center font-mono text-xs uppercase tracking-widest text-cyan-300">
                  Loading hangar…
                </p>
              }
            >
              <Hangar3D
                layout={layout}
                body={scenario.body}
                camera={camera}
                xray={xray}
                autoRotate={autoRotate && !selected}
                testStart={testStart}
                selectedId={selected}
                onSelect={setSelected}
              />
            </Suspense>
          </div>

          {/* Top toolbar */}
          <div
            className={cx(
              HUD,
              'hud-corners absolute inset-x-3 top-3 flex flex-wrap items-center gap-2 px-3 py-2',
            )}
          >
            <span className="font-mono text-[11px] uppercase tracking-widest text-slate-400">
              Cam
            </span>
            {(['iso', 'front', 'side', 'top'] as const).map((p) => (
              <button
                key={p}
                type="button"
                className={chip(camera.preset === p)}
                onClick={() => setCamera((c) => ({ preset: p, nonce: c.nonce + 1 }))}
              >
                {p}
              </button>
            ))}
            <span className="mx-1 hidden h-5 w-px bg-slate-700 sm:block" aria-hidden="true" />
            <button
              type="button"
              className={chip(xray)}
              aria-pressed={xray}
              onClick={() => setXray((x) => !x)}
            >
              X-ray
            </button>
            <button
              type="button"
              className={chip(autoRotate)}
              aria-pressed={autoRotate}
              onClick={() => setAutoRotate((r) => !r)}
            >
              Spin
            </button>
            <button
              type="button"
              className={cx(chip(panels), 'hidden lg:inline-block')}
              aria-pressed={panels}
              onClick={() => setPanels((v) => !v)}
            >
              Panels
            </button>
            <button
              type="button"
              disabled={testStart !== null || !layout.bus.present}
              onClick={() => {
                setResults(null);
                setTestStart(performance.now());
              }}
              className={cx(
                'ml-auto rounded-md border px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-widest transition disabled:opacity-50',
                testStart !== null
                  ? 'animate-pulse border-amber-300 bg-gradient-to-r from-amber-500 to-orange-600 text-white'
                  : 'border-amber-400/60 bg-amber-500/15 text-amber-200 hover:bg-amber-500/30',
              )}
            >
              {testStart !== null ? 'Testing…' : 'Run deployment test'}
            </button>
          </div>

          {/* Inspector */}
          <div
            className={cx(
              HUD,
              'hud-corners absolute right-3 top-20 hidden w-64 space-y-2 p-3',
              panels && 'lg:block',
            )}
          >
            <p className="font-mono text-[11px] uppercase tracking-widest text-slate-400">
              Module inspector
            </p>
            {selectedPart ? (
              <PartDetail
                part={selectedPart}
                onRemove={() => {
                  edit({
                    type: 'removePart',
                    partId: selectedPart.id,
                    category: selectedPart.category,
                  });
                  setSelected(null);
                }}
              />
            ) : (
              <p className="text-xs text-slate-400">
                Click a part on the spacecraft, or pick one from the list.
              </p>
            )}
          </div>

          {/* Installed modules */}
          <div
            className={cx(
              HUD,
              'hud-scroll hud-corners absolute left-3 top-20 hidden max-h-[58%] w-60 overflow-y-auto overflow-x-hidden p-3',
              panels && 'lg:block',
            )}
          >
            <ModuleList parts={parts} selected={selected} onSelect={setSelected} />
          </div>

          <div
            aria-live="polite"
            className="pointer-events-none absolute left-1/2 top-20 -translate-x-1/2"
          >
            {toast && (
              <p
                className={cx(HUD, 'border-cyan-300/50 px-4 py-2 font-mono text-xs text-cyan-100')}
              >
                {toast}
              </p>
            )}
          </div>

          {results && (
            <div
              role="status"
              className={cx(
                HUD,
                'hud-corners absolute left-1/2 top-1/2 w-[min(92%,26rem)] -translate-x-1/2 -translate-y-1/2 space-y-2 p-4',
              )}
            >
              <div className="flex items-center justify-between">
                <p className="font-mono text-xs font-bold uppercase tracking-widest text-white">
                  Deployment test: {passed}/{results.length} passed
                </p>
                <button type="button" className={chip(false)} onClick={() => setResults(null)}>
                  Close
                </button>
              </div>
              <ul className="space-y-1">
                {results.map((r) => (
                  <li key={r.label} className="flex items-start gap-2 text-xs">
                    <StatusBadge status={r.pass ? 'pass' : 'fail'} />
                    <span>
                      <span className="font-semibold text-slate-100">{r.label}:</span>{' '}
                      <span className="text-slate-300">{r.detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {view.on && (
        <>
          {/* Telemetry, below the view so it never covers the spacecraft */}
          <div
            className={cx(
              HUD,
              'hud-corners relative grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-3 sm:grid-cols-3 xl:grid-cols-6',
            )}
          >
            {data.review.gauges.map((g) => (
              <div key={g.key} className="min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate font-mono text-[10px] uppercase tracking-widest text-slate-400">
                    {g.label}
                  </span>
                  <StatusBadge status={g.status} />
                </div>
                <p className="font-mono text-sm font-bold text-white">
                  {fmt(g.used, 1)}
                  <span className="text-xs font-normal text-slate-400">
                    {' '}
                    / {g.limit === null ? '?' : fmt(g.limit, 1)} {g.unit}
                  </span>
                </p>
                <p className="font-mono text-[10px] text-slate-500">
                  {g.margin === null ? 'limit unknown' : `${pct(g.margin)} spare`}
                </p>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Small screens: the side panels sit below the viewport. */}
      {view.on && (
        <div className="grid gap-3 sm:grid-cols-2 lg:hidden">
          <div className={cx(HUD, 'p-3')}>
            <ModuleList parts={parts} selected={selected} onSelect={setSelected} />
          </div>
          <div className={cx(HUD, 'space-y-2 p-3')}>
            <p className="font-mono text-[11px] uppercase tracking-widest text-slate-400">
              Module inspector
            </p>
            {selectedPart ? (
              <PartDetail
                part={selectedPart}
                onRemove={() => {
                  edit({
                    type: 'removePart',
                    partId: selectedPart.id,
                    category: selectedPart.category,
                  });
                  setSelected(null);
                }}
              />
            ) : (
              <p className="text-xs text-slate-400">
                Tap a part on the spacecraft, or pick one from the list.
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function ModuleList({
  parts,
  selected,
  onSelect,
}: {
  parts: readonly Part[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const unique = [...new Map(parts.map((p) => [p.id, p])).values()];
  const count = (id: string) => parts.filter((p) => p.id === id).length;
  return (
    <div className="space-y-1.5">
      <p className="flex items-center justify-between font-mono text-[11px] uppercase tracking-widest text-slate-400">
        Installed modules
        <span className="rounded bg-cyan-500/20 px-1.5 text-cyan-200">{parts.length}</span>
      </p>
      {unique.length === 0 ? (
        <p className="text-xs italic text-slate-500">Hangar empty. Add a bus below to begin.</p>
      ) : (
        <ul className="space-y-0.5">
          {unique.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                aria-pressed={selected === p.id}
                onClick={() => onSelect(p.id)}
                className={cx(
                  'block w-full min-w-0 rounded-md border px-2 py-1.5 text-left transition',
                  selected === p.id
                    ? 'border-cyan-400/60 bg-cyan-500/20 text-cyan-50'
                    : 'border-transparent text-slate-200 hover:border-white/10 hover:bg-slate-800/70',
                )}
              >
                <span className="block truncate text-xs font-semibold" title={p.name}>
                  {p.name}
                </span>
                <span className="block truncate font-mono text-[10px] uppercase tracking-widest text-slate-500">
                  {count(p.id) > 1 ? `×${count(p.id)} · ` : ''}
                  {CATEGORY_LABEL[p.category]}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PartDetail({ part, onRemove }: { part: Part; onRemove: () => void }) {
  return (
    <div className="space-y-2">
      <p className="font-semibold text-white">{part.name}</p>
      <p className="font-mono text-[11px] uppercase tracking-widest text-cyan-300">
        {CATEGORY_LABEL[part.category]}
      </p>
      <dl className="grid grid-cols-2 gap-x-2 gap-y-0.5 font-mono text-xs">
        <dt className="text-slate-400">Mass</dt>
        <dd className="text-right text-white">
          {fmt(part.massKg + (part.propellantKg ?? 0), 1)} kg
        </dd>
        <dt className="text-slate-400">Power</dt>
        <dd className="text-right text-white">{fmt(part.powerW)} W</dd>
        <dt className="text-slate-400">Cost</dt>
        <dd className="text-right text-white">{fmt(part.costM, 2)} M$</dd>
        <dt className="text-slate-400">Reliability</dt>
        <dd className="text-right text-white">{pct(part.reliability)} / yr</dd>
      </dl>
      <p className="text-xs text-slate-300">{part.description}</p>
      <button
        type="button"
        onClick={onRemove}
        className="w-full rounded-md border border-rose-500/50 bg-rose-950/60 px-2 py-1 font-mono text-[11px] uppercase tracking-widest text-rose-200 hover:bg-rose-900/80"
      >
        Remove {part.name}
      </button>
    </div>
  );
}
