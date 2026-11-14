import { z } from 'zod';
import { provenanceLabelSchema } from './provenance.ts';

/**
 * Domain model shared by the engine, the web app and the server.
 * Every catalog entry carries a provenance label (docs/DATA_LEDGER.md).
 */

export const difficultySchema = z.enum(['explorer', 'engineer', 'flight-director']);
export type Difficulty = z.infer<typeof difficultySchema>;

export const resourceKeySchema = z.enum(['mass', 'power', 'budget', 'data', 'comms', 'time']);
export type ResourceKey = z.infer<typeof resourceKeySchema>;

export const segmentSchema = z.enum(['launch', 'space', 'ground', 'user']);
export type Segment = z.infer<typeof segmentSchema>;

export const bodySchema = z.enum(['earth', 'moon', 'mars']);
export type Body = z.infer<typeof bodySchema>;

export const orbitClassSchema = z.enum(['leo', 'sso', 'geo', 'lunar', 'mars']);
export type OrbitClass = z.infer<typeof orbitClassSchema>;

export const partCategorySchema = z.enum([
  'bus',
  'solar',
  'battery',
  'antenna',
  'computer',
  'adcs',
  'propulsion',
  'instrument',
]);
export type PartCategory = z.infer<typeof partCategorySchema>;

/** Measurement types an instrument can provide and a science goal can need. */
export const measurementSchema = z.enum([
  'visible-imaging',
  'multispectral-imaging',
  'spectroscopy',
  'radar-sounding',
  'magnetic-field',
  'radiation',
  'altimetry',
]);
export type Measurement = z.infer<typeof measurementSchema>;

const provenanced = {
  provenance: provenanceLabelSchema,
  /** ID of the source in docs/DATA_LEDGER.md, when the provenance is NASA. */
  sourceId: z.string().optional(),
};

export const partSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    category: partCategorySchema,
    /** Plain-language "why does this matter?" text shown in the UI. */
    description: z.string().min(1),
    massKg: z.number().nonnegative(),
    /** Average electrical power drawn while operating (W). */
    powerW: z.number().nonnegative(),
    costM: z.number().nonnegative(),
    /** Probability the part survives one year of operation (0–1). */
    reliability: z.number().min(0).max(1),
    /** Months needed to build and test this part. */
    devMonths: z.number().nonnegative(),
    /** Hidden on Explorer difficulty. */
    advanced: z.boolean(),
    // Category-specific properties (validated per category below).
    payloadCapacityKg: z.number().positive().optional(), // bus
    areaM2: z.number().positive().optional(), // solar
    efficiency: z.number().positive().max(1).optional(), // solar
    capacityWh: z.number().positive().optional(), // battery
    gainDbi: z.number().optional(), // antenna
    txPowerW: z.number().positive().optional(), // antenna
    radHard: z.boolean().optional(), // computer
    storageGbit: z.number().positive().optional(), // computer: onboard data recorder
    pointingArcsec: z.number().positive().optional(), // adcs
    redundant: z.boolean().optional(), // adcs
    ispS: z.number().positive().optional(), // propulsion
    propellantKg: z.number().nonnegative().optional(), // propulsion
    measures: z.array(measurementSchema).optional(), // instrument
    dataGbitPerDay: z.number().nonnegative().optional(), // instrument
    scienceValue: z.number().nonnegative().optional(), // instrument
    ...provenanced,
  })
  .superRefine((p, ctx) => {
    const need = (field: keyof typeof p, category: PartCategory) => {
      if (p.category === category && p[field] === undefined) {
        ctx.addIssue({ code: 'custom', path: [field], message: `${category} parts need ${field}` });
      }
    };
    need('payloadCapacityKg', 'bus');
    need('areaM2', 'solar');
    need('efficiency', 'solar');
    need('capacityWh', 'battery');
    need('gainDbi', 'antenna');
    need('txPowerW', 'antenna');
    need('pointingArcsec', 'adcs');
    need('ispS', 'propulsion');
    need('propellantKg', 'propulsion');
    need('storageGbit', 'computer');
    need('measures', 'instrument');
    need('dataGbitPerDay', 'instrument');
    need('scienceValue', 'instrument');
  });
export type Part = z.infer<typeof partSchema>;

export const launchVehicleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  costM: z.number().positive(),
  reliability: z.number().min(0).max(1),
  /** Payload capacity (kg) per orbit class; 0 means the vehicle cannot reach it. */
  capacityKg: z.record(orbitClassSchema, z.number().nonnegative()),
  ...provenanced,
});
export type LaunchVehicle = z.infer<typeof launchVehicleSchema>;

