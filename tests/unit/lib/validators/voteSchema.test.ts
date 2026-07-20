import { describe, expect, it } from 'vitest';
import { submitVotesSchema } from '@/lib/validators/voteSchema';

describe('submitVotesSchema', () => {
  it('1件のlogoIdsを受け入れる', () => {
    const result = submitVotesSchema.safeParse({ logoIds: ['logo-1'] });
    expect(result.success).toBe(true);
  });

  it('3件のlogoIdsを受け入れる', () => {
    const result = submitVotesSchema.safeParse({ logoIds: ['logo-1', 'logo-2', 'logo-3'] });
    expect(result.success).toBe(true);
  });

  it('0件の場合はエラーになる', () => {
    const result = submitVotesSchema.safeParse({ logoIds: [] });
    expect(result.success).toBe(false);
  });

  it('4件以上の場合はエラーになる', () => {
    const result = submitVotesSchema.safeParse({
      logoIds: ['logo-1', 'logo-2', 'logo-3', 'logo-4'],
    });
    expect(result.success).toBe(false);
  });

  it('同じlogoIdが重複している場合はエラーになる', () => {
    const result = submitVotesSchema.safeParse({ logoIds: ['logo-1', 'logo-1'] });
    expect(result.success).toBe(false);
  });
});
