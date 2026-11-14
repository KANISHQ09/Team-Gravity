import { READINESS_THRESHOLD, type Risk } from '@gravity/engine';
import { StatusBadge } from '../../components/ui.tsx';
import { useReview } from '../../hooks/useReview.ts';
import { SensitivityPanel } from '../trade-space/SensitivityPanel.tsx';
import { cx, pct } from '../../lib/format.ts';

export function VerifyStage() {
  const data = useReview();
  if (!data) return null;
  const { readiness, issues, risks } = data.review;
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');

  return (
    <div className="space-y-6">
      <section aria-labelledby="gate-heading" className="space-y-2">
        <h3 id="gate-heading" className="text-lg font-semibold">
          Launch readiness review
        </h3>
        <p className="text-slate-300">
          {pct(readiness.greenFraction)} green (needs {pct(READINESS_THRESHOLD)}) ·{' '}
          {readiness.blockers.length
            ? `${readiness.blockers.length} critical item(s) not green`
            : 'all critical items green'}{' '}
          ·{' '}
          {readiness.ready ? (
            <StatusBadge status="green" label="Ready for launch" />
          ) : (
            <StatusBadge status="red" label="Not ready" />
          )}
        </p>
        <ul className="space-y-2">
          {readiness.items.map((item) => (
            <li key={item.id} className="rounded-md border border-slate-700 bg-slate-900 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={item.status} />
                <span className="font-medium">{item.label}</span>
                {item.critical && <span className="text-xs text-sky-300">critical</span>}
              </div>
              <p className="mt-1 text-sm text-slate-300">{item.detail}</p>
              {item.fix && item.status !== 'green' && (
                <p className="mt-1 text-sm text-amber-200">How to fix: {item.fix}</p>
              )}
            </li>
          ))}
        </ul>
      </section>

      {(errors.length > 0 || warnings.length > 0) && (
        <section aria-labelledby="issues-heading" className="space-y-2">
          <h3 id="issues-heading" className="text-lg font-semibold">
            Problems found
          </h3>
          <ul className="space-y-2">
            {[...errors, ...warnings].map((i) => (
              <li
                key={i.code + i.message}
                className="rounded-md border border-slate-700 bg-slate-900 p-3 text-sm"
              >
                <div className="flex items-center gap-2">
                  <StatusBadge
                    status={i.severity === 'error' ? 'red' : 'yellow'}
                    label={i.severity === 'error' ? 'Blocks launch' : 'Warning'}
                  />
                  <span className="font-medium">{i.message}</span>
                </div>
                <p className="mt-1 text-slate-300">Why: {i.why}</p>
                <p className="text-amber-200">Fix: {i.fix}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <RiskMatrix risks={risks} />

      {data.review.canLaunch && <SensitivityPanel design={data.review.analysis.resolved.design} />}
    </div>
  );
}

function RiskMatrix({ risks }: { risks: readonly Risk[] }) {
  const cell = (l: number, i: number) => risks.filter((r) => r.likelihood === l && r.impact === i);
  const tone = (score: number) =>
    score >= 15 ? 'bg-rose-950' : score >= 8 ? 'bg-amber-950' : 'bg-emerald-950';
  return (
    <section aria-labelledby="risk-heading" className="space-y-2">
      <h3 id="risk-heading" className="text-lg font-semibold">
        5×5 risk matrix
      </h3>
      <div className="overflow-x-auto">
        <table className="min-w-[30rem] border-collapse text-xs">
          <caption className="mb-1 text-left text-slate-400">
            Rows: likelihood (5 = near certain). Columns: impact (5 = mission loss).
          </caption>
          <thead>
            <tr>
              <th scope="col" className="p-1">
                <span className="sr-only">Likelihood</span>
              </th>
              {[1, 2, 3, 4, 5].map((i) => (
                <th key={i} scope="col" className="p-1 text-slate-400">
                  Impact {i}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[5, 4, 3, 2, 1].map((l) => (
              <tr key={l}>
                <th scope="row" className="p-1 text-slate-400">
                  Likelihood {l}
                </th>
                {[1, 2, 3, 4, 5].map((i) => (
                  <td
                    key={i}
                    className={cx('h-12 w-24 border border-slate-700 p-1 align-top', tone(l * i))}
                  >
                    {cell(l, i).map((r) => (
                      <span key={r.type} className="block">
                        {r.name}
                      </span>
                    ))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="space-y-1 text-sm">
        {risks.map((r) => (
          <li key={r.type} className="flex flex-wrap items-center gap-2">
            <StatusBadge status={r.level} label={`${r.level} ${r.score}`} />
            <span>{r.name}</span>
            <span className="text-slate-400">
              {r.mitigated ? `mitigated by: ${r.mitigation}` : `mitigation: ${r.mitigation}`}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
