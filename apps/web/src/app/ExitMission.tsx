import { useEffect, useRef, useState } from 'react';
import { Button } from '../components/ui.tsx';
import { useGame } from '../store/game.ts';
import { useOnline } from '../store/online.ts';

/**
 * "Exit mission" with a confirmation step, so a design is never lost by one
 * stray click. Online, it also leaves the room so the seat frees at once.
 */
export function ExitMission() {
  const exit = useGame((s) => s.exitMission);
  const team = useGame((s) => s.players.length > 1);
  const online = useOnline((s) => s.active);
  const [asking, setAsking] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Put focus on the safe choice when the question appears.
  useEffect(() => {
    if (asking) dialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
  }, [asking]);

  if (!asking) {
    return (
      <Button variant="ghost" onClick={() => setAsking(true)}>
        Exit mission
      </Button>
    );
  }
  return (
    <div
      ref={dialogRef}
      role="alertdialog"
      aria-labelledby="exit-title"
      aria-describedby="exit-detail"
      className="flex w-full flex-wrap items-center gap-2 rounded-md border border-rose-500/60 bg-rose-950/60 p-3 text-sm"
    >
      <div className="min-w-0 flex-1">
        <p id="exit-title" className="font-semibold">
          Exit this mission?
        </p>
        <p id="exit-detail" className="text-slate-300">
          {online
            ? 'You will leave the online room; the others can keep playing. '
            : team
              ? 'This ends the mission for every player on this device. '
              : ''}
          The current design is cleared from this device. Missions you already flew stay in the
          trade-space chart.
        </p>
      </div>
      <Button onClick={() => setAsking(false)}>Keep playing</Button>
      <Button variant="danger" onClick={exit}>
        Yes, exit mission
      </Button>
    </div>
  );
}
