import { describe, expect, it } from 'vitest';
import { rankWithTieDetection } from '@/lib/algorithms/rankWithTieDetection';
import type { Logo } from '@/lib/types/Logo';

function buildLogo(id: string, voteCount: number): Logo & { voteCount: number } {
  return {
    id,
    competitionId: 'competition-1',
    imageUrl: `https://example.com/${id}.png`,
    uploaderName: `投稿者${id}`,
    memo: `メモ${id}`,
    createdAt: new Date('2026-07-20T00:00:00.000Z'),
    voteCount,
  };
}

describe('rankWithTieDetection', () => {
  it('得票数の降順で順位を付与する', () => {
    const logos = [buildLogo('logo-1', 3), buildLogo('logo-2', 10), buildLogo('logo-3', 7)];

    const result = rankWithTieDetection(logos);

    expect(result.map((logo) => logo.id)).toEqual(['logo-2', 'logo-3', 'logo-1']);
    expect(result.map((logo) => logo.rank)).toEqual([1, 2, 3]);
  });

  it('同数なしの場合、isTiedForRunoffはすべてfalseになる', () => {
    const logos = [buildLogo('logo-1', 5), buildLogo('logo-2', 3)];

    const result = rankWithTieDetection(logos);

    expect(result.every((logo) => logo.isTiedForRunoff === false)).toBe(true);
  });

  it('1位が2件同数の場合、両方にisTiedForRunoff=trueが立つ', () => {
    const logos = [buildLogo('logo-1', 5), buildLogo('logo-2', 5), buildLogo('logo-3', 2)];

    const result = rankWithTieDetection(logos);

    const [first, second, third] = result;
    expect(first.isTiedForRunoff).toBe(true);
    expect(second.isTiedForRunoff).toBe(true);
    expect(third.isTiedForRunoff).toBe(false);
  });

  it('1位が3件同数の場合、3件すべてにisTiedForRunoff=trueが立つ', () => {
    const logos = [buildLogo('logo-1', 4), buildLogo('logo-2', 4), buildLogo('logo-3', 4)];

    const result = rankWithTieDetection(logos);

    expect(result.every((logo) => logo.isTiedForRunoff === true)).toBe(true);
  });

  it('空配列の場合、空配列を返す', () => {
    const result = rankWithTieDetection([]);

    expect(result).toEqual([]);
  });

  it('2位・3位の同数はisTiedForRunoffの対象にならない（1位境界のみ判定）', () => {
    const logos = [buildLogo('logo-1', 10), buildLogo('logo-2', 5), buildLogo('logo-3', 5)];

    const result = rankWithTieDetection(logos);

    const [first, second, third] = result;
    expect(first.isTiedForRunoff).toBe(false);
    expect(second.isTiedForRunoff).toBe(false);
    expect(third.isTiedForRunoff).toBe(false);
  });
});
