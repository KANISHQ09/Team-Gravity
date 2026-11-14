import { z } from 'zod';

/**
 * Where a number in GRAVITY comes from (docs/DATA_LEDGER.md §1).
 * Every catalog value and engine constant carries one of these labels.
 */
export const provenanceLabelSchema = z.enum(['NASA', 'NASA/GMAT', 'DERIVED', 'GAME']);

export type ProvenanceLabel = z.infer<typeof provenanceLabelSchema>;
