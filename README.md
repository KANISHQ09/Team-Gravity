<div align="center">

# 🚀 GRAVITY — Space Mission Design Game

**Design a real space mission. Build the spacecraft in 3D. Fly it yourself. Find out _why_ it worked.**

[![Play now](https://img.shields.io/badge/▶_Play_now-team--gravity.vercel.app-f97316?style=for-the-badge)](https://team-gravity.vercel.app/)
[![CI](https://github.com/KANISHQ09/Team-Gravity/actions/workflows/ci.yml/badge.svg)](https://github.com/KANISHQ09/Team-Gravity/actions/workflows/ci.yml)
[![CodeQL](https://github.com/KANISHQ09/Team-Gravity/actions/workflows/codeql.yml/badge.svg)](https://github.com/KANISHQ09/Team-Gravity/actions/workflows/codeql.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

<img src="docs/screenshots/01-landing.jpg" alt="GRAVITY landing page: a full-screen space video behind the GRAVITY title, with Start a mission and Play with friends buttons" width="820">

*Built for the NASA Space Apps Challenge 2026 — Space Mission Design Game.*
*Independent project created for the NASA Space Apps Challenge; not a NASA product.*

</div>

---

## Contents

- [What is GRAVITY?](#what-is-gravity)
- [See it in action](#see-it-in-action)
- [How to play](#how-to-play)
- [Features](#features)
- [Tech stack and architecture](#tech-stack-and-architecture)
- [Run it locally](#run-it-locally)
- [Deploy](#deploy-the-web-app-vercel-static)
- [Project docs](#project-docs)
- [License and credits](#license-and-credits)

## What is GRAVITY?

GRAVITY is a free browser game where you plan a real-style space mission from the science question to the final report, the way NASA teams do:

1. **Pick the science**: what do you want to learn about Earth, the Moon or Mars?
2. **Design the spacecraft** part by part in a **3D hangar**, while six live gauges react: **mass, power, budget, data, communications and time**.
3. **Pass the launch-readiness review**, vote GO, and **fly the mission in 3D**, steering the launch, timing the orbit-insertion burn, aiming instruments and reacting to emergencies.
4. **Read a report** that explains, cause by cause, *why* the mission succeeded or failed, and compares it with real NASA missions.

There is never a single perfect design: every part you add costs something. That trade-off is the game.

## See it in action

### Choose a mission

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/02-missions.jpg" alt="Three mission cards with real NASA photos of Earth, the Moon and Mars"></td>
    <td width="50%"><img src="docs/screenshots/03-mission-screen.jpg" alt="Mars Orbiter mission screen with planet header, readiness ring, stage stepper and resource gauges"></td>
  </tr>
  <tr>
    <td><b>Three missions</b>: a CubeSat around Earth, a Lunar Orbiter and a Mars Orbiter, each at three difficulty levels.</td>
    <td><b>Six NASA-style stages</b> with a readiness ring, a stage stepper that ticks off finished work, and six live resource gauges.</td>
  </tr>
</table>

### Build it in the 3D hangar

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/05-hangar-3d.jpg" alt="3D spacecraft in the hangar: gold-foil bus, two solar wings and a dish antenna, Mars in the background"></td>
    <td width="50%"><img src="docs/screenshots/06-deployment-test.jpg" alt="Deployment test: instrument beams sweep and the ion engine fires"></td>
  </tr>
  <tr>
    <td><b>Your real design in 3D</b>: every part you add appears on the spacecraft. Rotate it, click parts to inspect them, or switch to X-ray.</td>
    <td><b>Deployment test</b>: unfold the solar wings, spin the reaction wheels, sweep the instruments and hot-fire the engine, then get a pass/fail checklist.</td>
  </tr>
</table>

### Stuck? Analyse and auto-fix

<img src="docs/screenshots/04-auto-fix.jpg" alt="Design analysis panel: Ready to launch after Auto-fix made 18 explained changes" width="760">

**Analyse my design** lists every problem with its fix. **Auto-fix my design** repairs the design step by step and explains every change ("Add the High-gain dish antenna, which fixes: missing an antenna"). **Go to launch** jumps straight to the GO vote.

### Fly the mission yourself

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/07-launch.jpg" alt="Launch mini-game: a rocket climbs over Earth's horizon with altitude, speed, throttle and Max-Q gauges"></td>
    <td width="50%"><img src="docs/screenshots/08-orbit-insertion.jpg" alt="Orbit insertion at Mars: an orange escape path, the green target orbit and the burn HUD"></td>
  </tr>
  <tr>
    <td><b>1. Launch steering</b>: keep the nose on the guidance line and throttle down through Max-Q.</td>
    <td><b>2. Orbit insertion</b>: time the braking burn with real two-body orbital mechanics. Orange means escape, cyan means captured.</td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/10-science-pass.jpg" alt="Science pass over Mars: glowing targets, the instrument beam and steer, capture and send-data buttons"></td>
    <td><img src="docs/screenshots/11-anomaly.jpg" alt="Anomaly mini-game: hold the pointing error inside the circle after the antenna lost lock"></td>
  </tr>
  <tr>
    <td><b>3. Science pass</b>: aim the instrument at surface targets and send data home before the recorder fills.</td>
    <td><b>4. Anomalies</b>: solar storms, wheel failures and antenna faults from your actual mission. React in time.</td>
  </tr>
</table>

<img src="docs/screenshots/09-in-orbit-mars.jpg" alt="The spacecraft in orbit above Mars, scanning the surface" width="620">

Your piloting earns a separate **pilot rating** and medal. The mission score stays based on your design, so it is fair and reproducible.

### Learn why

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/12-report.jpg" alt="Mission report: 100 out of 100, score breakdown, trajectory replay, science over time and pilot rating"></td>
    <td width="50%"><img src="docs/screenshots/13-glossary.jpg" alt="Glossary page with search box, topic filters and term cards"></td>
  </tr>
  <tr>
    <td><b>The report</b>: a 0–100 score in five parts, "because you chose…" explanations, similar real NASA missions, a trade-space chart and your pilot rating.</td>
    <td><b>Glossary</b>: 20 mission words in plain language, searchable and grouped by topic.</td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/14-about.jpg" alt="About page with the Apollo 17 Earth photo, disclaimer and what makes GRAVITY different"></td>
    <td align="center"><img src="docs/screenshots/15-phone.jpg" alt="GRAVITY on a phone with the hamburger menu button" width="220"></td>
  </tr>
  <tr>
    <td><b>About</b>: how the game follows NASA's process, where every number comes from, and credits.</td>
    <td><b>Works on phones</b>, with a hamburger menu, and <b>offline</b> after the first visit.</td>
  </tr>
</table>

## How to play

| Step | You do | You learn |
| --- | --- | --- |
| 1. Need & Goals | Pick the science goals | Missions start from a question, not hardware |
| 2. Concept | Choose an orbit and a rocket | The orbit decides what you see and what the launch costs |
| 3. Requirements | Read the measurable targets | Engineers design to numbers |
| 4. Design | Build the spacecraft in the 3D hangar | Every part pushes on at least one resource |
| 5. Build & Verify | Pass the readiness review, check risks | Margins protect you from surprises |
| 6. Implement | Vote GO, launch, fly the mini-games | Launch is a team decision; flying takes skill |

**Difficulty levels:** **Explorer** (10% margins, hints, simple parts), **Engineer** (20% margins, all parts) and **Flight Director** (35% margins, every high risk must be mitigated, more surprises, ×1.3 score).

Step-by-step walkthrough and demo script: [docs/SOLUTION.md](docs/SOLUTION.md).

## Features

| Area | What you get |
| --- | --- |
| Missions | 3 missions (CubeSat Earth Observer, Lunar Orbiter, Mars Orbiter) × 3 difficulty levels |
| Design | 41 parts, 5 launch vehicles, 13 orbits, a Master Equipment List and six live resource gauges with target markers |
| 3D hangar | Procedural spacecraft built from your parts, part inspector, X-ray view, camera presets and a deployment test |
| Analyse + auto-fix | Every problem with its fix; one-click repair that explains each change; shortcut to launch |
| Readiness | NASA/JPL-style review (≥ 80% green, critical items green) and a 5×5 risk matrix |
| 3D flight | Launch, separation, cruise and orbit with procedural Earth, Moon and Mars (clouds, city lights, craters, polar caps) |
| Mini-games | Launch steering, orbit insertion, science + downlink, anomaly response; keyboard, touch and autopilot |
| Simulation | Deterministic six-phase simulation with random events that your design choices soften |
| Report | 0–100 score, cause-and-effect explanations, "try changing…" suggestions, real NASA analog missions, trade-space chart |
| Learning | Explorer hints, glossary, "why does this matter?" on every part, and every number labelled `NASA` / `DERIVED` / `GAME` |
| Accessibility | Keyboard play, labelled controls, status never by colour alone, reduced-motion 2D fallback, automated axe-core checks |
| Everywhere | Phone layout with hamburger menu, installable app, works offline after the first visit |
| Team play | **Coming soon** to the public site: online rooms (room codes, four roles, live sync, proposals, GO/NO-GO) are built and tested with the local server |

Full list and roadmap: [docs/FEATURES.md](docs/FEATURES.md), [docs/ROADMAP.md](docs/ROADMAP.md).

## Tech stack and architecture

**TypeScript monorepo** (pnpm + Turborepo) · **Web:** React 18, Vite, Tailwind CSS, Zustand, Three.js via react-three-fiber + drei (lazy-loaded), vite-plugin-pwa · **Server:** Node.js 22, Fastify, Socket.IO, PostgreSQL 16 + Drizzle, Redis · **Quality:** Vitest, fast-check, Testing Library, axe-core, ESLint, Prettier, GitHub Actions + CodeQL.

```mermaid
flowchart LR
  WEB["apps/web<br/>React + 3D (Three.js)<br/>runs the engine in the browser"] <-->|"REST + WebSocket<br/>(team play)"| SRV["apps/server<br/>Fastify + Socket.IO<br/>re-checks every move"]
  SRV --> PG[("PostgreSQL")]
  SRV --> RD[("Redis")]
  WEB --> ENG["packages/engine<br/>pure, deterministic game rules"]
  SRV --> ENG
  ENG --> CAT["packages/catalog<br/>game data with provenance labels"]
```

- **One engine everywhere:** the browser and the server run exactly the same rules, so solo play needs no server and team play stays cheat-proof.
- **Data, not code:** every game number lives in JSON with a `NASA` / `DERIVED` / `GAME` label.
- **Tested balance:** automated tests prove every mission is winnable at every difficulty, and that auto-fix reaches a launchable design for every mission.

More: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · [docs/TECH_STACK.md](docs/TECH_STACK.md).

## Run it locally

**Prerequisites:** Node.js 22 LTS (22.12+, see `.nvmrc`), pnpm 12.17.0 (`corepack enable`, or prefix commands with `npx pnpm@12.17.0`), Git. Docker Desktop only if you want the server's Postgres and Redis ([docs/DOCKER_SETUP.md](docs/DOCKER_SETUP.md)).

```bash
pnpm install
pnpm --filter @gravity/web dev        # just the game: http://localhost:5173
```

Full stack (game server, team play, leaderboard):

```bash
cp .env.example .env                  # defaults work for local dev
pnpm services:up                      # PostgreSQL + Redis in Docker
pnpm --filter @gravity/server db:migrate
pnpm dev                              # web :5173 + server :3000
```

| Command | What it does |
| --- | --- |
| `pnpm dev` | Web app and server together (if 5173 is busy: `pnpm --filter @gravity/web dev --port 5174`) |
| `pnpm build` | Production build of the web app and server |
| `pnpm test` | All Vitest suites |
| `pnpm typecheck` | Strict TypeScript check of every package |
| `pnpm lint` / `pnpm format` | ESLint (with accessibility and engine-purity rules) / Prettier |
| `pnpm check` | Everything CI runs: lint, format, typecheck, tests and build |
| `pnpm services:down` | Stop the local database and Redis |

The server also runs without Postgres or Redis (scores are kept in memory). Variables are documented in [`.env.example`](.env.example); never commit a real `.env`. To run the Postgres and Redis integration tests: `TEST_DATABASE_URL=postgres://gravity:gravity@localhost:5432/gravity TEST_REDIS_URL=redis://localhost:6379/15 pnpm --filter @gravity/server test`.

## Deploy the web app (Vercel, static)

Solo play, the 3D hangar and the 3D flight run entirely in the browser, so the web app is hosted as static files (`apps/web/vercel.json`).

1. On [vercel.com](https://vercel.com), **Add New → Project** and import this repository.
2. Set **Root Directory** to `apps/web`; Vercel reads the install and build commands from `vercel.json`.
3. Set the Node.js version to **22.x**.
4. Leave `VITE_API_URL` unset: team play then shows "Coming soon" and the leaderboard is hidden.
5. **Deploy.** Each push to `main` updates the live site; each pull request gets a preview link.

## Project docs

| Doc | What's in it |
| --- | --- |
| [docs/SOLUTION.md](docs/SOLUTION.md) | The whole game explained, with a 3-minute demo script |
| [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) | What the game must do |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How the pieces fit together |
| [docs/API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md) | REST endpoints and socket events |
| [docs/DATA_LEDGER.md](docs/DATA_LEDGER.md) | Every data source and media credit, with licence terms |
| [docs/FOLDER_STRUCTURE.md](docs/FOLDER_STRUCTURE.md) | Where everything lives (every folder also has a README) |
| [CONTRIBUTING.md](CONTRIBUTING.md) · [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) · [SECURITY.md](SECURITY.md) | How to contribute and report issues |

## License and credits

Code: [MIT License](LICENSE). Third-party data and media keep their own terms; every source is listed in the [data ledger](docs/DATA_LEDGER.md).

- Mission-card planet photos: **Earth** NASA / Apollo 17 (AS17-148-22727), **Moon** NASA/JPL / Galileo (PIA00405), **Mars** NASA/JPL / Viking (PIA00407), all public domain.
- Landing-page background video: AI-generated by the team (not NASA footage).
- 3D planets, spacecraft and rockets: drawn in code by the team.
- Mission-design concepts come from the NASA and partner resources provided for the challenge ([docs/RESOURCE_PLAN.md](docs/RESOURCE_PLAN.md)).

Built by **Team Gravity** for the NASA Space Apps Challenge 2026. *Independent project; not a NASA product. NASA does not endorse this project.*
