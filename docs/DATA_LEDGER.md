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

Status: ✅ terms checked · 🔒 reference only (no reuse allowed or planned) · ⏳ to check · ❌ not usable.

Links are taken from the official challenge **Resources** tab: <https://www.spaceappschallenge.org/2026/challenges/space-mission-design-game/?tab=resources> (checked 2026-11-14). That page states: *"NASA does not endorse any non-U.S. Government entity and is not responsible for information contained on non-U.S. Government websites. For non-U.S. Government websites, participants must comply with any data use parameters of that specific website."*

**NASA content in general** ([NASA Images and Media Usage Guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/)): NASA content is generally not subject to copyright in the United States and may be used in a factual manner that does not imply endorsement. The NASA insignia, logotype and identifiers are **not** in the public domain and must not be used. Third-party material inside NASA documents (marked as such) keeps its own copyright. Rows below marked "NASA guidelines" follow these rules.

| ID | Source | Link | Terms / license | Used for | Label | Status |
| --- | --- | --- | --- | --- | --- | --- |
| SRC-01 | NASA Space Apps 2026 challenge statement | [Challenge page](https://www.spaceappschallenge.org/2026/challenges/space-mission-design-game/) · copy in `resources/challenge.docx` | Challenge material, used to define scope | Requirements, scope | — | ✅ |
| SRC-02 | Space Apps challenge Resources tab | [Resources tab](https://www.spaceappschallenge.org/2026/challenges/space-mission-design-game/?tab=resources) · summary in `resources/resource.docx` | Challenge material; comply with each linked site's data-use terms (quoted above) | Resource list | — | ✅ |
| SRC-03 | NASA, *Design and Develop Science Missions* (webinar slides, Mar 2025) | [PDF](https://www.nasa.gov/wp-content/uploads/2025/04/250323-design-and-develop-science-mission.pdf?emrc=a454cf) | NASA guidelines; concepts only, no slides or images copied | Six-stage flow, four mission segments, ConOps, verification methods | — (concepts) | ✅ |
| SRC-04 | Wessen, Borden, Ziemer, Kwok (2013), *Space mission concept development using concept maturity levels*, AIAA SPACE 2013 (JPL) | [JPL Open Repository](https://dataverse.jpl.nasa.gov/dataset.xhtml?persistentId=hdl:2014/44299) · <https://hdl.handle.net/2014/44299> | **CC0 1.0**; repository asks for citation (use the citation in this row) | Difficulty tiers, readiness checklist, 35% margin policy, 5×5 risk matrix | `NASA` (margin values) | ✅ |
| SRC-05 | NASA Goddard, *Mission Design Lab (MDL)* | [MDL page](https://etd.gsfc.nasa.gov/capabilities/integrated-design-center/mission-design-lab/) | NASA guidelines; concepts only | Co-op roles, study tiers, MEL and cost views | — (concepts) | ✅ |
| SRC-06 | NASA CSLI, *CubeSat 101: Basic Concepts and Processes for First-Time CubeSat Developers* | [PDF](https://www3.nasa.gov/sites/default/files/atoms/files/nasa_csli_cubesat_101_508.pdf) | NASA guidelines; paraphrase only. Don't copy figures without checking each one's credit line (some may be third-party) | CubeSat scenario, tutorial wording, glossary | — / `NASA` | ✅ |
| SRC-07 | NASA, *General Mission Analysis Tool (GMAT)* | [NASA software catalog](https://software.nasa.gov/software/GSC-19468-1) · [source](https://github.com/nasa/GMAT) | **Apache-2.0** (MIT-compatible). We run it offline; only its numeric outputs enter the game | Δv budgets, transfer times, trajectory samples (stretch) | `NASA/GMAT` | ✅ |
| SRC-08 | NASA, *Mission Viz* | [Site](https://nasa.github.io/mission-viz/) · [repo](https://github.com/nasa/mission-viz) | **No license file in the repository** (checked 2026-11-14), so the code is all-rights-reserved by default. **Do not copy its code or assets**; link to it and learn from its approach only | Reference for the replay view | — | 🔒 |
| SRC-09 | NASA Webb, *A Learning Game About Telescopes* (Build It Yourself) | [Game](https://science.nasa.gov/mission/webb/game-build-it-yourself/) | NASA guidelines; design patterns only, no assets copied | Objectives-first flow, disabled options with reasons, real-mission match | — | ✅ |
| SRC-10 | 2023 NASA Space Apps challenge, *Visualize a Space Mission Using Virtual Reality* | [Challenge page](https://www.spaceappschallenge.org/2023/challenges/visualize-a-space-mission-using-virtual-reality/) | Challenge material; ideas only | Replay requirements (concept, trajectory, timeline) | — | ✅ |
| SRC-11 | Canadian Space Agency, *Digital Games and Activities* | [CSA page](https://www.asc-csa.gc.ca/eng/youth-educators/digital-games-and-activities.asp) | Government of Canada site terms (not reviewed in detail). Inspiration only; **nothing is copied**, so no reuse terms apply. Review before reusing anything | Educational-design inspiration | — | 🔒 |

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

Use only public-domain, NASA-licensed or openly licensed media. Never use the NASA insignia ("meatball"), logotype ("worm") or other NASA identifiers, which are not in the public domain, or anything that implies endorsement.

## 5. Required disclaimer

Shown on the About page and in the README:

> Independent project created for the NASA Space Apps Challenge; not a NASA product. NASA does not endorse this project.
