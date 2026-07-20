import { describe, expect, it, vi } from 'vitest';
import { createUniqueSlug, generateSlug } from '@/lib/algorithms/generateSlug';
import type { CompetitionRepository } from '@/lib/repositories/CompetitionRepository';

describe('generateSlug', () => {
  it('英数字8文字のslugを生成する', () => {
    const slug = generateSlug();

    expect(slug).toHaveLength(8);
    expect(slug).toMatch(/^[A-Za-z0-9_-]{8}$/);
  });

  it('呼び出すたびに異なる値を返す（衝突確率が極めて低いことの確認）', () => {
    const slugs = new Set(Array.from({ length: 20 }, () => generateSlug()));

    expect(slugs.size).toBe(20);
  });
});

describe('createUniqueSlug', () => {
  it('既存slugと衝突しない場合、1回で生成できる', async () => {
    const repository = {
      findBySlug: vi.fn().mockResolvedValue(null),
    } as unknown as CompetitionRepository;

    const slug = await createUniqueSlug(repository);

    expect(repository.findBySlug).toHaveBeenCalledTimes(1);
    expect(slug).toHaveLength(8);
  });

  it('衝突した場合、衝突しなくなるまでリトライする', async () => {
    const repository = {
      findBySlug: vi
        .fn()
        .mockResolvedValueOnce({ id: 'existing' })
        .mockResolvedValueOnce({ id: 'existing' })
        .mockResolvedValueOnce(null),
    } as unknown as CompetitionRepository;

    await createUniqueSlug(repository);

    expect(repository.findBySlug).toHaveBeenCalledTimes(3);
  });

  it('5回連続で衝突した場合、例外をスローする', async () => {
    const repository = {
      findBySlug: vi.fn().mockResolvedValue({ id: 'existing' }),
    } as unknown as CompetitionRepository;

    await expect(createUniqueSlug(repository)).rejects.toThrow('スラッグの生成に失敗しました');
    expect(repository.findBySlug).toHaveBeenCalledTimes(5);
  });
});
