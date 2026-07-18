import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAppSettings = { currentPhase: 'submission' as 'submission' | 'voting' | 'results' };

vi.mock('@/lib/repositories/AppSettingsRepository', () => {
  return {
    AppSettingsRepository: vi.fn().mockImplementation(() => ({
      get: vi.fn().mockImplementation(async () => ({
        id: 'singleton',
        currentPhase: mockAppSettings.currentPhase,
        updatedAt: new Date(),
      })),
      updatePhase: vi.fn(),
    })),
  };
});

vi.mock('@/lib/repositories/LogoRepository', () => {
  return {
    LogoRepository: vi.fn().mockImplementation(() => ({
      create: vi.fn().mockResolvedValue({
        id: 'logo-1',
        imageUrl: 'https://example.com/logos/abc.jpg',
        uploaderName: '山田太郎',
        memo: 'テストメモ',
        createdAt: new Date('2026-07-18T00:00:00.000Z'),
      }),
      findAll: vi.fn(),
      delete: vi.fn(),
      createSignedUploadUrl: vi.fn().mockResolvedValue({
        uploadUrl: 'https://example.com/upload',
        storagePath: 'abc.jpg',
      }),
      deleteStorageObject: vi.fn(),
      getPublicUrl: vi.fn().mockReturnValue('https://example.com/logos/abc.jpg'),
    })),
  };
});

const { POST: postUploadUrl } = await import('@/app/api/logos/upload-url/route');
const { POST: postLogo } = await import('@/app/api/logos/route');

function jsonRequest(url: string, body: unknown) {
  return new NextRequest(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/logos/upload-url', () => {
  beforeEach(() => {
    mockAppSettings.currentPhase = 'submission';
  });

  it('submissionフェーズの場合、署名付きURLを返す', async () => {
    const response = await postUploadUrl(
      jsonRequest('http://localhost/api/logos/upload-url', { contentType: 'image/jpeg' }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.storagePath).toBe('abc.jpg');
  });

  it('不正なcontentTypeの場合、400を返す', async () => {
    const response = await postUploadUrl(
      jsonRequest('http://localhost/api/logos/upload-url', { contentType: 'image/heic' }),
    );

    expect(response.status).toBe(400);
  });

  it('submissionフェーズでない場合、403を返す', async () => {
    mockAppSettings.currentPhase = 'voting';

    const response = await postUploadUrl(
      jsonRequest('http://localhost/api/logos/upload-url', { contentType: 'image/jpeg' }),
    );

    expect(response.status).toBe(403);
  });
});

describe('POST /api/logos', () => {
  beforeEach(() => {
    mockAppSettings.currentPhase = 'submission';
  });

  it('正常なデータでLogoレコードを作成し、投稿者名を含まないレスポンスを返す', async () => {
    const response = await postLogo(
      jsonRequest('http://localhost/api/logos', {
        storagePath: 'abc.jpg',
        uploaderName: '山田太郎',
        memo: 'テストメモ',
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.id).toBe('logo-1');
    expect(body).not.toHaveProperty('uploaderName');
  });

  it('投稿者名が51文字以上の場合、400を返す', async () => {
    const response = await postLogo(
      jsonRequest('http://localhost/api/logos', {
        storagePath: 'abc.jpg',
        uploaderName: 'a'.repeat(51),
        memo: 'テストメモ',
      }),
    );

    expect(response.status).toBe(400);
  });

  it('submissionフェーズでない場合、403を返す', async () => {
    mockAppSettings.currentPhase = 'voting';

    const response = await postLogo(
      jsonRequest('http://localhost/api/logos', {
        storagePath: 'abc.jpg',
        uploaderName: '山田太郎',
        memo: 'テストメモ',
      }),
    );

    expect(response.status).toBe(403);
  });
});
