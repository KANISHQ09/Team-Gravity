import { useState } from 'react';
import { catalog } from '@gravity/engine';
import type { Mitigation, Part, PartCategory } from '@gravity/shared';
import { Button, StatusBadge, Why } from '../../components/ui.tsx';
import { useReview } from '../../hooks/useReview.ts';
import { CATEGORY_LABEL, cx, fmt } from '../../lib/format.ts';
import { canEdit, useGame } from '../../store/game.ts';

const CATEGORIES: PartCategory[] = [
  'bus',
  'solar',
  'battery',
  'antenna',
  'computer',
  'adcs',
  'propulsion',
  'instrument',
];

const MITIGATIONS: { id: Mitigation; name: string; detail: string }[] = [
  {
    id: 'budget-reserve',
    name: 'Budget reserve (+10% cost)',
    detail: 'Absorbs a budget cut so no instrument has to be removed.',
  },
  {
    id: 'schedule-margin',
    name: 'Schedule margin (+2 months)',
    detail: 'Absorbs testing delays so the launch does not slip.',
  },
  {
    id: 'extra-testing',
    name: 'Extra testing (+5% cost, +1 month)',
    detail: 'Catches early instrument failures before launch.',
  },
];

function partStats(p: Part): string {
  const s: string[] = [
    `${fmt(p.massKg, 1)} kg`,
    `${fmt(p.powerW)} W`,
    `${fmt(p.costM, 2)} M$`,
    `${p.devMonths} mo`,
  ];
  if (p.payloadCapacityKg) s.push(`carries ${fmt(p.payloadCapacityKg)} kg`);
  if (p.areaM2) s.push(`${p.areaM2} m² panels`);
  if (p.capacityWh) s.push(`${fmt(p.capacityWh)} Wh`);
  if (p.gainDbi !== undefined) s.push(`${p.gainDbi} dBi, ${p.txPowerW} W radio`);
  if (p.storageGbit) s.push(`${p.storageGbit} Gbit recorder${p.radHard ? ', rad-hard' : ''}`);
  if (p.pointingArcsec)
    s.push(`${p.pointingArcsec}″ pointing${p.redundant ? ', spare wheel' : ''}`);
  if (p.ispS) s.push(`Isp ${p.ispS} s, ${fmt(p.propellantKg ?? 0)} kg fuel`);
  if (p.measures)
    s.push(`${p.measures.join(', ').replace(/-/g, ' ')}, ${p.dataGbitPerDay} Gbit/day`);
  return s.join(' · ');
}

