import { useState } from 'react';
import { catalog } from '@gravity/engine';
import type { Difficulty } from '@gravity/shared';
import { Button, Card } from '../../components/ui.tsx';
import { onlineConfigured } from '../../lib/api.ts';
import { DIFFICULTY_LABEL } from '../../lib/format.ts';
import { hostRoom, joinRoom } from '../../lib/realtime.ts';
import { useOnline } from '../../store/online.ts';

/** Home-screen panel: create an online room or join one by code (FR-13). */
export function OnlineLobby() {
  const status = useOnline((s) => s.status);
  const error = useOnline((s) => s.error);
  const [scenarioId, setScenarioId] = useState(catalog.scenarios[1]!.id);
  const [difficulty, setDifficulty] = useState<Difficulty>('engineer');
  const [code, setCode] = useState('');

  if (!onlineConfigured) {
    return (
      <p className="text-sm text-slate-400">
        Online rooms are available when the game server is running (set <code>VITE_API_URL</code>).
        Hot-seat team play on one device always works.
      </p>
    );
  }
  const busy = status === 'connecting';
  const validCode = /^[A-HJ-NP-Z2-9]{6}$/.test(code.trim().toUpperCase());

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="space-y-2">
        <h3 className="font-semibold">Host a room</h3>
        <p className="text-sm text-slate-400">
          Up to four players on their own devices. Share the 6-letter code.
        </p>
        <label htmlFor="online-scenario" className="block text-sm">
          Mission
        </label>
        <select
          id="online-scenario"
          value={scenarioId}
          onChange={(e) => setScenarioId(e.target.value)}
          className="w-full rounded-md border border-slate-600 bg-slate-900 px-2 py-1.5 text-sm"
        >
          {catalog.scenarios.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <label htmlFor="online-difficulty" className="block text-sm">
          Difficulty
        </label>
        <select
          id="online-difficulty"
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value as Difficulty)}
          className="w-full rounded-md border border-slate-600 bg-slate-900 px-2 py-1.5 text-sm"
        >
          {(Object.keys(DIFFICULTY_LABEL) as Difficulty[]).map((d) => (
            <option key={d} value={d}>
              {DIFFICULTY_LABEL[d]}
            </option>
          ))}
        </select>
        <Button
          variant="primary"
          disabled={busy}
          onClick={() => void hostRoom(scenarioId, difficulty)}
        >
          {busy ? 'Connecting…' : 'Create room'}
        </Button>
      </Card>
      <Card className="space-y-2">
        <h3 className="font-semibold">Join a room</h3>
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (validCode) void joinRoom(code);
          }}
        >
          <label htmlFor="room-code" className="block text-sm">
            Room code
          </label>
          <input
            id="room-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={6}
            autoComplete="off"
            placeholder="e.g. K7QX2M"
            className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 font-mono tracking-widest uppercase"
          />
          <Button type="submit" disabled={busy || !validCode}>
            Join room
          </Button>
        </form>
      </Card>
      {error && (
        <p role="alert" className="text-sm text-rose-300 md:col-span-2">
          Could not connect: {error}
        </p>
      )}
    </div>
  );
}
