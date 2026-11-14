import { useState } from 'react';
import { NO_GO_REASONS } from '@gravity/shared';
import { Button, Card, StatusBadge } from '../../components/ui.tsx';
import { useReview } from '../../hooks/useReview.ts';
import { encodeDesign, useGame } from '../../store/game.ts';

/** Stage 6: team GO/NO-GO vote and launch (SRS-COL-04, AC-3). */
export function LaunchStage() {
  const data = useReview();
  const design = useGame((s) => s.design);
  const players = useGame((s) => s.players);
  const votes = useGame((s) => s.votes);
  const castVote = useGame((s) => s.castVote);
  const launch = useGame((s) => s.launch);
  const setStage = useGame((s) => s.setStage);
  const [reason, setReason] = useState<(typeof NO_GO_REASONS)[number]>(NO_GO_REASONS[0]);
  const [copied, setCopied] = useState(false);
  if (!data || !design) return null;
  const { review } = data;
  const allGo = players.length > 0 && votes.every((v) => v?.vote === 'go');
  const blockers = review.issues.filter((i) => i.severity === 'error');
  const code = encodeDesign(design);

  return (
    <div className="space-y-6">
      {!review.canLaunch && (
        <Card className="border-rose-500">
          <h3 className="font-semibold">Launch is blocked</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {blockers.map((b) => (
              <li key={b.code + b.message}>
                {b.message}: {b.fix}
              </li>
            ))}
            {blockers.length === 0 &&
              review.readiness.blockers.map((b) => (
                <li key={b.id}>
                  {b.label}: {b.fix ?? b.detail}
                </li>
              ))}
            {blockers.length === 0 && review.readiness.blockers.length === 0 && (
              <li>Readiness is below 80% green. Improve the yellow and red items.</li>
            )}
          </ul>
          <Button className="mt-3" onClick={() => setStage('verify')}>
            Open the readiness review
          </Button>
        </Card>
      )}

      <section aria-labelledby="vote-heading" className="space-y-3">
        <h3 id="vote-heading" className="text-lg font-semibold">
          GO / NO-GO poll
        </h3>
        <p className="text-sm text-slate-400">
          Every player must vote GO. Any design change resets the poll.
        </p>
        <ul className="space-y-2">
          {players.map((p, i) => {
            const v = votes[i];
            return (
              <li
                key={p.name}
                className="flex flex-wrap items-center gap-2 rounded-md border border-slate-700 p-2"
              >
                <span className="min-w-24 font-medium">{p.name}</span>
                {v ? (
                  <StatusBadge
                    status={v.vote === 'go' ? 'green' : 'red'}
                    label={v.vote === 'go' ? 'GO' : `NO-GO: ${v.reason}`}
                  />
                ) : (
                  <StatusBadge status="unknown" label="Not voted" />
                )}
                <Button
                  variant="primary"
                  disabled={!review.canLaunch}
                  onClick={() => castVote(i, { vote: 'go' })}
                >
                  GO
                </Button>
                <label className="sr-only" htmlFor={`nogo-${i}`}>
                  NO-GO reason for {p.name}
                </label>
                <select
                  id={`nogo-${i}`}
                  value={reason}
                  onChange={(e) => setReason(e.target.value as (typeof NO_GO_REASONS)[number])}
                  className="rounded-md border border-slate-600 bg-slate-900 px-2 py-1.5 text-sm"
                >
                  {NO_GO_REASONS.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
                <Button variant="danger" onClick={() => castVote(i, { vote: 'no-go', reason })}>
                  NO-GO
                </Button>
              </li>
            );
          })}
        </ul>
        <Button
          variant="primary"
          className="px-6 py-3 text-base"
          disabled={!review.canLaunch || !allGo}
          aria-describedby="launch-help"
          onClick={launch}
        >
          Launch mission
        </Button>
        <p id="launch-help" className="text-sm text-slate-400">
          {!review.canLaunch
            ? 'Fix the blocking problems first.'
            : allGo
              ? 'All GO. Ready when you are.'
              : 'Waiting for every player to vote GO.'}
        </p>
      </section>

      <section aria-labelledby="share-heading" className="space-y-2">
        <h3 id="share-heading" className="text-lg font-semibold">
          Share this design
        </h3>
        <p className="text-sm text-slate-400">
          Send this code to a friend or teacher; they can load it from the home screen.
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            readOnly
            value={code}
            aria-label="Design code"
            className="min-w-0 flex-1 rounded-md border border-slate-600 bg-slate-900 px-3 py-2 font-mono text-xs"
          />
          <Button
            onClick={() => {
              void navigator.clipboard?.writeText(code).then(() => setCopied(true));
            }}
          >
            {copied ? 'Copied' : 'Copy code'}
          </Button>
        </div>
      </section>
    </div>
  );
}
