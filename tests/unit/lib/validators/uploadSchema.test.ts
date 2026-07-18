import { describe, expect, it } from 'vitest';
import { createLogoSchema, createUploadUrlSchema } from '@/lib/validators/uploadSchema';

describe('createLogoSchema', () => {
  it('正常なデータを受け入れる', () => {
    const result = createLogoSchema.safeParse({
      storagePath: 'logos/abc.jpg',
      uploaderName: '山田太郎',
      memo: '初めてのロゴ作成に挑戦しました',
    });

    expect(result.success).toBe(true);
  });

  it('投稿者名がちょうど50文字の場合は受け入れる', () => {
    const result = createLogoSchema.safeParse({
      storagePath: 'logos/abc.jpg',
      uploaderName: 'a'.repeat(50),
      memo: 'メモ',
    });

    expect(result.success).toBe(true);
  });

  it('一口メモがちょうど200文字の場合は受け入れる', () => {
    const result = createLogoSchema.safeParse({
      storagePath: 'logos/abc.jpg',
      uploaderName: '山田太郎',
      memo: 'a'.repeat(200),
    });

    expect(result.success).toBe(true);
  });

  it('投稿者名が空の場合はエラーになる', () => {
    const result = createLogoSchema.safeParse({
      storagePath: 'logos/abc.jpg',
      uploaderName: '',
      memo: 'メモ',
    });

    expect(result.success).toBe(false);
  });

  it('投稿者名が50文字を超える場合はエラーになる', () => {
    const result = createLogoSchema.safeParse({
      storagePath: 'logos/abc.jpg',
      uploaderName: 'a'.repeat(51),
      memo: 'メモ',
    });

    expect(result.success).toBe(false);
  });

  it('一口メモが200文字を超える場合はエラーになる', () => {
    const result = createLogoSchema.safeParse({
      storagePath: 'logos/abc.jpg',
      uploaderName: '山田太郎',
      memo: 'a'.repeat(201),
    });

    expect(result.success).toBe(false);
  });

  it('storagePathが空の場合はエラーになる', () => {
    const result = createLogoSchema.safeParse({
      storagePath: '',
      uploaderName: '山田太郎',
      memo: 'メモ',
    });

    expect(result.success).toBe(false);
  });
});

describe('createUploadUrlSchema', () => {
  it.each(['image/jpeg', 'image/png', 'image/webp'])('%sを受け入れる', (contentType) => {
    const result = createUploadUrlSchema.safeParse({ contentType });
    expect(result.success).toBe(true);
  });

  it('許可されていない形式はエラーになる', () => {
    const result = createUploadUrlSchema.safeParse({ contentType: 'image/heic' });
    expect(result.success).toBe(false);
  });
});
