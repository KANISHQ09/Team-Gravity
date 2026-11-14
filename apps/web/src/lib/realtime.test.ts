import { emptyDesign } from '@gravity/shared';
import { runMission } from '@gravity/engine';
import { BALANCE_DESIGNS } from '../../../../packages/engine/tests/fixtures/designs.ts';
import { useGame } from '../store/game.ts';
import { useOnline } from '../store/online.ts';
import { type RoomSocket, attach } from './realtime.ts';

/** A fake Socket.IO client that records emits and lets the test fire server events. */
function fakeSocket() {
  const handlers = new Map<string, (payload: never) => void>();
  const emitted: { event: string; payload: unknown }[] = [];
  const socket: RoomSocket = {
    on: (event, handler) => handlers.set(event, handler),
    emit: (event, payload) => emitted.push({ event, payload }),
    disconnect: () => undefined,
  };
  const fire = (event: string, payload?: unknown) =>
    (handlers.get(event) as (p: unknown) => void)(payload);
  return { socket, emitted, fire };
}

const initialGame = useGame.getState();

describe('online room client', () => {
  beforeEach(() => {
    localStorage.clear();
    useGame.setState(initialGame, true);
    useOnline.getState().reset();
  });

  it('joins, syncs the design, routes edits by role and shows the shared result', () => {
    const { socket, emitted, fire } = fakeSocket();
    useOnline.getState().set({ active: true, me: 'me', code: 'K7QX2M' });
    attach(socket, 'K7QX2M');

    fire('connect');
    expect(emitted.at(-1)).toEqual({ event: 'room:join', payload: { code: 'K7QX2M' } });

    const design = emptyDesign('lunar-orbiter', 'engineer');
    fire('room:state', {
      roomId: 'r1',
      code: 'K7QX2M',
      hostId: 'me',
      status: 'design',
      design,
      version: 3,
      members: [
        { userId: 'me', roles: ['mission-architect'], vote: null, connected: true },
        {
          userId: 'friend',
          roles: ['spacecraft-engineer', 'science-lead', 'operations'],
          vote: null,
          connected: true,
        },
      ],
      proposals: [],
    });
    expect(useGame.getState().design).toEqual(design);
    expect(useGame.getState().screen).toBe('mission');

    // An edit I own goes straight to the server, at the current version.
    useGame.getState().edit({ type: 'setOrbit', orbitId: 'llo-100' });
    expect(emitted.at(-1)).toEqual({
      event: 'design:patch',
      payload: { edit: { type: 'setOrbit', orbitId: 'llo-100' }, baseVersion: 3 },
    });
    // The design only changes when the server confirms it.
    expect(useGame.getState().design?.orbitId).toBeNull();
    fire('design:applied', { design: { ...design, orbitId: 'llo-100' }, version: 4 });
    expect(useGame.getState().design?.orbitId).toBe('llo-100');
    expect(useOnline.getState().version).toBe(4);

    // An edit owned by another role becomes a proposal.
    useGame.getState().edit({ type: 'addPart', partId: 'bus-medium', category: 'bus' });
    expect(emitted.at(-1)?.event).toBe('proposal:create');
    expect(useGame.getState().notice).toMatch(/proposal/);

    // Votes and launch go to the server too.
    useGame.getState().castVote(0, { vote: 'go' });
    expect(emitted.at(-1)).toEqual({ event: 'vote:cast', payload: { vote: 'go' } });
    useGame.getState().launch();
    expect(emitted.at(-1)?.event).toBe('sim:start');

    const result = runMission(BALANCE_DESIGNS['lunar-orbiter']![0]!.design, 1);
    fire('sim:result', result);
    expect(useGame.getState().screen).toBe('flight');
    expect(useGame.getState().result?.report.total).toBe(result.report.total);
  });

  it('shows server errors as notices and tracks the latest version after a conflict', () => {
    const { socket, fire } = fakeSocket();
    useOnline.getState().set({ active: true, me: 'me', code: 'K7QX2M' });
    attach(socket, 'K7QX2M');
    fire('design:rejected', {
      title: 'Version conflict',
      reason: 'The design changed.',
      latestVersion: 9,
    });
    expect(useOnline.getState().version).toBe(9);
    expect(useGame.getState().notice).toBe('Version conflict: The design changed.');
    fire('room:error', { title: 'Role taken', detail: 'Another player holds it.' });
    expect(useGame.getState().notice).toBe('Role taken: Another player holds it.');
  });

  it('after an online mission, redesign continues solo with all roles', () => {
    useOnline.getState().set({ active: true, me: 'me' });
    useGame.setState({ design: emptyDesign('lunar-orbiter', 'engineer') });
    useGame.getState().redesign();
    expect(useOnline.getState().active).toBe(false);
    expect(useGame.getState().players[0]?.roles).toHaveLength(4);
    expect(useGame.getState().stage).toBe('design');
  });
});
