import { catalog } from '@gravity/engine';

export function Glossary() {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">Glossary</h2>
      <dl className="grid gap-3 md:grid-cols-2">
        {catalog.glossary.map((g) => (
          <div key={g.term} className="rounded-md border border-slate-700 bg-slate-900 p-3">
            <dt className="font-semibold">{g.term}</dt>
            <dd className="mt-1 text-sm text-slate-300">{g.definition}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
