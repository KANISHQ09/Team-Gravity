import { catalog, orbitPeriodHours } from '@gravity/engine';
import { Card, Why } from '../../components/ui.tsx';
import { useReview } from '../../hooks/useReview.ts';
import { cx, fmt } from '../../lib/format.ts';
import { useGame } from '../../store/game.ts';

export function ConceptStage() {
  const data = useReview();
  const design = useGame((s) => s.design);
  const edit = useGame((s) => s.edit);
  if (!data || !design) return null;
  const { scenario, review } = data;
  const a = review.analysis;
  const orbits = catalog.orbits.filter((o) => scenario.allowedOrbitIds.includes(o.id));
  const orbit = a.resolved.orbit;

  const phases = [
    { name: 'Development', length: `${fmt(a.devMonths, 1)} months` },
    { name: 'Launch', length: '1 day' },
    { name: 'Transfer', length: orbit ? `${orbit.transferDays} days` : '?' },
    {
      name: 'Orbit insertion',
      length:
        orbit && orbit.deltaVRequiredMs > 0
          ? `${fmt(orbit.deltaVRequiredMs)} m/s burn`
          : 'none needed',
    },
    { name: 'Science operations', length: `${scenario.missionDays} days` },
    { name: 'End of life', length: 'safe disposal' },
  ];

  return (
    <div className="space-y-6">
      <section aria-labelledby="orbit-heading" className="space-y-2">
        <h3 id="orbit-heading" className="text-lg font-semibold">
          Orbit
        </h3>
        <div className="grid gap-3 md:grid-cols-2">
          {orbits.map((o) => {
            const selected = design.orbitId === o.id;
            return (
              <button
                key={o.id}
                type="button"
                aria-pressed={selected}
                onClick={() => edit({ type: 'setOrbit', orbitId: selected ? null : o.id })}
                className={cx(
                  'rounded-lg border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-sky-300',
                  selected
                    ? 'border-sky-400 bg-sky-950/60'
                    : 'border-slate-700 bg-slate-900 hover:bg-slate-800',
                )}
              >
                <span className="font-medium">{o.name}</span>
                {selected && <span className="ml-2 text-xs text-sky-300">Selected</span>}
                <span className="mt-1 block text-sm text-slate-300">{o.description}</span>
                <span className="mt-2 block text-xs text-slate-400">
                  Δv needed {fmt(o.deltaVRequiredMs)} m/s · shadow{' '}
                  {Math.round(o.eclipseFraction * 100)}% of each {fmt(orbitPeriodHours(o) * 60)}
                  -minute orbit · contact {fmt(o.contactMinutesPerDay)} min/day · mapping quality{' '}
                  {Math.round(o.mappingQuality * 100)}%
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="lv-heading" className="space-y-2">
        <h3 id="lv-heading" className="text-lg font-semibold">
          Launch vehicle{' '}
          <span className="text-sm font-normal text-slate-400">(launch segment)</span>
        </h3>
        {!orbit && (
          <p className="text-sm text-amber-200">
            Choose an orbit first to see which rockets can reach it.
          </p>
        )}
        <div className="grid gap-3 md:grid-cols-2">
          {catalog.launchVehicles.map((v) => {
            const cap = orbit ? (v.capacityKg[orbit.orbitClass] ?? 0) : null;
            const reason =
              cap === 0
                ? `Cannot reach ${orbit?.name ?? 'this orbit'}`
                : cap !== null && a.wetMassKg > cap
                  ? `Too small: your spacecraft is ${fmt(a.wetMassKg - cap, 1)} kg too heavy`
                  : null;
            const selected = design.launchVehicleId === v.id;
            return (
              <div
                key={v.id}
                className={cx(
                  'rounded-lg border p-3',
                  selected ? 'border-sky-400 bg-sky-950/60' : 'border-slate-700 bg-slate-900',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium">{v.name}</span>
                  <span className="text-sm text-slate-300">{fmt(v.costM, 1)} M$</span>
                </div>
                <p className="mt-1 text-sm text-slate-300">{v.description}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {cap === null
                    ? 'Capacity depends on the orbit.'
                    : `Capacity to this orbit: ${fmt(cap)} kg`}{' '}
                  · reliability {Math.round(v.reliability * 1000) / 10}%
                </p>
                {reason && (
                  <p className="mt-1 text-xs text-amber-200" id={`lv-${v.id}-reason`}>
                    {reason}
                  </p>
                )}
                <button
                  type="button"
                  aria-pressed={selected}
                  disabled={cap === 0}
                  aria-describedby={reason ? `lv-${v.id}-reason` : undefined}
                  onClick={() =>
                    edit({ type: 'setLaunchVehicle', launchVehicleId: selected ? null : v.id })
                  }
                  className="mt-2 rounded-md border border-slate-600 px-2 py-1 text-sm hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {selected ? 'Selected (click to clear)' : 'Choose'}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="segments-heading" className="space-y-2">
        <h3 id="segments-heading" className="text-lg font-semibold">
          Mission segments
        </h3>
        <div className="grid gap-3 md:grid-cols-4">
          <Card>
            <h4 className="font-medium">Launch</h4>
            <p className="text-sm text-slate-300">
              {a.resolved.launchVehicle?.name ?? 'No rocket yet'}
            </p>
          </Card>
          <Card>
            <h4 className="font-medium">Space</h4>
            <p className="text-sm text-slate-300">
              {a.resolved.parts.length} parts, {fmt(a.wetMassKg, 1)} kg
            </p>
          </Card>
          <Card>
            <h4 className="font-medium">Ground</h4>
            <label htmlFor="stations" className="text-sm text-slate-300">
              Ground stations per day
            </label>
            <select
              id="stations"
              value={design.groundStations}
              onChange={(e) => edit({ type: 'setGroundStations', count: Number(e.target.value) })}
              className="mt-1 w-full rounded-md border border-slate-600 bg-slate-900 px-2 py-1 text-sm"
            >
              <option value={1}>1 station</option>
              <option value={2}>2 stations</option>
              <option value={3}>3 stations</option>
            </select>
            <Why>
              More stations mean more contact time and more data sent home, but every station-day
              costs money.
            </Why>
          </Card>
          <Card>
            <h4 className="font-medium">User</h4>
            <p className="text-sm text-slate-300">
              {a.resolved.goals.length} goal{a.resolved.goals.length === 1 ? '' : 's'} for the
              science team
            </p>
          </Card>
        </div>
      </section>

      <section aria-labelledby="conops-heading" className="space-y-2">
        <h3 id="conops-heading" className="text-lg font-semibold">
          Concept of Operations (ConOps)
        </h3>
        <ol className="grid gap-2 md:grid-cols-6">
          {phases.map((p, i) => (
            <li
              key={p.name}
              className="rounded-md border border-slate-700 bg-slate-900 p-2 text-sm"
            >
              <span className="text-xs text-slate-400">{i + 1}.</span>{' '}
              <span className="font-medium">{p.name}</span>
              <span className="block text-xs text-slate-400">{p.length}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
