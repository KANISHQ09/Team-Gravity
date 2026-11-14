import { describe, expect, it } from 'vitest';
import { emptyPayloadSchema, memberRemoveSchema } from '../src/index.ts';

describe('room lifecycle message schemas', () => {
  it('accepts no payload or {} for sim:start and room:leave, and nothing else', () => {
    expect(emptyPayloadSchema.safeParse(undefined).success).toBe(true);
    expect(emptyPayloadSchema.safeParse({}).success).toBe(true);
    expect(emptyPayloadSchema.safeParse({ seed: 1 }).success).toBe(false);
  });

  it('requires a user ID for member:remove and rejects extra fields', () => {
    expect(memberRemoveSchema.safeParse({ userId: 'g_1' }).success).toBe(true);
    expect(memberRemoveSchema.safeParse({ userId: '' }).success).toBe(false);
    expect(memberRemoveSchema.safeParse({ userId: 'g_1', reason: 'x' }).success).toBe(false);
  });
});
