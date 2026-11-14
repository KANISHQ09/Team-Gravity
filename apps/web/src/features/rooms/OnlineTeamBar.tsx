import { useEffect, useState } from 'react';
import { ROLE_INFO, ROLES, type Role } from '@gravity/shared';
import { Button, StatusBadge } from '../../components/ui.tsx';
import { claimRoles, leaveRoom, removableIn, removeMember } from '../../lib/realtime.ts';
import { useGame } from '../../store/game.ts';
import { myMember, playerLabel, useOnline } from '../../store/online.ts';
import { describeEdit } from './describeEdit.ts';

/** Online room: code, players, role claims and proposals for me (FR-13). */
export function OnlineTeamBar() {
  const o = useOnline();
  const respond = useGame((s) => s.respondToProposal);
  const [copied, setCopied] = useState(false);
  const me = myMember(o);
  const holder = (role: Role) => o.members.find((m) => m.roles.includes(role));
  const mine = o.proposals.filter((p) => me?.roles.includes(p.owner));
  const unclaimed = ROLES.filter((r) => !holder(r));
  const iAmHost = !!me && o.hostId === me.userId;
  const someoneOffline = o.members.some((m) => !m.connected);

  // Tick once a second while someone is offline, for the "can remove in" countdown.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!someoneOffline) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [someoneOffline]);

  const toggle = (role: Role) => {
    if (!me) return;
    const next = me.roles.includes(role) ? me.roles.filter((r) => r !== role) : [...me.roles, role];
    if (next.length) claimRoles(next);
  };

  return (
    <section
      aria-label="Online room"
      className="space-y-3 rounded-lg border border-teal-600 bg-teal-950/40 p-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p>
          Online room <span className="font-mono text-lg font-bold tracking-widest">{o.code}</span>{' '}
          <StatusBadge
            status={
              o.status === 'connected' ? 'green' : o.status === 'connecting' ? 'unknown' : 'red'
            }
            label={
              o.status === 'connected'
                ? 'Connected'
                : o.status === 'connecting'
                  ? 'Connecting'
                  : 'Reconnecting'
            }
          />
        </p>
        <div className="flex gap-2">
          <Button
            onClick={() => {
              void navigator.clipboard?.writeText(o.code ?? '').then(() => setCopied(true));
            }}
          >
            {copied ? 'Code copied' : 'Copy code'}
          </Button>
          <Button variant="ghost" onClick={leaveRoom}>
            Leave room
          </Button>
        </div>
      </div>

      <p className="text-sm text-slate-300">
        {iAmHost
          ? 'You are the host: you start the launch, and you can free the seat of a player who has been offline for 2 minutes.'
          : `${o.hostId ? playerLabel(o, o.hostId) : 'The host'} starts the launch. If the host is offline for 2 minutes, the next player online becomes host automatically.`}
      </p>

      <ul className="grid gap-2 sm:grid-cols-2">
        {o.members.map((m) => {
          const wait = removableIn(m.userId);
          return (
            <li key={m.userId} className="space-y-1 rounded-md border border-slate-700 p-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{playerLabel(o, m.userId)}</span>
                {m.connected ? (
                  <StatusBadge status="green" label="Online" />
                ) : (
                  <StatusBadge status="yellow" label="Offline" />
                )}
              </div>
              <span className="block text-xs text-slate-300">
                {m.roles.length ? m.roles.map((r) => ROLE_INFO[r].name).join(' + ') : 'No role yet'}
              </span>
              {iAmHost && !m.connected && m.userId !== me?.userId && (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="danger"
                    disabled={wait > 0}
                    aria-describedby={`remove-${m.userId}-hint`}
                    onClick={() => removeMember(m.userId)}
                  >
                    Free {playerLabel(o, m.userId).split(' (')[0]}'s seat
                  </Button>
                  <span id={`remove-${m.userId}-hint`} className="text-xs text-slate-400">
                    {wait > 0
                      ? `Possible in ${Math.floor(wait / 60)}:${String(wait % 60).padStart(2, '0')}, in case they reconnect.`
                      : 'Their roles become free for others to claim.'}
                  </span>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {me && (
        <fieldset className="space-y-1">
          <legend className="text-sm font-semibold">Your roles</legend>
          <div className="flex flex-wrap gap-2">
            {ROLES.map((r) => {
              const owner = holder(r);
              const takenByOther = owner && owner.userId !== me.userId;
              return (
                <button
                  key={r}
                  type="button"
                  aria-pressed={me.roles.includes(r)}
                  disabled={!!takenByOther}
                  onClick={() => toggle(r)}
                  className="rounded-full border border-slate-600 px-3 py-1 text-left text-sm aria-pressed:border-teal-400 aria-pressed:bg-teal-900 disabled:opacity-40"
                >
                  {/* The role name stays the accessible name; details are visible text, not a tooltip. */}
                  <span className="font-medium">{ROLE_INFO[r].name}</span>
                  <span className="block text-xs text-slate-300">
                    {takenByOther ? `Held by ${playerLabel(o, owner.userId)}` : ROLE_INFO[r].owns}
                  </span>
                </button>
              );
            })}
          </div>
          {unclaimed.length > 0 && (
            <p className="text-xs text-amber-200">
              Unclaimed: {unclaimed.map((r) => ROLE_INFO[r].name).join(', ')}. Someone must hold
              every role so all parts of the design can be edited.
            </p>
          )}
        </fieldset>
      )}

      {mine.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Proposals for you</h3>
          {mine.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-2 text-sm">
              <span>
                {playerLabel(o, p.from)} proposes to {describeEdit(p.edit)} ("{p.message}").
              </span>
              <Button variant="primary" onClick={() => respond(p.id, true)}>
                Accept
              </Button>
              <Button onClick={() => respond(p.id, false)}>Reject</Button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
