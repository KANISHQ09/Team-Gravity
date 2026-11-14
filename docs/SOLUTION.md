# GRAVITY: Our Solution

> **Independent project created for the NASA Space Apps Challenge 2026; not a NASA product.**
> Challenge: *Space Mission Design Game* · Team Gravity · Repository: `KANISHQ09/Team-Gravity` (MIT)

This document describes the whole game we are building: what it is, how it plays, what is inside it, how it is built and why it matters. The team can use it as the single source for the presentation, the demo and the judging write-up.

---

## 1. In one sentence

**GRAVITY is a free browser game where one to four players design a real-style space mission from the science goal to the final report. Every part they add costs mass, power, money, data, communications or time, and the game explains in plain words why the mission succeeded or failed.**

## 2. The problem

- Real space missions succeed or fail because of **trade-offs**. A better camera brings more science, but it also adds mass, power use, data volume and cost.
- Most learning tools teach one piece at a time: orbits, rockets *or* subsystems. Students rarely see how the pieces affect each other.
- Students almost never get to **fail safely, understand why, and try again**, which is how engineers actually learn.
- Classrooms need something that runs in a browser on school devices, needs no accounts or installs, and still works on poor Wi-Fi.

## 3. Our solution

GRAVITY puts the **whole mission lifecycle in one short, repeatable loop**:

1. Pick a science need and choose goals.
2. Choose a mission concept (orbit and launch vehicle).
3. Turn goals into measurable requirements.
4. Build the spacecraft part by part while six live gauges react.
5. Pass a launch-readiness review with a risk matrix.
6. Vote GO/NO-GO, launch, and watch the mission fly through six phases.
7. Read a report that explains each cause and effect, compares the design to real NASA missions, and suggests what to try next.

The stages follow NASA's own mission process (from the *Design and Develop Science Missions* guidance), JPL's Concept Maturity Levels, and the way Goddard's Mission Design Lab splits a team into disciplines.

## 4. Who it is for

| Player | What GRAVITY gives them |
| --- | --- |
| Students aged 12–18 | Guided, visual and forgiving; plain language with a built-in glossary |
| University students and hobbyists | Realistic constraints, harder difficulty levels, replayable trade-offs |
| Teachers | No sign-up, no install, works offline after the first load, team play for a class |
| Hackathon judges | Clear science, honest data labels, a polished three-minute demo |

## 5. How a game plays

### 5.1 Start

The home screen offers three missions and three difficulty levels. Players can play **solo**, **hot-seat** (2–4 players on one device), or **online** in a room with friends.

### 5.2 The six stages

| # | Stage | What the player does | What they learn |
| --- | --- | --- | --- |
| 1 | **Need & Goals** | Read the mission story and pick which science goals to pursue | Every mission starts from a science question, not from hardware |
| 2 | **Concept** | Choose an orbit and a launch vehicle | The orbit decides what you can see, how much sunlight and contact you get, and how much the launch costs |
| 3 | **Requirements** | Each goal becomes a measurable requirement with a threshold and a baseline | Engineers design to numbers, not wishes |
| 4 | **Design** | Add a bus, solar arrays, batteries, antennas, a computer, attitude control, propulsion and instruments | Every part pushes at least one gauge; there is never one perfect design |
| 5 | **Build & Verify** | Check readiness items, see the 5×5 risk matrix, and fix red items. A "What matters most?" analysis ranks single changes by their effect on science | A mission only launches when it is ready; margins protect you from surprises |
| 6 | **Implement** | Every player votes GO or NO-GO (with a reason), then the team launches | Launch is a team decision |

### 5.3 The six resources (live gauges)

| Gauge | What fills it |
| --- | --- |
| **Mass** | Every part, plus propellant; limited by the launch vehicle |
| **Power** | Instruments and subsystems use it; solar arrays and batteries provide it (sunlight from the NASA solar constant, 1361 W/m²) |
| **Budget** | Part costs, launch cost and reserves, against the mission's budget |
| **Data** | Science data produced each day, against what the antennas and ground stations can download |
| **Communications** | Radio link margin over distance (3 dB required) |
| **Time** | Development months for the slowest parts, against the schedule |

