import { z } from 'zod';
import { designSchema, difficultySchema } from './domain.ts';
import { designEditSchema, roleSchema } from './edits.ts';

/**
 * REST and Socket.IO contracts between apps/web and apps/server
 * (docs/API_DOCUMENTATION.md). Objects are strict: unknown fields are rejected.
 */

export const seedSchema = z
  .number()
  .int()
  .min(0)
  .max(2 ** 31 - 1);

// --- Team names: chosen from preset words only (no free text; minors play) ---
export const TEAM_ADJECTIVES = [
  'Bright',
  'Bold',
  'Cosmic',
  'Daring',
  'Lunar',
  'Orbital',
  'Polar',
  'Rapid',
  'Solar',
  'Stellar',
  'Swift',
  'Quiet',
  'Red',
  'Blue',
  'Golden',
  'Silver',
] as const;
export const TEAM_NOUNS = [
  'Comets',
  'Explorers',
  'Falcons',
  'Navigators',
  'Orbiters',
  'Pioneers',
  'Probes',
  'Rangers',
  'Rovers',
  'Satellites',
  'Scouts',
  'Voyagers',
  'Wanderers',
  'Owls',
] as const;
export const teamNameSchema = z.string().refine((name) => {
  const [adj, noun, ...rest] = name.split(' ');
  return (
    rest.length === 0 &&
    (TEAM_ADJECTIVES as readonly string[]).includes(adj ?? '') &&
    (TEAM_NOUNS as readonly string[]).includes(noun ?? '')
  );
}, 'Team name must be one preset adjective and one preset noun');

// --- REST ---
export const simulateRequestSchema = z.strictObject({ design: designSchema, seed: seedSchema });
export type SimulateRequest = z.infer<typeof simulateRequestSchema>;

export const scoreSubmitSchema = z.strictObject({
  design: designSchema,
  seed: seedSchema,
  teamName: teamNameSchema,
  playerCount: z.number().int().min(1).max(4),
});
export type ScoreSubmit = z.infer<typeof scoreSubmitSchema>;

export const leaderboardQuerySchema = z.strictObject({ difficulty: difficultySchema });

export const createRoomSchema = z.strictObject({
  scenarioId: z.string().min(1),
  difficulty: difficultySchema,
});

export const roomCodeSchema = z.string().regex(/^[A-HJ-NP-Z2-9]{6}$/, 'Invalid room code');

// --- Socket.IO (client → server) ---
export const PROPOSAL_MESSAGES = [
  'This keeps us inside the budget',
  'We need more power margin',
  'This improves our science return',
  'This lowers mission risk',
  'The rocket cannot lift our current mass',
] as const;
export const NO_GO_REASONS = [
  'Margins are too thin',
  'Science goals are not covered',
  'Risk is too high',
  'I need more time to review',
] as const;

export const roomJoinSchema = z.strictObject({ code: roomCodeSchema });
export const roleClaimSchema = z.strictObject({ roles: z.array(roleSchema).min(1).max(4) });
export const designPatchSchema = z.strictObject({
  edit: designEditSchema,
  baseVersion: z.number().int().min(0),
});
export const proposalCreateSchema = z.strictObject({
  edit: designEditSchema,
  message: z.enum(PROPOSAL_MESSAGES),
});
export const proposalRespondSchema = z.strictObject({
  proposalId: z.string().min(1),
  accept: z.boolean(),
});
export const voteCastSchema = z.discriminatedUnion('vote', [
  z.strictObject({ vote: z.literal('go') }),
  z.strictObject({ vote: z.literal('no-go'), reason: z.enum(NO_GO_REASONS) }),
]);
