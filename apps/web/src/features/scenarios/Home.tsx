import { useState } from 'react';
import { catalog } from '@gravity/engine';
import type { Difficulty } from '@gravity/shared';
import { Button, Card } from '../../components/ui.tsx';
import { DIFFICULTY_LABEL, bodyName, fmt } from '../../lib/format.ts';
import { decodeDesign, useGame } from '../../store/game.ts';

const DIFFICULTY_HELP: Record<Difficulty, string> = {
  explorer: 'Simple parts, hints on, 10% margins. Like a first sketch of a mission (CML 1–2).',
  engineer: 'All parts, 20% margins and trade-offs between designs (CML 3).',
  'flight-director': '35% margins, strict readiness review, more surprises (CML 4).',
};

export function Home() {
  const start = useGame((s) => s.startMission);
  const loadDesign = useGame((s) => s.loadDesign);
  const saved = useGame((s) => s.design);
  const go = useGame((s) => s.go);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-3xl font-bold tracking-widest">GRAVITY</h1>
        <p className="max-w-2xl text-slate-300">
          Design a real space mission: choose the science, build the spacecraft, pick a rocket and
          an orbit, balance mass, power, money, data, communications and time, then launch and find
          out <em>why</em> it worked or failed.
        </p>
        {saved && (
          <Button variant="secondary" onClick={() => go('mission')}>
            Continue your saved mission
          </Button>
        )}
      </section>

      <section aria-labelledby="scenarios-heading" className="space-y-4">
        <h2 id="scenarios-heading" className="text-xl font-semibold">
          Choose a mission
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {catalog.scenarios.map((s) => (
            <ScenarioCard key={s.id} scenarioId={s.id} onStart={start} />
          ))}
        </div>
      </section>

      <section aria-labelledby="share-heading" className="max-w-xl space-y-2">
        <h2 id="share-heading" className="text-lg font-semibold">
          Load a shared design
        </h2>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const d = decodeDesign(code.trim());
            if (d) loadDesign(d);
            else setCodeError('That code is not a valid GRAVITY design.');
          }}
        >
          <label htmlFor="design-code" className="sr-only">
            Design code
          </label>
          <input
            id="design-code"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setCodeError(null);
            }}
            placeholder="Paste a design code"
            className="min-w-0 flex-1 rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
            aria-describedby={codeError ? 'design-code-error' : undefined}
          />
          <Button type="submit" variant="secondary" disabled={!code.trim()}>
            Load
          </Button>
        </form>
        {codeError && (
          <p id="design-code-error" role="alert" className="text-sm text-rose-300">
            {codeError}
          </p>
        )}
      </section>
    </div>
  );
}

function ScenarioCard({
  scenarioId,
  onStart,
}: {
  scenarioId: string;
  onStart: (scenarioId: string, difficulty: Difficulty, players: number) => void;
}) {
  const s = catalog.scenarios.find((x) => x.id === scenarioId)!;
  const [difficulty, setDifficulty] = useState<Difficulty>(s.recommendedDifficulty);
  const [players, setPlayers] = useState(1);
  const idBase = `scn-${s.id}`;
  return (
    <Card className="flex flex-col gap-3">
      <h3 className="text-lg font-semibold">{s.name}</h3>
      <p className="text-sm text-slate-300">{s.summary}</p>
      <dl className="grid grid-cols-2 gap-x-2 text-xs text-slate-400">
        <dt>Target</dt>
        <dd className="capitalize">{bodyName(s.body)}</dd>
        <dt>Budget</dt>
        <dd>{fmt(s.budgetM)} M$</dd>
        <dt>Science operations</dt>
        <dd>{s.missionDays} days</dd>
        <dt>Critical resource</dt>
        <dd className="capitalize">{s.criticalResource}</dd>
      </dl>
      <div className="mt-auto space-y-2">
        <label htmlFor={`${idBase}-difficulty`} className="block text-sm font-medium">
          Difficulty
        </label>
        <select
          id={`${idBase}-difficulty`}
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value as Difficulty)}
          className="w-full rounded-md border border-slate-600 bg-slate-900 px-2 py-1.5 text-sm"
          aria-describedby={`${idBase}-difficulty-help`}
        >
          {(Object.keys(DIFFICULTY_LABEL) as Difficulty[]).map((d) => (
            <option key={d} value={d}>
              {DIFFICULTY_LABEL[d]}
              {d === s.recommendedDifficulty ? ' (recommended)' : ''}
            </option>
          ))}
        </select>
        <p id={`${idBase}-difficulty-help`} className="text-xs text-slate-400">
          {DIFFICULTY_HELP[difficulty]}
        </p>
        <label htmlFor={`${idBase}-players`} className="block text-sm font-medium">
          Players on this device
        </label>
        <select
          id={`${idBase}-players`}
          value={players}
          onChange={(e) => setPlayers(Number(e.target.value))}
          className="w-full rounded-md border border-slate-600 bg-slate-900 px-2 py-1.5 text-sm"
        >
          <option value={1}>1: solo</option>
          <option value={2}>2: team, take turns</option>
          <option value={3}>3: team, take turns</option>
          <option value={4}>4: team, one role each</option>
        </select>
        <Button
          variant="primary"
          className="w-full"
          onClick={() => onStart(s.id, difficulty, players)}
        >
          Start {s.name}
        </Button>
      </div>
    </Card>
  );
}
