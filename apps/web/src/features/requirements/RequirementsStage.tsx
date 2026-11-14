import { StatusBadge } from '../../components/ui.tsx';
import { useReview } from '../../hooks/useReview.ts';

const SEGMENT = { launch: 'Launch', space: 'Space', ground: 'Ground', user: 'User' } as const;

export function RequirementsStage() {
  const data = useReview();
  if (!data) return null;
  const { review, scenario } = data;
  const reqs = review.requirements;
  const passing = reqs.filter((r) => r.status === 'pass').length;

  return (
    <div className="space-y-4">
      <p className="text-slate-300">
        Each requirement is measurable and says how it will be <strong>verified</strong>. They
        update as you change the design. {passing} of {reqs.length} currently pass.
      </p>
      <p className="text-sm text-slate-400">
        Outcome levels: Baseline (full success) = {scenario.baselineScience} science points ·
        Threshold (partial success) = {scenario.thresholdScience}.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[44rem] text-left text-sm">
          <thead className="text-slate-400">
            <tr>
              <th className="py-1 pr-3">ID</th>
              <th className="py-1 pr-3">Requirement</th>
              <th className="py-1 pr-3">Segment</th>
              <th className="py-1 pr-3">Verified by</th>
              <th className="py-1 pr-3">Target</th>
              <th className="py-1 pr-3">Current</th>
              <th className="py-1">Status</th>
            </tr>
          </thead>
          <tbody>
            {reqs.map((r) => (
              <tr key={r.id} className="border-t border-slate-800 align-top">
                <td className="py-2 pr-3 font-mono text-xs">{r.id}</td>
                <td className="py-2 pr-3">{r.text}</td>
                <td className="py-2 pr-3">{SEGMENT[r.segment]}</td>
                <td className="py-2 pr-3 capitalize">{r.verification}</td>
                <td className="py-2 pr-3">{r.target}</td>
                <td className="py-2 pr-3">{r.actual}</td>
                <td className="py-2">
                  <StatusBadge status={r.status === 'unknown' ? 'unknown' : r.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
