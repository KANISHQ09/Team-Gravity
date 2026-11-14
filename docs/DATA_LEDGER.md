# GRAVITY — Data Ledger

> Every external source, dataset and media asset used by GRAVITY is recorded here, together with its terms and how we use it. The About page in the game is generated from (or kept in sync with) this file. Required by NFR-HON and SRS-DAT-01.
>
> **Rule:** no new data, image, model or code from an outside source may be merged until it has a row here with its terms checked.

## 1. Provenance labels

| Label | Meaning | Example |
| --- | --- | --- |
| `NASA` | Value or fact taken from a NASA (or partner agency) source, with a link | Solar constant 1361 W/m² |
| `NASA/GMAT` | Value produced by running NASA's GMAT tool ourselves | Lunar transfer Δv |
| `DERIVED` | Calculated by us from standard physics or from `NASA` values | Orbital period from altitude |
| `GAME` | Simplified value chosen for gameplay, informed by public figures but not taken from one source | Mass of a "medium" bus |

## 2. Sources

Status: ✅ terms checked · ⏳ to check · ❌ not usable.

| ID | Source | Link | Terms / license | Used for | Label | Status |
| --- | --- | --- | --- | --- | --- | --- |
| SRC-01 | NASA Space Apps 2026 challenge statement | `resources/challenge.docx` (NASA Space Apps challenge page) | Challenge material | Requirements, scope | — | ✅ |
| SRC-02 | Space Apps resources guide | `resources/resource.docx` | Challenge material; "follow each website's data-use terms"; NASA does not endorse non-U.S. Government entities | Resource list | — | ✅ |
| SRC-03 | NASA, *Design and Develop Science Missions* | ⏳ add URL | ⏳ | Six-stage flow, four mission segments, ConOps, verification methods | — (concepts) | ⏳ |
| SRC-04 | JPL, *Concept Maturity Levels* (Wessen et al.) | ⏳ add URL | ⏳ | Difficulty tiers, readiness checklist, 35% margin policy, 5×5 risk matrix | `NASA` (margin values) | ⏳ |
| SRC-05 | NASA Mission Design Lab | ⏳ add URL | ⏳ | Co-op roles, study tiers, MEL and cost views | — (concepts) | ⏳ |
| SRC-06 | *CubeSat 101* (CSLI) | ⏳ add URL | ⏳ | CubeSat scenario, tutorial wording, glossary | — / `NASA` | ⏳ |
| SRC-07 | GMAT (General Mission Analysis Tool) | ⏳ add URL | ⏳ check license of the tool and its outputs | Δv budgets, transfer times, trajectory samples (stretch) | `NASA/GMAT` | ⏳ |
| SRC-08 | NASA Mission Viz | ⏳ add URL | ⏳ check repository license **before copying any code** | Reference for the replay view | — | ⏳ |
| SRC-09 | NASA, *A Learning Game About Telescopes* | ⏳ add URL | ⏳ | Design patterns only (no assets copied) | — | ⏳ |
| SRC-10 | 2023 Space Apps challenge, *Visualize a Space Mission Using VR* | ⏳ add URL | ⏳ | Replay requirements (concept, trajectory, timeline) | — | ⏳ |
| SRC-11 | Canadian Space Agency, digital games and activities | ⏳ add URL | ⏳ | Educational-design inspiration only | — | ⏳ |

## 3. Constants and datasets

Fill in as catalog files are created in `packages/catalog/data/`.

| Constant / dataset | Value | Label | Source ID | File |
| --- | --- | --- | --- | --- |
| Standard gravity g₀ | 9.80665 m/s² | `DERIVED` (standard definition) | — | `packages/engine/src/models` |
| Solar constant at 1 AU | 1361 W/m² | `NASA` | ⏳ | `packages/engine/src/models` |
| Launch-vehicle classes (small / medium / heavy / super-heavy) | ⏳ | `GAME` | — | `packages/catalog/data/launch-vehicles.json` |
| Orbits (LEO, SSO, GEO, lunar low, Mars low, Mars elliptical) | ⏳ | `DERIVED` / `GAME` | — | `packages/catalog/data/orbits.json` |
| Instruments and subsystem parts | ⏳ | `GAME` | — | `packages/catalog/data/parts.json` |
| Analog (real) NASA missions | ⏳ about 10, each fact checked | `NASA` | ⏳ | `packages/catalog/data/analogs.json` |

## 4. Media assets (images, 3D models, icons, fonts, sounds)

| Asset | Source | License | Attribution text | Status |
| --- | --- | --- | --- | --- |
| — | — | — | — | — |

Use only public-domain, NASA-licensed or openly licensed media. Never use the NASA logo ("meatball" or "worm") or anything that implies endorsement.

## 5. Required disclaimer

Shown on the About page and in the README:

> Independent project created for the NASA Space Apps Challenge; not a NASA product. NASA does not endorse this project.
