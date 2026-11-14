# GRAVITY — Requirements

> Status: **Draft for team review**. This is the condensed, prioritized list. The full specification (with IDs such as `SRS-SIM-04`) is Document 2 of [`resources/Gravity.md`](../resources/Gravity.md); where the two differ, update both.
>
> Priorities: **Must** = MVP, **Should** = MVP if time allows, **Could** = after the hackathon. Keywords MUST / SHOULD / MAY follow RFC 2119.

## 1. Challenge traceability

Each challenge objective (from `challenge.docx`) maps to the requirements that cover it.

| Challenge asks for | Covered by |
| --- | --- |
| Define a mission objective before engineering decisions | FR-01, FR-02 |
| Design spacecraft and choose instruments | FR-04 |
| Choose launch vehicle and orbit, with compatibility checks | FR-05 |
| Manage budget, mass, power, communications, data, lifetime | FR-06 |
| Simulate the mission and evaluate performance | FR-08, FR-09, FR-10 |
| Play solo or in teams of up to four, with roles | FR-12, FR-13 |
| Accessible to all knowledge levels; explain *why* | FR-15, NFR-ACC |
| Optional extras: random events, difficulty levels, leaderboards, sandbox, save/share, competitive mode | FR-09, FR-03, FR-17, FR-16, FR-14, FR-18 |

## 2. Functional requirements

### Mission definition

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-01 | The player MUST pick a scenario (3 at MVP) and a difficulty level. | Must |
| FR-02 | The player MUST select science goals **before** component selection unlocks. A Science Traceability Matrix (goal → measurement → instrument → requirement) MUST fill in live as the design changes. | Must |
| FR-03 | Difficulty levels: **Explorer** (requirements auto-filled, hints on, margin warning below 10%), **Engineer** (player edits requirements, 20% margin target, trade-space chart), **Flight Director** (35% margins, link-margin rules, 5×5 risk matrix, more random events). | Must |
| FR-03a | Each scenario MUST define a **Baseline** (full success) and a **Threshold** (partial success) science level. | Must |

### Design

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-04 | The design studio MUST offer: structure/bus, power (solar arrays, batteries), communications, onboard computer, attitude control, propulsion and instruments. Each item has mass, power, cost, data rate, science value and reliability. | Must |
| FR-04a | Options that conflict with earlier choices MUST be shown disabled, with the reason visible. | Must |
| FR-04b | Requirements MUST be measurable, and each MUST name a verification method (test, analysis, inspection or demonstration). | Must |
| FR-04c | A Master Equipment List view MUST list every item with its mass, power, cost and margin contribution. | Must |
| FR-04d | Items MUST be grouped by the four mission segments: launch, space, ground, user. | Must |
| FR-05 | At least 4 launch vehicles and 4 orbits per scenario MUST be offered, with plain-language explanations. Launch MUST be blocked when mass exceeds launch capacity or Δv falls short, and the message MUST state the exact shortfall (e.g. "Over by 42 kg"). | Must |

### Resources

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-06 | Six live gauges (mass, power, budget, data, communications, time) MUST update within 100 ms of any change, each showing used, limit, margin % and status. | Must |
| FR-06a | Each scenario MUST highlight its critical resource (e.g. communications for Mars). | Must |

### Readiness and simulation

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-07 | A readiness checklist (green/yellow/red) MUST gate launch: at least 80% green **and** every critical item green. The engine computes it, and every red item explains its fix. | Must |
| FR-08 | Simulation phases MUST be: Development → Launch → Transfer → Orbit Insertion → Science Operations → End of Life. | Must |
| FR-09 | At least 6 random event types (solar particle event, reaction-wheel failure, launch slip, budget cut, antenna anomaly, battery degradation). Each one is softened or made worse by specific design choices. | Must |
| FR-09a | The same design, scenario, difficulty and seed MUST always give the same result. | Must |
| FR-09b | A live dashboard with pause and 1× / 5× / 20× speed. | Should |
| FR-09c | One in-flight decision point per run (e.g. spend fuel for extra science, or keep the margin). | Should |

