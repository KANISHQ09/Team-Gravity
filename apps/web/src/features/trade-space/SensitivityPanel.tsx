import { useState } from 'react';
import { type Sensitivity, catalog, sensitivity } from '@gravity/engine';
import type { Design } from '@gravity/shared';
import { Button, StatusBadge } from '../../components/ui.tsx';
import { fmt } from '../../lib/format.ts';
import { useGame } from '../../store/game.ts';

/** "What matters most?": single changes ranked by their effect on science (SRS-TRD-02). */
export function SensitivityPanel({ design }: { design: Design }) {
  const edit = useGame((s) => s.edit);
  const [result, setResult] = useState<{ for: Design; data: Sensitivity } | null>(null);
  const current = result?.for === design ? result.data : null;

  return (
    <section aria-labelledby="sens-heading" className="space-y-2">
      <h3 id="sens-heading" className="text-lg font-semibold">
        What matters most?
      </h3>
      <p className="text-sm text-slate-400">
        Tries one change at a time and simulates each five times, so you can see which decisions
        move your science the most.
      </p>
      <Button onClick={() => setResult({ for: design, data: sensitivity(design, catalog) })}>
        {current ? 'Analyse again' : 'Analyse my design'}
      </Button>
      {current && (
        <div className="overflow-x-auto">
          <p className="text-sm text-slate-300">
            Your design averages {fmt(current.baseScience)} science points for{' '}
            {fmt(current.baseCostM, 1)} M$.
          </p>
          <table className="mt-2 w-full min-w-[34rem] text-left text-sm">
            <thead className="text-slate-400">
              <tr>
                <th className="py-1 pr-3">Change</th>
                <th className="py-1 pr-3 text-right">Science</th>
                <th className="py-1 pr-3 text-right">Cost</th>
                <th className="py-1 pr-3">Launch</th>
                <th className="py-1">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {current.rows.slice(0, 8).map((r) => (
                <tr key={r.label} className="border-t border-slate-800">
                  <td className="py-1.5 pr-3">{r.label}</td>
                  <td
                    className={`py-1.5 pr-3 text-right ${r.scienceDelta >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}
                  >
                    {r.scienceDelta >= 0 ? '+' : '−'}
                    {fmt(Math.abs(r.scienceDelta))}
                  </td>
                  <td className="py-1.5 pr-3 text-right">
                    {r.costDeltaM >= 0 ? '+' : '−'}
                    {fmt(Math.abs(r.costDeltaM), 1)} M$
                  </td>
                  <td className="py-1.5 pr-3">
                    {r.launchable ? (
                      <StatusBadge status="green" label="OK" />
                    ) : (
                      <StatusBadge status="red" label="Blocked" />
                    )}
                  </td>
                  <td className="py-1.5 text-right">
                    <Button
                      variant="ghost"
                      onClick={() => edit(r.edit)}
                      aria-label={`Apply: ${r.label}`}
                    >
                      Apply
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