Each gauge needs a **safety margin** that grows with difficulty: 10% (Explorer), 20% (Engineer) or 35% (Flight Director, the NASA/JPL policy). The colour, an icon and text all show the status, so colour is never the only signal.

### 5.4 Flight

The simulation flies the mission through **six phases**: development → launch → transfer → insertion → science operations → end of life. Random events can strike, such as a launch slip, budget cut, schedule overrun, launch failure, insertion error, solar particle event, battery degradation, reaction-wheel failure, antenna problem or instrument failure. Good design choices (margins, redundancy, radiation-hardened parts, schedule reserves) **soften** these events. The run is seeded, so the same design and seed always give the same result.

### 5.5 The 3D flight: you fly it

With the 3D view on, the flight becomes playable. Four mini-games appear at the real moments of the mission:

| Mini-game | When | What you do |
| --- | --- | --- |
| **Launch steering** | Liftoff | Keep the rocket's nose on the guidance line through the gravity turn and throttle down through Max-Q (peak aerodynamic pressure) |
| **Orbit insertion** | Arrival at the Moon or Mars (circularisation for Earth missions) | Time and hold the braking burn near the closest point; a live predicted path shows escape (orange) or capture (cyan), using real two-body orbital mechanics |
| **Science + downlink** | Science operations | Steer the instrument onto surface targets, capture them, and send data home while a ground station is in view before the recorder fills |
| **Anomaly response** | When the run has a solar storm, wheel failure, antenna fault, battery or instrument problem | Hold the tumbling craft steady with thrusters, or act in the right time window |

Each game scores 0–100 and together they give a **pilot rating** with a medal. It is shown next to, not inside, the mission score, so the mission result stays design-based, deterministic and server-checked. Players can always hand over to the autopilot (for fewer points), and the 2D view stays available for reduced motion or older devices.

### 5.6 The 3D spacecraft hangar

On the Design stage, the spacecraft you are building appears in 3D as you add parts: bus, solar wings, dishes, instruments, booms and engine. Click a part to inspect it, switch on X-ray to see batteries, the computer, spinning reaction wheels and fuel tanks, change camera views, and run a **deployment test** that unfolds the arrays, spins the wheels, sweeps the instruments and hot-fires the engine, then reports pass or fail for each system.

### 5.7 The mission report

- **Score out of 100**, made of:
  - Mission performance: 30
  - Science value: 25
  - Resource efficiency: 15
  - Decision quality: 15
  - Team collaboration: 15 (co-op only; in solo play these points are shared across the other categories)
- **Difficulty multiplier:** ×1 Explorer, ×1.15 Engineer, ×1.3 Flight Director.
- **Cause-and-effect statements**, for example: "Because you chose a lower orbit, the camera saw more detail, but the battery had to cover longer shadows."
- **Suggestions** for the next attempt.
- **Real NASA missions like yours.** The game picks the closest of nine real missions (Landsat 9, Terra, Van Allen Probes, ICESat-2, LRO, LADEE, MRO, MAVEN, Mars Global Surveyor) with a short summary and a link.
- **Trade space chart.** Every run of that mission is plotted as cost against science, with marker shape showing risk. Players can reload any earlier design to try again.
- **Leaderboard** (when online), with scores always recomputed by the server.

## 6. The three missions

| Mission | Destination | Budget | Development time | Mission length | Key challenge | Recommended level |
| --- | --- | --- | --- | --- | --- | --- |
| **CubeSat Earth Observer** | Low Earth orbit | 7 M$ | 18 months | 1 year | **Data:** getting images down through a tiny radio | Explorer |
| **Lunar Orbiter** | Moon | 300 M$ | 36 months | 1 year | **Mass:** carrying enough propellant to brake into lunar orbit | Engineer |
| **Mars Orbiter** | Mars | 650 M$ | 48 months | 1 Mars year (687 days) | **Communications:** talking across up to hundreds of millions of km | Flight Director |

