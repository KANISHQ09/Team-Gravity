# GRAVITY — Feature List

> Status: **Draft for team review**. Tiers match the cut lines in [`resources/Gravity.md`](../resources/Gravity.md) §0.9. Requirement IDs refer to [REQUIREMENTS](REQUIREMENTS.md).

Legend: **MVP** = built during the hackathon · **Stretch** = MVP if time allows, first to cut · **Future** = after the event.

## 1. Mission setup

| Feature | Tier | Req |
| --- | --- | --- |
| Scenario picker: CubeSat Earth Observer (LEO), Lunar Orbiter, Mars Orbiter | MVP | FR-01 |
| Difficulty picker: Explorer / Engineer / Flight Director | MVP | FR-03 |
| Mission Brief with science goal selection | MVP | FR-02 |
| Live Science Traceability Matrix | MVP | FR-02 |
| Baseline and Threshold science levels per scenario | MVP | FR-03a |
| Sandbox mode | Stretch | FR-16 |
| Constellation and multi-target scenarios | Future | — |

## 2. Six-stage design flow

| Stage | Feature | Tier |
| --- | --- | --- |
| 1 Need and Goals | Goal picker + traceability matrix | MVP |
| 2 Concept | Four-segment concept board (launch, space, ground, user) and a mission timeline (ConOps) | MVP (timeline editable from Engineer level up) |
| 3 Requirements | Generated measurable requirements, each with a verification method | MVP |
| 4 Design | Design Studio, Master Equipment List, launch and orbit picker | MVP |
| 5 Build and Verify | Readiness checklist (green/yellow/red), 5×5 risk matrix | MVP (risk matrix required on Flight Director) |
| 6 Implement | GO/NO-GO, launch, simulation, report | MVP |
| — | Return to any earlier stage without losing work | MVP |

## 3. Design Studio

| Feature | Tier |
| --- | --- |
| Parts browser: bus, solar arrays, batteries, antennas, computers, attitude control, propulsion, instruments | MVP |
| Disabled options that show why they're unavailable | MVP |
| Six live resource gauges with margin and status | MVP |
| Highlight of the scenario's critical resource | MVP |
| "Why does this matter?" tooltip on every item | MVP |
| Launch-compatibility check that states the exact shortfall | MVP |
| Δv breakdown (transfer, insertion, station-keeping, margin) | MVP |
| Undo/redo (50 steps) | Stretch |
| 2D spacecraft view | MVP |
| 3D spacecraft view | Stretch (first cut) |

## 4. Simulation

| Feature | Tier |
| --- | --- |
| Deterministic 6-phase simulation with a seed | MVP |
| 6 random event types, each affected by design choices | MVP |
| Live dashboard (clock, phase, power, battery, data buffer, science points, events) | MVP |
| Pause and 1× / 5× / 20× speed | Stretch |
| In-flight decision point | Stretch |
| 2D Mission Replay | MVP |
| 3D Mission Replay; trajectories exported from GMAT | Stretch |

## 5. Scoring and report

| Feature | Tier |
| --- | --- |
| 0–100 score with a five-part breakdown and difficulty multiplier | MVP |
| Outcome: Full / Partial / Failure | MVP |
| At least 3 cause-and-effect statements | MVP |
| "Try changing…" suggestions that pre-fill a new design | MVP |
| Similar real NASA missions | Stretch |
| Trade-space chart | Stretch |
| Sensitivity view | Stretch (second cut) |

## 6. Multiplayer

| Feature | Tier |
| --- | --- |
| Hot-seat co-op on one device (roles + GO/NO-GO) | MVP (guaranteed fallback) |
| Online rooms with a 6-character code, 2–4 players | MVP (fifth cut → hot-seat) |
| Server-enforced role ownership, proposals | MVP (with online rooms) |
| Reconnect and resync | Stretch |
| Competitive mode | Future |

## 7. Persistence and sharing

| Feature | Tier |
| --- | --- |
| Local autosave | MVP |
| Design codes (share by URL) | Stretch |
| Leaderboard (server recomputes scores) | Stretch (third cut) |
| Accounts, saved designs, side-by-side comparison | Future |

## 8. Learning and accessibility

| Feature | Tier |
| --- | --- |
| Guided tutorial mission | MVP |
| Glossary on every screen | MVP |
| Keyboard play, screen-reader labels, reduced motion, color-blind-safe palette | MVP |
| Mobile and tablet layout | MVP |
| Tutorial text transcripts | MVP |
| Static facts panel with source labels | Stretch |
| About page: sources, terms, NASA disclaimer | MVP |
| Live NASA data panel (APOD, NeoWs, DONKI) | Future |
| AI "Mission Mentor" coach | Future |
| Teacher dashboard, classroom codes, Hindi/Italian | Future |

## Never cut

Six-stage flow · requirements with verification · Baseline/Threshold outcome · readiness gate · four-segment grouping · six resource gauges · compatibility check · simulation · causal report · provenance labels · accessibility basics.
