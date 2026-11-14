import { describe, expect, it } from 'vitest';
import { provenanceLabelSchema } from '../src/index.ts';

describe('provenanceLabelSchema', () => {
  it('accepts the four documented labels', () => {
    for (const label of ['NASA', 'NASA/GMAT', 'DERIVED', 'GAME']) {
      expect(provenanceLabelSchema.parse(label)).toBe(label);
    }
  });

  it('rejects anything else', () => {
    expect(provenanceLabelSchema.safeParse('GUESS').success).toBe(false);
  });
});
