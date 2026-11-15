import { instrumentsFor } from '@gravity/engine';
import { Card, StatusBadge } from '../../components/ui.tsx';
import { useReview } from '../../hooks/useReview.ts';
import { cx } from '../../lib/format.ts';
import { useGame } from '../../store/game.ts';

export function GoalsStage() {
  const data = useReview();
  const design = useGame((s) => s.design);
  const edit = useGame((s) => s.edit);
  if (!data || !design) return null;
  const { scenario, review } = data;
  const parts = review.analysis.resolved.parts;
  const reqs = review.requirements;

  const toggle = (id: string) =>
    edit({
      type: 'setGoals',
      goalIds: design.goalIds.includes(id)
        ? design.goalIds.filter((g) => g !== id)
        : [...design.goalIds, id],
    });

  return (
    <div className="space-y-6">
      <Card>
        <h3 className="text-lg font-semibold">The need</h3>
        <p className="mt-1 text-slate-300">{scenario.objective}</p>
        <p className="mt-2 text-sm text-slate-400">
          Full success (Baseline) needs {scenario.baselineScience} science points; partial success
          (Threshold) needs {scenario.thresholdScience}.
        </p>
      </Card>

      <fieldset className="space-y-3">
        <legend className="mb-3 text-lg font-semibold">Science goals</legend>
        <div className="grid gap-3 md:grid-cols-2">
          {scenario.goals.map((g) => {
            const on = design.goalIds.includes(g.id);
            return (
              <div
                key={g.id}
                className={cx(
                  'relative flex items-start gap-3 rounded-xl border p-4 transition',
                  on
                    ? 'border-orange-400/70 bg-orange-500/10'
                    : 'border-white/10 bg-white/[0.02] hover:border-white/30',
                )}
              >
                <input
                  id={`goal-${g.id}`}
                  type="checkbox"
                  className="relative z-10 mt-1 h-5 w-5 shrink-0 accent-orange-500"
                  checked={on}
                  onChange={() => toggle(g.id)}
                  aria-describedby={`goal-${g.id}-detail`}
                />
                <div className="min-w-0 flex-1 space-y-2">
                  {/* The label stretches over the whole card, so any click toggles the goal. */}
                  <label
                    htmlFor={`goal-${g.id}`}
                    className="block cursor-pointer font-semibold text-white after:absolute after:inset-0 after:content-['']"
                  >
                    {g.title}
                  </label>
                  <p id={`goal-${g.id}-detail`} className="text-sm text-slate-400">
                    Needs: {g.measurement.replace('-', ' ')} · weight {Math.round(g.weight * 100)}%
                    of the science
                  </p>
                  <div
                    aria-hidden="true"
                    className="h-1.5 overflow-hidden rounded-full bg-white/10"
                  >
                    <div
                      className={cx('h-full rounded-full', on ? 'bg-orange-400' : 'bg-slate-500')}
                      style={{ width: `${Math.round(g.weight * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </fieldset>

      <section aria-labelledby="stm-heading" className="space-y-2">
        <h3 id="stm-heading" className="text-lg font-semibold">
          Science Traceability Matrix
        </h3>
        <p className="text-sm text-slate-400">
          How each goal traces to a measurement, an instrument and a requirement. It fills in as you
          design.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead className="text-slate-400">
              <tr>
                <th className="py-1 pr-3">Goal</th>
                <th className="py-1 pr-3">Measurement</th>
                <th className="py-1 pr-3">Instrument</th>
                <th className="py-1">Requirement</th>
              </tr>
            </thead>
            <tbody>
              {review.analysis.resolved.goals.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-2 text-slate-400">
                    Select a goal to start the matrix.
                  </td>
                </tr>
              )}
              {review.analysis.resolved.goals.map((g) => {
                const inst = instrumentsFor(parts, g.measurement);
                const req = reqs.find((r) => r.goalId === g.id);
                return (
                  <tr key={g.id} className="border-t border-slate-800">
                    <td className="py-2 pr-3">{g.title}</td>
                    <td className="py-2 pr-3 capitalize">{g.measurement.replace('-', ' ')}</td>
                    <td className="py-2 pr-3">
                      {inst.length ? (
                        inst.map((p) => p.name).join(', ')
                      ) : (
                        <StatusBadge status="unknown" label="None yet" />
                      )}
                    </td>
                    <td className="py-2">
                      {req && (
                        <span className="flex items-center gap-2">
                          {req.id}{' '}
                          <StatusBadge status={req.status === 'unknown' ? 'unknown' : req.status} />
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
