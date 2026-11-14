import { type Player, useGame } from '../store/game.ts';
import { myMember, useOnline } from '../store/online.ts';

/** The player at the controls: this device's member in an online room, or the hot-seat player. */
export function useActingPlayer(): Player | undefined {
  const online = useOnline();
  const hotSeat = useGame((s) => s.players[s.activePlayer]);
  if (!online.active) return hotSeat;
  const me = myMember(online);
  return me ? { name: 'You', roles: me.roles } : undefined;
}
