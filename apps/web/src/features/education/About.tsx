import { catalog } from '@gravity/engine';

const SOURCES = [
  {
    name: 'NASA Space Apps Challenge 2026: Space Mission Design Game',
    url: 'https://www.spaceappschallenge.org/2026/challenges/space-mission-design-game/',
  },
  {
    name: 'NASA, Design and Develop Science Missions',
    url: 'https://www.nasa.gov/wp-content/uploads/2025/04/250323-design-and-develop-science-mission.pdf?emrc=a454cf',
  },
  {
    name: 'JPL, Concept Maturity Levels (Wessen et al., 2013), CC0',
    url: 'https://dataverse.jpl.nasa.gov/dataset.xhtml?persistentId=hdl:2014/44299',
  },
  {
    name: 'NASA Goddard Mission Design Lab',
    url: 'https://etd.gsfc.nasa.gov/capabilities/integrated-design-center/mission-design-lab/',
  },
  {
    name: 'NASA CSLI, CubeSat 101',
    url: 'https://www3.nasa.gov/sites/default/files/atoms/files/nasa_csli_cubesat_101_508.pdf',
  },
  {
    name: 'NASA, General Mission Analysis Tool (GMAT), Apache-2.0',
    url: 'https://software.nasa.gov/software/GSC-19468-1',
  },
  {
    name: 'NASA Webb, A Learning Game About Telescopes',
    url: 'https://science.nasa.gov/mission/webb/game-build-it-yourself/',
  },
  {
    name: 'NASA Images and Media Usage Guidelines',
    url: 'https://www.nasa.gov/nasa-brand-center/images-and-media/',
  },
];

export function About() {
  return (
    <div className="max-w-3xl space-y-6">
      <h2 className="text-2xl font-semibold">About GRAVITY</h2>
      <p className="rounded-md border border-amber-500 bg-amber-950/60 p-3">
        Independent project created for the NASA Space Apps Challenge; not a NASA product. NASA does
        not endorse this project.
      </p>
      <p className="text-slate-300">
        GRAVITY was built by Team Gravity for the NASA Space Apps Challenge 2026. Its stages follow
        NASA's science mission process and JPL's Concept Maturity Levels. The code is open source
        under the MIT License.
      </p>

      <section className="space-y-2">
        <h3 className="text-lg font-semibold">Where the numbers come from</h3>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-300">
          <li>
            <strong>NASA</strong>: taken from a NASA source (for example the solar constant, 1361
            W/m², and the 3 dB link margin rule).
          </li>
          <li>
            <strong>DERIVED</strong>: calculated with standard physics (orbital periods, the rocket
            equation, solar power at distance).
          </li>
          <li>
            <strong>GAME</strong>: simplified values chosen for play, informed by public figures
            (part masses, costs, launch-vehicle classes). Real spacecraft vary widely.
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h3 className="text-lg font-semibold">Sources</h3>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {SOURCES.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noreferrer" className="text-sky-300 underline">
                {s.name}
              </a>
            </li>
          ))}
          {catalog.analogs.map((a) => (
            <li key={a.id}>
              <a href={a.url} target="_blank" rel="noreferrer" className="text-sky-300 underline">
                NASA Science: {a.name}
              </a>
            </li>
          ))}
        </ul>
        <p className="text-xs text-slate-400">
          Full source list and terms: docs/DATA_LEDGER.md in the project repository.
        </p>
      </section>
    </div>
  );
}
