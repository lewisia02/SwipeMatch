import { describe, expect, it } from 'vitest';
import { adminLoginSchema, adminPhaseSchema } from '@/lib/validators/adminSchema';

describe('adminLoginSchema', () => {
  it('1文字以上のパスワードを受け入れる', () => {
    const result = adminLoginSchema.safeParse({ password: 'secret' });
    expect(result.success).toBe(true);
  });

  it('空文字の場合はエラーになる', () => {
    const result = adminLoginSchema.safeParse({ password: '' });
    expect(result.success).toBe(false);
  });
});

describe('adminPhaseSchema', () => {
  it.each(['submission', 'voting', 'results'])('%sは有効な値として受け入れる', (phase) => {
    const result = adminPhaseSchema.safeParse({ phase });
    expect(result.success).toBe(true);
  });

  it('未定義のフェーズ値の場合はエラーになる', () => {
    const result = adminPhaseSchema.safeParse({ phase: 'unknown' });
    expect(result.success).toBe(false);
  });
});
