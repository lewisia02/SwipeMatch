import { z } from 'zod';

export const submitVotesSchema = z.object({
  logoIds: z
    .array(z.string().min(1))
    .min(1, '投票する作品を選択してください')
    .max(3, '投票できるのは3作品までです')
    .refine((ids) => new Set(ids).size === ids.length, {
      message: '同じ作品を複数回選択することはできません',
    }),
});

export type SubmitVotesInput = z.infer<typeof submitVotesSchema>;

export const submitRunoffVoteSchema = z.object({
  logoId: z.string().min(1, '投票する作品を選択してください'),
});

export type SubmitRunoffVoteInput = z.infer<typeof submitRunoffVoteSchema>;
