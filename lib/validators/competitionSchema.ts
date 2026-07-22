import { z } from 'zod';

export const activateCompetitionSchema = z.object({
  title: z
    .string()
    .min(1, '題名を入力してください')
    .max(100, '題名は100文字以内で入力してください'),
});

export type ActivateCompetitionInput = z.infer<typeof activateCompetitionSchema>;

export const deleteCompetitionSchema = z.object({
  title: z.string().min(1, '確認のためコンペ名を入力してください'),
});

export type DeleteCompetitionInput = z.infer<typeof deleteCompetitionSchema>;
