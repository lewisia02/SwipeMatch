import { z } from 'zod';

export const adminLoginSchema = z.object({
  password: z.string().min(1, 'パスワードを入力してください'),
});

export type AdminLoginInput = z.infer<typeof adminLoginSchema>;

export const adminPhaseSchema = z.object({
  phase: z.enum(['submission', 'voting', 'results', 'ended'], {
    message: '不正なフェーズ値です',
  }),
});

export type AdminPhaseInput = z.infer<typeof adminPhaseSchema>;
