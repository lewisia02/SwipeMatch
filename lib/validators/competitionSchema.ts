import { z } from 'zod';

export const activateCompetitionSchema = z.object({
  title: z
    .string()
    .min(1, '題名を入力してください')
    .max(100, '題名は100文字以内で入力してください'),
});

export type ActivateCompetitionInput = z.infer<typeof activateCompetitionSchema>;