### Scoring and report

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-10 | Score 0–100: mission performance 30, science value 25, resource efficiency 15, decision quality 15, team collaboration 15 (in solo play, collaboration's 15 points are redistributed across the others). Difficulty multipliers: ×1.0 / ×1.15 / ×1.3. | Must |
| FR-11 | The report MUST show the outcome (Full / Partial / Failure), a timeline, resources used vs. limits, the score breakdown, **at least 3 cause-and-effect statements**, and "Try changing…" suggestions. | Must |
| FR-11a | The report SHOULD list at least 2 real NASA missions similar to the player's design, with source links. | Should |
| FR-11b | Balance check: at least 3 materially different designs MUST be able to score 85 or more in each scenario. | Must |

### Collaboration

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-12 | Solo mode MUST work fully in the browser, offline after the first load. | Must |
| FR-13 | Co-op: 2–4 players join a room with a 6-character code. Roles are Mission Architect, Spacecraft Engineer, Science Lead and Operations & Resources. The server enforces that players edit only their own role's parts; edits to others' parts become proposals the owner accepts or rejects. Launch needs a GO from every player, and a NO-GO must give a reason. | Must |
| FR-13a | Fallback if real-time rooms slip: **hot-seat co-op** on one device, with the same roles and vote. | Must (fallback) |
| FR-13b | Players see each other's changes within 300 ms; a disconnected player can rejoin within 2 minutes. | Should |

### Persistence, sharing, education

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-14 | Autosave locally; export and import a design as a shareable code or URL. | Should |
| FR-15 | Guided tutorial (objective → mass → power → launch → orbit → data/comms), a glossary reachable from every screen, and a "why does this matter?" tooltip on every item. | Must |
| FR-15a | Every warning explains **why** it matters and **how** to fix it. | Must |
| FR-16 | Sandbox mode (relaxed limits, any part). | Should |
| FR-17 | Leaderboard per scenario and difficulty; the server recomputes every submitted score. | Should |
| FR-18 | Competitive mode (two teams, same scenario and seed). | Could |
| FR-19 | Trade-space chart (cost vs. science across saved designs) and a sensitivity view. | Should |
| FR-20 | Mission Replay: a 2D animation of trajectory and timeline (3D optional). | Must (2D) / Could (3D) |
| FR-21 | Static facts panel with source-labeled facts (distances, solar flux). | Should |

## 3. Non-functional requirements

| ID | Area | Target |
| --- | --- | --- |
| NFR-PERF | Performance | First load under 3 s on 4G (critical JS under 400 KB gzipped); a full simulation in under 500 ms; gauge updates in under 100 ms |
| NFR-REL | Reliability | Deterministic engine; solo mode needs no backend |
| NFR-ACC | Accessibility | WCAG 2.2 AA: keyboard-only play, screen-reader labels, 4.5:1 contrast, reduced motion, color-blind-safe palette, no status shown by color alone; transcripts for tutorials |
| NFR-COMP | Compatibility | Latest two versions of Chrome, Edge, Firefox and Safari; phones and tablets |
| NFR-SEC | Security | Validate every input against a schema; rate limits; no secrets in the repo; scores recomputed on the server |
| NFR-PRIV | Privacy | Guest play only at MVP; no personal data; no free-text chat (preset messages only); anonymous analytics |
| NFR-MNT | Maintainability | Catalogs are data files, not code; engine unit-test coverage at least 80%; CI must pass before merge |
| NFR-HON | Scientific honesty | Every number carries a `NASA` / `DERIVED` / `GAME` label; an About page lists each source and its terms |
| NFR-LEGAL | Branding | Show the disclaimer "Independent project for the NASA Space Apps Challenge; not a NASA product." |

## 4. Out of scope for the MVP

Accounts and sign-in, teacher dashboard, scenario editor, AI coach, live NASA data feeds, languages other than English, native mobile apps, payments.

## 5. Open questions (deferred)

- Judging criteria and submission format.
- License terms for GMAT outputs and Mission Viz code.
- Project license (see [ROADMAP](ROADMAP.md), Phase 2 decisions).
