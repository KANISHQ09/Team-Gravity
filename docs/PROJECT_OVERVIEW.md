# GRAVITY — Project Overview

> Status: **Draft for team review** · Source of truth for detail: [`resources/Gravity.md`](../resources/Gravity.md) · Challenge: [`resources/challenge.docx`](../resources/challenge.docx) · Resources: [`resources/resource.docx`](../resources/resource.docx)

## What GRAVITY is

GRAVITY is a browser game for the **NASA Space Apps Challenge 2026 — Space Mission Design Game**. One to four players design a space mission from start to finish:

1. pick a science objective,
2. turn it into measurable requirements,
3. design the spacecraft and choose instruments,
4. choose a launch vehicle and orbit,
5. balance six resources: **mass, power, budget, data, communications and time**,
6. pass a launch-readiness check, launch, and watch the mission play out,
7. read a report that explains, step by step, **why** the mission succeeded or failed.

## The problem it solves

Real missions succeed or fail on trade-offs: a better instrument adds science but also mass, power, data and cost. Most learning tools teach one piece at a time (orbits, rockets or subsystems), so students rarely see how the pieces interact or get to fail, learn and try again. GRAVITY puts the whole mission in one loop that players can repeat.

## Who it is for

| Audience | What they need from GRAVITY |
| --- | --- |
| Students aged 12–18 (beginners) | Guided, visual, forgiving, no jargon |
| University students and hobbyists | Realistic constraints and replayability |
| Teachers | Works without accounts or installs, and with poor Wi-Fi |
| Hackathon judges | Clear science, honest data labels, a polished demo |

## What makes it different

- **Objective first, consequences always.** Every choice changes at least one resource, and there is never a single "perfect" design.
- **Follows the real NASA process.** The game stages follow NASA's six-step mission process, its four mission segments (launch, space, ground, user) and JPL's Concept Maturity Levels, all taken from the provided resources.
- **Explains outcomes.** The report gives cause-and-effect statements ("Because you chose X, Y happened, which cut Z by N"), not just a pass/fail.
- **Co-op for up to four players,** each owning one discipline, the way NASA's Mission Design Lab teams work. Launch needs a team GO/NO-GO vote.
- **Honest numbers.** Every value is labeled `NASA`, `DERIVED` (calculated) or `GAME` (simplified).
- **Works offline in solo mode** after the first load.

## Scope at a glance

| In the hackathon MVP | Later |
| --- | --- |
| 3 scenarios: CubeSat Earth Observer (LEO), Lunar Orbiter, Mars Orbiter | More destinations, scenario editor |
| Six-stage flow, live resource gauges, readiness gate, simulation, causal report | Live NASA data panel, AI "Mission Mentor" coach |
| Solo play, plus co-op for 2–4 players with roles and GO/NO-GO | Accounts, teacher dashboard, competitive seasons |
| Difficulty levels: Explorer, Engineer, Flight Director | Localization (Hindi, Italian) |

## Constraints

- 48-hour build window (event: Nov 14–15, 2026).
- Free-tier infrastructure.
- Must not imply NASA endorsement; follow each source's data-use terms.
- Must run on school-grade devices, including phones and tablets.

## Related documents

[REQUIREMENTS](REQUIREMENTS.md) · [FEATURES](FEATURES.md) · [TECH_STACK](TECH_STACK.md) · [ARCHITECTURE](ARCHITECTURE.md) · [ROADMAP](ROADMAP.md) · [RESOURCE_PLAN](RESOURCE_PLAN.md) · [FOLDER_STRUCTURE](FOLDER_STRUCTURE.md)
