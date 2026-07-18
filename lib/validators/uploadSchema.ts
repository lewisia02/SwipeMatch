import { z } from 'zod';

// HEICはクライアント側で必ずJPEGへ変換されてからアップロードされるため、
// Storageに実際に保存される形式はjpeg/png/webpのいずれかになる
export const createUploadUrlSchema = z.object({
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp'], {
    message: '対応していない画像形式です',
  }),
});

export type CreateUploadUrlInput = z.infer<typeof createUploadUrlSchema>;

export const createLogoSchema = z.object({
  storagePath: z.string().min(1, 'storagePathは必須です'),
  uploaderName: z
    .string()
    .min(1, '投稿者名を入力してください')
    .max(50, '投稿者名は50文字以内で入力してください'),
  memo: z
    .string()
    .min(1, '一口メモを入力してください')
    .max(200, '一口メモは200文字以内で入力してください'),
});

export type CreateLogoInput = z.infer<typeof createLogoSchema>;
