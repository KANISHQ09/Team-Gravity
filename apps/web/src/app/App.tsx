import { ENGINE_API_VERSION } from '@gravity/engine';

/**
 * Placeholder shell proving the toolchain works end to end
 * (React + Tailwind + workspace import of @gravity/engine).
 * Replaced by the real app shell in Phase 8.
 */
export function App() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 p-6 text-center text-slate-100">
      <h1 className="text-4xl font-bold tracking-widest">GRAVITY</h1>
      <p className="max-w-md text-slate-300">Space Mission Design Game: under construction.</p>
      <p className="text-xs text-slate-400">Engine API v{ENGINE_API_VERSION}</p>
      <footer className="mt-8 max-w-md text-xs text-slate-400">
        Independent project created for the NASA Space Apps Challenge; not a NASA product.
      </footer>
    </main>
  );
}
