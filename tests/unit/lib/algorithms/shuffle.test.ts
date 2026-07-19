import { describe, expect, it } from 'vitest';
import { shuffle } from '@/lib/algorithms/shuffle';

describe('shuffle', () => {
  it('元の配列と同じ要素をすべて保持する', () => {
    const input = [1, 2, 3, 4, 5];
    const result = shuffle(input);

    expect(result).toHaveLength(input.length);
    expect([...result].sort()).toEqual([...input].sort());
  });

  it('元の配列を変更しない', () => {
    const input = [1, 2, 3];
    const original = [...input];

    shuffle(input);

    expect(input).toEqual(original);
  });

  it('複数回実行すると異なる順序になり得る（一様性の簡易検証）', () => {
    const input = Array.from({ length: 20 }, (_, i) => i);
    const results = Array.from({ length: 20 }, () => shuffle(input).join(','));
    const uniqueResults = new Set(results);

    expect(uniqueResults.size).toBeGreaterThan(1);
  });

  it('空配列を渡すと空配列を返す', () => {
    expect(shuffle([])).toEqual([]);
  });
});
