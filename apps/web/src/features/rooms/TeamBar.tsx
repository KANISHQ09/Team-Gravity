import { ROLE_INFO } from '@gravity/shared';
import { Button } from '../../components/ui.tsx';
import { useGame } from '../../store/game.ts';
import { useOnline } from '../../store/online.ts';
import { describeEdit } from './describeEdit.ts';
import { OnlineTeamBar } from './OnlineTeamBar.tsx';

/** Team bar: the online room when connected, otherwise hot-seat co-op (FR-13, FR-13a). */
export function TeamBar() {
  const online = useOnline((s) => s.active);
  return online ? <OnlineTeamBar /> : <HotSeatBar />;
}

/** Hot-seat co-op: whose turn it is, their roles, and pending proposals (FR-13a). */
function HotSeatBar() {
  const players = useGame((s) => s.players);
  const active = useGame((s) => s.activePlayer);
  const proposals = useGame((s) => s.proposals);
  const pass = useGame((s) => s.passDevice);
  const respond = useGame((s) => s.respondToProposal);
  if (players.length <= 1) return null;
  const me = players[active]!;
  const mine = proposals.filter((p) => me.roles.includes(p.owner));

  return (
    <section aria-label="Team" className="rounded-lg border border-violet-700 bg-violet-950/50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p>
          <span className="font-semibold">{me.name}</span> is at the controls:{' '}
          {me.roles.map((r) => ROLE_INFO[r].name).join(' + ')}
          <span className="block text-xs text-violet-200">
            Owns: {me.roles.map((r) => ROLE_INFO[r].owns).join('; ')}
          </span>
        </p>
        <Button onClick={pass}>Pass to {players[(active + 1) % players.length]!.name}</Button>
      </div>
      {mine.length > 0 && (
        <div className="mt-3 space-y-2">
          <h3 className="text-sm font-semibold">Proposals for you</h3>
          {mine.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-2 text-sm">
              <span>
                {players[p.from]?.name} proposes to {describeEdit(p.edit)}.
              </span>
              <Button variant="primary" onClick={() => respond(p.id, true)}>
                Accept
              </Button>
              <Button onClick={() => respond(p.id, false)}>Reject</Button>
            </div>
          ))}
        </div>
      )}
      {proposals.length > mine.length && (
        <p className="mt-2 text-xs text-violet-200">
          {proposals.length - mine.length} proposal(s) waiting for other team members.
        </p>
      )}
    </section>
  );
}