export function DesignStage() {
  const data = useReview();
  const design = useGame((s) => s.design);
  const edit = useGame((s) => s.edit);
  const player = useGame((s) => s.players[s.activePlayer]);
  const [category, setCategory] = useState<PartCategory>('bus');
  if (!data || !design) return null;
  const { review } = data;
  const a = review.analysis;
  const explorer = design.difficulty === 'explorer';
  const goalMeasures = new Set(a.resolved.goals.map((g) => g.measurement));
  const counts = new Map<string, number>();
  for (const id of design.partIds) counts.set(id, (counts.get(id) ?? 0) + 1);
  const busChosen = a.resolved.parts.some((p) => p.category === 'bus');

  const available = catalog.parts.filter((p) => p.category === category);

  const disabledReason = (p: Part): string | null => {
    if (explorer && p.advanced) return 'Advanced part: unlocks on Engineer difficulty.';
    if (p.category === 'bus' && busChosen && !counts.has(p.id))
      return 'You already have a bus. Remove it first to switch.';
    if (design.partIds.length >= 30) return 'The design already has 30 parts.';
    return null;
  };

  return (
    <div className="space-y-6">
      <section aria-labelledby="parts-heading" className="space-y-3">
        <h3 id="parts-heading" className="text-lg font-semibold">
          Parts
        </h3>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Part category">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={category === c}
              onClick={() => setCategory(c)}
              className={cx(
                'rounded-full border px-3 py-1 text-sm',
                category === c
                  ? 'border-sky-400 bg-sky-900 text-sky-50'
                  : 'border-slate-600 hover:bg-slate-800',
              )}
            >
              {CATEGORY_LABEL[c]}
              {a.resolved.parts.some((p) => p.category === c) && (
                <span aria-label="has parts"> ●</span>
              )}
            </button>
          ))}
        </div>
        <ul className="grid gap-3 md:grid-cols-2">
          {available.map((p) => {
            const reason = disabledReason(p);
            const n = counts.get(p.id) ?? 0;
            const relevant = p.measures?.some((m) => goalMeasures.has(m));
            const ownerOk = canEdit(player, {
              type: 'addPart',
              partId: p.id,
              category: p.category,
            });
            return (
              <li key={p.id} className="rounded-lg border border-slate-700 bg-slate-900 p-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium">{p.name}</span>
                  <span className="flex gap-1">
                    {p.advanced && <StatusBadge status="unknown" label="Advanced" />}
                    {relevant && <StatusBadge status="ok" label="Fits a goal" />}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-400">{partStats(p)}</p>
                <Why>{p.description}</Why>
                {reason && (
                  <p id={`part-${p.id}-reason`} className="mt-1 text-xs text-amber-200">
                    {reason}
                  </p>
                )}
                <div className="mt-2 flex items-center gap-2">
                  <Button
                    disabled={!!reason}
                    aria-describedby={reason ? `part-${p.id}-reason` : undefined}
                    onClick={() => edit({ type: 'addPart', partId: p.id, category: p.category })}
                  >
                    {ownerOk ? 'Add' : 'Propose adding'}
                  </Button>
                  {n > 0 && (
                    <>
                      <Button
                        variant="ghost"
                        onClick={() =>
                          edit({ type: 'removePart', partId: p.id, category: p.category })
                        }
                      >
                        Remove one
                      </Button>
                      <span className="text-sm text-slate-300">×{n} in design</span>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="mel-heading" className="space-y-2">
        <h3 id="mel-heading" className="text-lg font-semibold">
          Master Equipment List
        </h3>
        {a.resolved.parts.length === 0 ? (
          <p className="text-sm text-slate-400">No parts yet. Start with a bus.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="text-slate-400">
                <tr>
                  <th className="py-1 pr-3">Part</th>
                  <th className="py-1 pr-3">Category</th>
                  <th className="py-1 pr-3 text-right">Mass (kg)</th>
                  <th className="py-1 pr-3 text-right">Power (W)</th>
                  <th className="py-1 pr-3 text-right">Cost (M$)</th>
                  <th className="py-1">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {a.resolved.parts.map((p, i) => (
                  <tr key={`${p.id}-${i}`} className="border-t border-slate-800">
                    <td className="py-1.5 pr-3">{p.name}</td>
                    <td className="py-1.5 pr-3">{CATEGORY_LABEL[p.category]}</td>
                    <td className="py-1.5 pr-3 text-right">
                      {fmt(p.massKg + (p.propellantKg ?? 0), 1)}
                    </td>
                    <td className="py-1.5 pr-3 text-right">{fmt(p.powerW)}</td>
                    <td className="py-1.5 pr-3 text-right">{fmt(p.costM, 2)}</td>
                    <td className="py-1.5 text-right">
                      <Button
                        variant="ghost"
                        onClick={() =>
                          edit({ type: 'removePart', partId: p.id, category: p.category })
                        }
                        aria-label={`Remove ${p.name}`}
                      >
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-slate-600 font-medium">
                  <td className="py-1.5 pr-3" colSpan={2}>
                    Total (with fuel)
                  </td>
                  <td className="py-1.5 pr-3 text-right">{fmt(a.wetMassKg, 1)}</td>
                  <td className="py-1.5 pr-3 text-right">{fmt(a.powerConsumptionW)}</td>
                  <td className="py-1.5 pr-3 text-right">
                    {fmt(
                      a.resolved.parts.reduce((s, p) => s + p.costM, 0),
                      2,
                    )}
                  </td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-slate-400">
          Δv {fmt(a.deltaVAvailableMs)} of {fmt(a.deltaVRequiredMs)} m/s needed · bus load{' '}
          {a.busCapacityKg ? `${fmt(a.carriedMassKg, 1)} of ${fmt(a.busCapacityKg)} kg` : 'no bus'}{' '}
          · battery {fmt(a.batteryUsableWh)} Wh usable for {fmt(a.eclipseEnergyNeedWh)} Wh per
          eclipse
        </p>
      </section>

      <fieldset className="space-y-2">
        <legend className="mb-1 text-lg font-semibold">Risk reserves</legend>
        {MITIGATIONS.map((m) => (
          <div key={m.id} className="flex items-start gap-3 text-sm">
            <input
              id={`mitigation-${m.id}`}
              aria-describedby={`mitigation-${m.id}-detail`}
              type="checkbox"
              className="mt-1 h-4 w-4"
              checked={design.mitigations.includes(m.id)}
              onChange={() =>
                edit({
                  type: 'setMitigations',
                  mitigations: design.mitigations.includes(m.id)
                    ? design.mitigations.filter((x) => x !== m.id)
                    : [...design.mitigations, m.id],
                })
              }
            />
            <div>
              <label htmlFor={`mitigation-${m.id}`} className="cursor-pointer font-medium">
                {m.name}
              </label>
              <p id={`mitigation-${m.id}-detail`} className="text-slate-400">
                {m.detail}
              </p>
            </div>
          </div>
        ))}
      </fieldset>
    </div>
  );
}