export const orbitSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  body: bodySchema,
  orbitClass: orbitClassSchema,
  altitudeKm: z.number().positive(),
  description: z.string().min(1),
  /** Share of each orbit spent in shadow (0–1): the battery must cover it. */
  eclipseFraction: z.number().min(0).max(1),
  /** Distance from the Sun (AU): solar power falls with 1/r². */
  sunDistanceAu: z.number().positive(),
  /** Typical distance to Earth ground stations (km), drives the link budget. */
  earthDistanceKm: z.number().positive(),
  /** Ground-station contact time per day with one station (minutes). */
  contactMinutesPerDay: z.number().positive(),
  /**
   * Size of the ground antennas used for this orbit, folded into one link-budget
   * factor (small dishes for Earth orbit, Deep Space Network dishes for the Moon
   * and Mars). Simplified game value.
   */
  groundAntennaFactor: z.number().positive(),
  /** Spacecraft Δv needed after launch-vehicle separation (m/s). */
  deltaVRequiredMs: z.number().nonnegative(),
  /** Travel time from launch to the operational orbit (days). */
  transferDays: z.number().nonnegative(),
  /** Radiation environment multiplier for failure hazards (1 = LEO). */
  radiation: z.number().positive(),
  /**
   * How well this orbit suits surface mapping (imaging, altimetry, radar), 0–1.
   * High, stretched or twilight orbits map poorly.
   */
  mappingQuality: z.number().min(0).max(1),
  ...provenanced,
});
export type Orbit = z.infer<typeof orbitSchema>;

export const goalSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  /** What has to be measured to meet the goal. */
  measurement: measurementSchema,
  /** Relative importance; the weights of a scenario's goals add up to 1. */
  weight: z.number().positive().max(1),
});
export type Goal = z.infer<typeof goalSchema>;

export const scenarioSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  summary: z.string().min(1),
  objective: z.string().min(1),
  body: bodySchema,
  recommendedDifficulty: difficultySchema,
  goals: z.array(goalSchema).min(2).max(4),
  allowedOrbitIds: z.array(z.string()).min(1),
  budgetM: z.number().positive(),
  developmentMonths: z.number().positive(),
  /** Target length of science operations (days). */
  missionDays: z.number().int().positive(),
  /** Science points for full success (Baseline) and partial success (Threshold). */
  baselineScience: z.number().positive(),
  thresholdScience: z.number().positive(),
  criticalResource: resourceKeySchema,
  /** Launch period (days) within which the spacecraft must launch. */
  launchPeriodDays: z.number().int().positive(),
  ...provenanced,
});
export type Scenario = z.infer<typeof scenarioSchema>;

export const analogSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  body: bodySchema,
  launchYear: z.number().int(),
  measures: z.array(measurementSchema).min(1),
  summary: z.string().min(1),
  url: z.url(),
  ...provenanced,
});
export type Analog = z.infer<typeof analogSchema>;

export const glossaryEntrySchema = z.object({
  term: z.string().min(1),
  definition: z.string().min(1),
});
export type GlossaryEntry = z.infer<typeof glossaryEntrySchema>;

export const catalogSchema = z.object({
  version: z.number().int().positive(),
  parts: z.array(partSchema).min(15),
  launchVehicles: z.array(launchVehicleSchema).min(4),
  orbits: z.array(orbitSchema).min(4),
  scenarios: z.array(scenarioSchema).min(3),
  analogs: z.array(analogSchema),
  glossary: z.array(glossaryEntrySchema),
});
export type Catalog = z.infer<typeof catalogSchema>;

/** Optional risk mitigations a team can buy (cost money, schedule or mass). */
export const mitigationSchema = z.enum(['budget-reserve', 'schedule-margin', 'extra-testing']);
export type Mitigation = z.infer<typeof mitigationSchema>;

/** A player's mission design. This is what is saved, shared and simulated. */
export const designSchema = z.object({
  schemaVersion: z.literal(1),
  scenarioId: z.string().min(1),
  difficulty: difficultySchema,
  goalIds: z.array(z.string()),
  /** Selected parts; an ID may repeat (e.g. two batteries). */
  partIds: z.array(z.string()).max(30),
  launchVehicleId: z.string().nullable(),
  orbitId: z.string().nullable(),
  /** Ground stations used per day (1–3): more stations, more downlink, more cost. */
  groundStations: z.number().int().min(1).max(3),
  mitigations: z.array(mitigationSchema),
});
export type Design = z.infer<typeof designSchema>;

export function emptyDesign(scenarioId: string, difficulty: Difficulty): Design {
  return {
    schemaVersion: 1,
    scenarioId,
    difficulty,
    goalIds: [],
    partIds: [],
    launchVehicleId: null,
    orbitId: null,
    groundStations: 1,
    mitigations: [],
  };
}
