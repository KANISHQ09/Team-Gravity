# Pilot mini-games

Playable phases of the 3D flight: launch steering, orbit insertion, science + downlink and anomaly response.

- Game rules are pure TypeScript (`*Game.ts`) and unit-tested in `pilot.test.ts`; `flightSim.ts` steps them from the 3D scene's render loop.
- Scores feed a separate **pilot rating** (`pilotScore.ts`). The mission score stays design-based, deterministic and server-checked.
- Every game has keyboard controls, on-screen hold buttons and an autopilot option.

See [docs/FOLDER_STRUCTURE.md](../../../../../docs/FOLDER_STRUCTURE.md).