Each mission has 3–4 weighted science goals (for example, mapping crops, finding water ice on the Moon, or searching for buried ice on Mars) and 4 allowed orbits.

## 7. What is inside the game

| Content | Count |
| --- | --- |
| Spacecraft parts (bus, solar, battery, antenna, computer, attitude control, propulsion, instruments) | 41 |
| Launch vehicles (rideshare up to super-heavy) | 5 |
| Orbits (Earth, Moon, Mars) | 13 |
| Random flight event types | 10 |
| Real NASA mission analogs | 9 |
| Glossary terms | 20 |
| Difficulty levels | 3 |

**Honest numbers.** Every value in the game carries a label: `NASA` (taken from a NASA source), `NASA/GMAT` (calculated with NASA's GMAT tool), `DERIVED` (calculated from NASA values) or `GAME` (simplified for play). All sources are listed with their licence terms in [DATA_LEDGER.md](DATA_LEDGER.md).

## 8. Playing together

GRAVITY works like a real mission team. There are four roles, based on NASA Goddard's Mission Design Lab:

| Role | Owns |
| --- | --- |
| **Mission Architect** | Science goals, orbit and launch vehicle |
| **Spacecraft Engineer** | Bus, computer, attitude control and propulsion |
| **Science Lead** | Science instruments |
| **Operations & Resources** | Solar arrays, batteries, antennas, ground stations and risk reserves |

- With 1–3 players, the roles are shared out automatically.
- A player can change only the parts their role owns. To touch another area, they send a **proposal**, which the owner accepts or rejects.
- Before launch, **every player votes GO or NO-GO**. A NO-GO needs one of four fixed reasons, such as "Margins are too thin".
- **Online rooms:** the host creates a room and shares a 6-character code. Up to four friends join, claim roles, and see every change live. The server checks every change with the same engine and recomputes every score, so nobody can cheat.
- **Safe for young players:** guest play needs no name, e-mail or account, and there is no free-text chat.

## 9. Built for every learner

- **Accessible:**
  - works with a keyboard;
  - controls are labelled for screen readers;
  - status never depends on colour alone;
  - respects "reduce motion";
  - target is WCAG 2.2 AA, and automated axe-core checks run on every screen.
- **Plain language:** the game explains the *why*, and a glossary covers terms like Δv, link margin and TRL.
- **Works offline:** after the first visit it is an installable app (PWA), so solo and hot-seat play need no internet.
- **Light on devices:** it runs in the browser on school laptops, tablets and phones, and the simulation runs in a background thread so the screen stays smooth.
- **Replayable:** three difficulties, random events and the trade-space chart reward trying again.

## 10. How it is built

```
Browser (React app, works offline) ──► Game engine (pure TypeScript, also in a Web Worker)
        │                                        ▲
        │ HTTPS + WebSocket (online play only)   │ same engine
        ▼                                        │
Game server (Fastify + Socket.IO) ───────────────┘
        │
        ├── PostgreSQL (scores, leaderboards)
        └── Redis (room presence, rate limits)
```

| Part | What it does | Technology |
| --- | --- | --- |
| `packages/engine` | All game rules: budgets, readiness, risk, simulation, scoring, explanations, sensitivity. Pure and deterministic, with no network, clock or unseeded randomness | TypeScript |
| `packages/catalog` | All game numbers as JSON data with provenance labels, validated at load | JSON + Zod |
| `packages/shared` | Contracts shared by web and server: design edits, roles, API and socket message schemas | TypeScript + Zod |
| `apps/web` | The game UI, 3D hangar and 3D flight with mini-games | React 18, Vite, Tailwind CSS, Zustand, Three.js (react-three-fiber), Socket.IO client, PWA (Workbox) |
| `apps/server` | Guest sessions, server-side scoring, leaderboards, co-op rooms | Node 22, Fastify 5, Socket.IO, Drizzle ORM, PostgreSQL 16, Redis 7 |

**Key decisions:**

- **One engine everywhere.** The browser and the server run exactly the same rules, so solo play needs no backend and online play is still cheat-proof.
- **Data, not code.** Game balance lives in JSON files that designers can edit without touching the code.
- **Solo never depends on the server.** If the backend is down, the game still plays.

## 11. Quality

- **Automated tests** cover every package: engine rules, catalog validation, shared contracts, server routes and rooms (including a real PostgreSQL test), and web screens, online sync and accessibility.
- **Balance is tested:**
  - each mission has three reference designs that must each score at least 85;
  - every mission must be winnable at every difficulty.
- **Property-based tests** (fast-check) check that the engine is deterministic and that results always stay within valid ranges.
- **CI** runs these on every pull request: lint, type-check, tests, build, a dependency audit and CodeQL security analysis. The `main` branch is protected.
- **Security:**
  - every input is validated (Zod);
  - errors follow RFC 9457;
  - rate limiting is on;
  - guest JWT sessions;
  - no secrets in the code.

## 12. NASA resources we used

| Resource | How we used it |
| --- | --- |
| NASA, *Design and Develop Science Missions* | The six-stage flow, four mission segments, verification ideas |
| JPL, *Concept Maturity Levels* (Wessen et al., 2013, CC0) | Difficulty tiers, readiness checklist, 35% margin policy, 5×5 risk matrix |
| NASA Goddard *Mission Design Lab* | The four co-op roles and the team design process |
| NASA CSLI *CubeSat 101* | The CubeSat mission and beginner wording |
| NASA *GMAT* (Apache-2.0) | Δv and transfer-time references |
| NASA Webb *Build It Yourself* game | Objective-first flow and "disabled options with reasons" |
| NASA Science mission pages | The nine real-mission comparisons in the report |
| NASA NSSDCA *Earth Fact Sheet* | Solar constant for power calculations |

We use concepts and facts in our own words. We do not copy NASA images or logos, and we do not claim NASA endorsement.

## 13. What makes GRAVITY different

1. **Whole mission, one loop.** It covers goals, design, launch, flight and report together, not one topic at a time.
2. **Every choice has a consequence** across six resources, and there is never a single right answer.
3. **It explains failure.** Cause-and-effect statements turn a lost mission into a lesson.
4. **Real process, real roles.** It follows NASA's mission stages and Mission Design Lab teamwork, with a GO/NO-GO vote.
5. **Honest data.** Every number shows where it came from.
6. **For every classroom.** It is free, needs no accounts, works offline, is accessible and is safe for minors.

## 14. Three-minute demo

1. **(0:00)** Home screen: three missions, three difficulties, solo or online.
2. **(0:20)** CubeSat Earth Observer, Explorer level: pick goals and a sun-synchronous orbit with a rideshare launch.
3. **(0:50)** Design stage: with the UHF antenna, add the two cameras and watch the Communications gauge turn red (more data than the radio can send). Add the S-band patch antenna and watch it recover; the 3D hangar builds the CubeSat as you go.
4. **(1:30)** Build & Verify: the readiness checklist and risk matrix, then "What matters most?" ranks the next change.
5. **(1:50)** GO vote, launch, and the mission flies through its six phases, with an event that a margin softens.
6. **(2:20)** Report: score breakdown, "because you chose…" statements, the closest real NASA mission, and the trade-space chart after a second run.
7. **(2:45)** Online: a room code joined from a second device shows a live change and a proposal being accepted.

## 15. What's next

- Reconnecting to an online room after a dropped connection, and sharing rooms across several servers.
- More languages (i18n), starting with Hindi and Italian.
- More GMAT-calculated trajectory data in the 3D flight.
- A teacher dashboard and class leaderboards.
- More destinations and a scenario editor.
- End-to-end browser tests and public deployment.

*GRAVITY is an independent project created for the NASA Space Apps Challenge 2026; it is not a NASA product and is not endorsed by NASA.*
